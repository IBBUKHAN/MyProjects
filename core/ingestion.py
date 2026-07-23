"""Web scraping, chunking, embedding, and ChromaDB ingestion."""

import hashlib
import io
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

import requests
from google import genai
from pypdf import PdfReader

import config
from core.crawler import get_internal_links
from core.job_events import publish_event, should_stop
from core.vector_store import VectorStore
from core.web_scraper import extract_website_text

gemini_client = genai.Client(api_key=config.GOOGLE_API_KEY)

MIMETYPE_MAP = {
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".htm": "text/html",
}


def log(msg: str) -> None:
    print(f"[INGEST] {msg}")


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _download_document(url: str) -> bytes:
    resp = requests.get(url, timeout=120, headers={"User-Agent": config.USER_AGENTS[0]})
    resp.raise_for_status()
    return resp.content


def _derive_filename_from_url(parsed_url, url_filename: str) -> str:
    path = parsed_url.path.strip("/")
    segments = path.split("/") if path else []
    last = segments[-1] if segments else ""
    has_ext = "." in last and not last.startswith(".")

    if has_ext:
        name_part = "_".join(segments[:-1] + [last.rsplit(".", 1)[0]])
        ext = "." + last.rsplit(".", 1)[1]
        if parsed_url.query:
            qh = hashlib.md5(parsed_url.query.encode()).hexdigest()[:8]
            name_part = f"{name_part}_{qh}"
    elif parsed_url.query:
        query_dict = parse_qs(parsed_url.query)
        if "title" in query_dict:
            return f"{query_dict['title'][0]}.html"
        return f"{url_filename}_{hashlib.md5(parsed_url.query.encode()).hexdigest()[:6]}.html"
    elif not path:
        return f"{parsed_url.netloc.replace('.', '_')}_index.html"
    else:
        name_part = "_".join(segments)
        ext = ".html"

    name_part = re.sub(r"[^a-zA-Z0-9_\-]", "_", name_part)
    name_part = re.sub(r"_+", "_", name_part).strip("_")
    return f"{name_part}{ext}" if name_part else f"page_{hashlib.md5(path.encode()).hexdigest()[:8]}{ext}"


def _extract_pdf_pages(content: bytes) -> List[Dict[str, Any]]:
    reader = PdfReader(io.BytesIO(content))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"page_num": i + 1, "text": text})
    return pages


def extract_pdf_text_with_pages(pdf_url: str) -> List[Dict[str, Any]]:
    try:
        content = _download_document(pdf_url)
        return _extract_pdf_pages(content)
    except Exception as e:
        log(f"Failed to process PDF {pdf_url}: {e}")
        return []


def extract_text_with_pages(url: str) -> List[Dict[str, Any]]:
    parsed = urlparse(url)
    clean_path = parsed.path.lower()

    if clean_path.endswith(".pdf"):
        return extract_pdf_text_with_pages(url)
    if url.lower().startswith(("http://", "https://")):
        return extract_website_text(url)
    log(f"Unsupported URL format: {url}")
    return []


def chunk_text_with_pages(
    pages_data: List[Dict[str, Any]], max_tokens: int = 500, overlap: int = 50
) -> List[Dict[str, Any]]:
    """Split page text into overlapping word chunks."""
    all_chunks: List[Dict[str, Any]] = []
    step = max(max_tokens - overlap, 1)

    for page_data in pages_data:
        page_num = page_data["page_num"]
        heading = page_data.get("heading", "")
        words = page_data["text"].split()
        if not words:
            continue

        for start in range(0, len(words), step):
            chunk_words = words[start : start + max_tokens]
            if not chunk_words:
                break
            all_chunks.append(
                {
                    "text": " ".join(chunk_words),
                    "page_num": str(page_num),
                    "heading": heading,
                }
            )
            if start + max_tokens >= len(words):
                break

    log(f"Created {len(all_chunks)} chunks")
    return all_chunks


def _build_index_text(chunk: Dict[str, Any], doc_label: str) -> str:
    parts = []
    if doc_label:
        parts.append(f"Document: {doc_label}")
    heading = (chunk.get("heading") or "").strip()
    if heading:
        parts.append(f"Section: {heading}")
    page_num = chunk.get("page_num")
    if page_num:
        parts.append(f"Page: {page_num}")
    body = (chunk.get("text") or "").strip()
    if not parts:
        return body
    return "\n".join(parts) + "\n\n" + body


def _enrich_chunks(chunks: List[Dict[str, Any]], filename: str) -> List[Dict[str, Any]]:
    doc_label = Path(filename).stem.replace("_", " ").replace("-", " ").strip() or filename
    for chunk in chunks:
        chunk["storage_text"] = _build_index_text(chunk, doc_label)
    return chunks


def _chunk_storage_text(chunk: Dict[str, Any]) -> str:
    return chunk.get("storage_text") or chunk.get("text") or ""


def _embed_texts_gemini(texts: List[str]) -> tuple[List[List[float]], List[int]]:
    all_embeddings = []
    success_indices = []
    batch_size = 100

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        try:
            result = gemini_client.models.embed_content(
                model=config.GEMINI_EMBEDDING_MODEL,
                contents=batch,
            )
            for j, embedding in enumerate(result.embeddings):
                all_embeddings.append(embedding.values)
                success_indices.append(i + j)
        except Exception as e:
            log(f"Batch embed failed, trying individually: {e}")
            for j, text in enumerate(batch):
                try:
                    result = gemini_client.models.embed_content(
                        model=config.GEMINI_EMBEDDING_MODEL,
                        contents=text,
                    )
                    all_embeddings.append(result.embeddings[0].values)
                    success_indices.append(i + j)
                except Exception as chunk_error:
                    log(f"Chunk {i + j} failed: {chunk_error}")

    return all_embeddings, success_indices


def _get_openai_client():
    if not config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY required when EMBEDDING_PROVIDER=openai")
    import openai

    return openai.OpenAI(api_key=config.OPENAI_API_KEY)


def _embed_texts_openai(texts: List[str]) -> tuple[List[List[float]], List[int]]:
    client = _get_openai_client()
    all_embeddings = []
    success_indices = []
    batch_size = 50

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        try:
            response = client.embeddings.create(
                model=config.OPENAI_EMBEDDING_MODEL,
                input=batch,
            )
            for j, item in enumerate(response.data):
                all_embeddings.append(item.embedding)
                success_indices.append(i + j)
        except Exception as e:
            log(f"OpenAI batch failed: {e}")

    return all_embeddings, success_indices


def embed_texts(chunks: List[Dict[str, Any]]) -> tuple[List[List[float]], List[int]]:
    texts = [_chunk_storage_text(chunk) for chunk in chunks]
    if config.EMBEDDING_PROVIDER == "gemini":
        return _embed_texts_gemini(texts)
    return _embed_texts_openai(texts)


def _load_website_index() -> dict:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    if config.WEBSITE_INDEX_FILE.exists():
        return json.loads(config.WEBSITE_INDEX_FILE.read_text(encoding="utf-8"))
    return {"urls": {}}


def _save_website_index(data: dict) -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.WEBSITE_INDEX_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _update_website_index(url: str, filename: str, chunks: int) -> None:
    data = _load_website_index()
    data["urls"][url] = {
        "filename": filename,
        "chunks": chunks,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _save_website_index(data)


def ingest_single_url(
    url: str,
    filename: Optional[str] = None,
    overwrite: bool = True,
    pages_data: Optional[List[Dict[str, Any]]] = None,
    job_id: Optional[str] = None,
) -> Dict[str, Any]:
    parsed_url = urlparse(url)
    url_filename = parsed_url.path.split("/")[-1] or "index.html"
    if not filename:
        filename = _derive_filename_from_url(parsed_url, url_filename)
    elif "." not in filename:
        filename += ".html"

    vs = VectorStore()
    channel = f"crawl:job:{job_id}" if job_id else None

    def notify(status: str, message: str, **extra):
        if channel:
            publish_event(channel, {"status": status, "url": url, "message": message, **extra})

    if overwrite:
        vs.delete_by_url(url)
        vs.delete_by_filename(filename)

    try:
        notify("extracting", f"Extracting content from {url}")
        if pages_data is None:
            pages_data = extract_text_with_pages(url)
        if not pages_data:
            return {
                "success": False,
                "message": "No text extracted",
                "chunks_added": 0,
                "filename": filename,
            }

        notify("chunking", f"Chunking {filename}")
        chunks = _enrich_chunks(chunk_text_with_pages(pages_data), filename)
        if not chunks:
            return {
                "success": False,
                "message": "No chunks created",
                "chunks_added": 0,
                "filename": filename,
            }

        notify("embedding", f"Embedding {len(chunks)} chunks")
        embeddings, success_indices = embed_texts(chunks)
        successful = [chunks[i] for i in success_indices]
        if not successful:
            return {
                "success": False,
                "message": "Embedding failed",
                "chunks_added": 0,
                "filename": filename,
            }

        sanitized = filename.replace(" ", "").replace("'", "")
        chunk_texts = [_chunk_storage_text(c) for c in successful]
        ids = [_hash(f"{url}-{i}") for i in success_indices]
        metas = [
            {
                "source": sanitized,
                "url": url,
                "filename": filename,
                "page_number": successful[idx]["page_num"],
                "heading": successful[idx].get("heading", ""),
                "chunk_index": success_indices[idx],
            }
            for idx in range(len(successful))
        ]

        notify("indexing", f"Storing {len(successful)} chunks in ChromaDB")
        vs.upsert_chunks(chunk_texts, embeddings, metas, ids)
        _update_website_index(url, filename, len(successful))

        return {
            "success": True,
            "message": f"Indexed {filename}",
            "chunks_added": len(successful),
            "filename": filename,
        }
    except Exception as e:
        log(f"Error ingesting {url}: {e}")
        return {
            "success": False,
            "message": str(e),
            "chunks_added": 0,
            "filename": filename,
        }


def process_crawl_job(
    job_id: str,
    base_url: str,
    max_pages: int,
    max_depth: int,
) -> None:
    channel = f"crawl:job:{job_id}"

    publish_event(
        channel,
        {
            "status": "started",
            "base_url": base_url,
            "max_pages": max_pages,
            "max_depth": max_depth,
        },
    )

    def on_url_discovered(url, depth, file_type, count):
        publish_event(
            channel,
            {
                "status": "discovered",
                "url": url,
                "depth": depth,
                "file_type": file_type,
                "count": count,
            },
        )

    try:
        publish_event(channel, {"status": "crawling", "message": "Discovering pages..."})
        urls = get_internal_links(
            base_url,
            max_pages=max_pages,
            max_depth=max_depth,
            on_url_discovered=on_url_discovered,
            stop_check=lambda: should_stop(job_id),
        )

        if should_stop(job_id):
            publish_event(channel, {"status": "crawling_stop", "message": "Crawl stopped"})
            return

        publish_event(
            channel,
            {"status": "discovered_total", "total": len(urls), "message": f"Found {len(urls)} URLs"},
        )

        ok = 0
        failed = 0
        for i, url in enumerate(urls):
            if should_stop(job_id):
                publish_event(channel, {"status": "crawling_stop", "message": "Crawl stopped"})
                return

            publish_event(
                channel,
                {
                    "status": "ingesting",
                    "url": url,
                    "progress": i + 1,
                    "total": len(urls),
                },
            )
            result = ingest_single_url(url, overwrite=True, job_id=job_id)
            if result["success"]:
                ok += 1
            else:
                failed += 1

        publish_event(
            channel,
            {
                "status": "completed",
                "successful": ok,
                "failed": failed,
                "total": len(urls),
            },
        )
    except Exception as e:
        publish_event(channel, {"status": "failed", "message": str(e)})


def process_faq_ingest_job(job_id: str, urls: Optional[List[str]] = None) -> None:
    """Ingest only pre-defined FAQ URLs (no site-wide crawl)."""
    channel = f"crawl:job:{job_id}"
    target_urls = urls or config.FAQ_URLS

    publish_event(
        channel,
        {
            "status": "started",
            "mode": "faq_only",
            "total": len(target_urls),
        },
    )

    ok = 0
    failed = 0
    for i, url in enumerate(target_urls):
        if should_stop(job_id):
            publish_event(channel, {"status": "crawling_stop", "message": "Ingest stopped"})
            return

        publish_event(
            channel,
            {
                "status": "ingesting",
                "url": url,
                "progress": i + 1,
                "total": len(target_urls),
            },
        )
        result = ingest_single_url(url, overwrite=True, job_id=job_id)
        if result["success"]:
            ok += 1
        else:
            failed += 1

    publish_event(
        channel,
        {
            "status": "completed",
            "successful": ok,
            "failed": failed,
            "total": len(target_urls),
        },
    )
