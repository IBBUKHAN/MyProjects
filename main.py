"""UIDAI Chatbot FastAPI application."""

import asyncio
import json
import logging
import uuid
from typing import AsyncIterator

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

import config
from core.ingestion import ingest_single_url, process_crawl_job, process_faq_ingest_job
from core.job_events import get_events_since, publish_event, request_stop
from core.vector_store import VectorStore
from schemas import (
    ChatRequest,
    ChatResponse,
    CrawlWebsiteRequest,
    CrawlWebsiteResponse,
    IngestUrlRequest,
    IngestUrlResponse,
    TtsTestRequest,
)
from services.rag_service import answer_with_rag, answer_with_rag_stream
from services.tts_service import synthesize_tts, tts_media_type, tts_stream_format

# Suppress noisy per-request logs from httpx (ElevenLabs TTS, etc.)
for _logger_name in ("httpx", "httpcore", "httpcore.http11", "httpcore.connection"):
    logging.getLogger(_logger_name).setLevel(logging.WARNING)

app = FastAPI(
    title="UIDAI Chatbot API",
    description="RAG chatbot with web scraping, ChromaDB, and SSE streaming",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    VectorStore.get_instance()
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[STARTUP] ChromaDB ready at {config.CHROMA_DB_DIR}")


def verify_admin(authorization: str = Header(default="")) -> bool:
    token = authorization.replace("Bearer ", "").strip()
    if token != config.ADMIN_API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return True


@app.get("/health")
def health():
    vs = VectorStore.get_instance()
    return {
        "status": "ok",
        "collection": config.CHROMA_COLLECTION_NAME,
        "documents_indexed": vs.collection.count(),
    }


@app.post("/chat/query", response_model=ChatResponse)
def chat_query(payload: ChatRequest):
    result = answer_with_rag(
        question=payload.question,
        session_id=payload.session_id,
        top_k=payload.top_k,
    )
    return ChatResponse(**result)


@app.post("/chat/query/stream")
async def chat_query_stream(payload: ChatRequest):
    async def event_generator() -> AsyncIterator[str]:
        try:
            async for event in answer_with_rag_stream(
                question=payload.question,
                session_id=payload.session_id,
                top_k=payload.top_k,
                enable_audio=payload.enable_audio,
            ):
                yield f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"
        except Exception as e:
            error = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/admin/tts-test")
async def admin_tts_test(payload: TtsTestRequest, _: bool = Depends(verify_admin)):
    """Convert text to audio using ElevenLabs — for Postman voice testing."""
    try:
        audio = await synthesize_tts(payload.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    ext = tts_stream_format()
    return Response(
        content=audio,
        media_type=tts_media_type(),
        headers={"Content-Disposition": f'inline; filename="tts-test.{ext}"'},
    )


@app.post("/admin/crawl-website", response_model=CrawlWebsiteResponse)
def admin_crawl_website(
    payload: CrawlWebsiteRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_admin),
):
    job_id = str(uuid.uuid4())[:8]
    max_pages = payload.max_pages or config.CRAWL_MAX_PAGES
    max_depth = payload.max_depth or config.CRAWL_MAX_DEPTH

    background_tasks.add_task(
        process_crawl_job,
        job_id,
        payload.base_url,
        max_pages,
        max_depth,
    )

    return CrawlWebsiteResponse(
        success=True,
        message=(
            f"Crawl started for {payload.base_url}. "
            f"Track progress at GET /admin/crawl-status/{job_id}"
        ),
        job_id=job_id,
    )


@app.get("/admin/crawl-status/{job_id}")
async def admin_crawl_status(job_id: str, _: bool = Depends(verify_admin)):
    channel = f"crawl:job:{job_id}"
    terminal = {"completed", "failed", "crawling_stop", "error"}

    async def event_generator() -> AsyncIterator[str]:
        yield f"data: {json.dumps({'status': 'connected', 'job_id': job_id})}\n\n"
        cursor = 0
        while True:
            new_events, cursor = get_events_since(channel, cursor)
            for data in new_events:
                yield f"data: {data}\n\n"
                try:
                    if json.loads(data).get("status") in terminal:
                        return
                except json.JSONDecodeError:
                    pass
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/admin/stop-crawl/{job_id}")
def admin_stop_crawl(job_id: str, _: bool = Depends(verify_admin)):
    request_stop(job_id)
    publish_event(
        f"crawl:job:{job_id}",
        {"status": "crawling_stop", "message": "Stop signal sent"},
    )
    return {"success": True, "message": f"Stop signal sent for job {job_id}"}


@app.post("/admin/ingest-url", response_model=IngestUrlResponse)
def admin_ingest_url(payload: IngestUrlRequest, _: bool = Depends(verify_admin)):
    result = ingest_single_url(payload.url, overwrite=True)
    return IngestUrlResponse(
        success=result["success"],
        message=result["message"],
        chunks_added=result.get("chunks_added", 0),
        filename=result.get("filename"),
    )


@app.post("/admin/ingest-faqs", response_model=CrawlWebsiteResponse)
def admin_ingest_faqs(
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_admin),
):
    """Scrape and index only UIDAI FAQ pages (43 URLs in config.FAQ_URLS)."""
    job_id = str(uuid.uuid4())[:8]
    background_tasks.add_task(process_faq_ingest_job, job_id)
    return CrawlWebsiteResponse(
        success=True,
        message=(
            f"FAQ ingest started for {len(config.FAQ_URLS)} pages. "
            f"Track at GET /admin/crawl-status/{job_id}"
        ),
        job_id=job_id,
    )


@app.post("/admin/reindex")
def admin_reindex(
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_admin),
):
    """Reset ChromaDB and re-ingest FAQ pages only."""
    vs = VectorStore.get_instance()
    vs.reset_collection()

    job_id = str(uuid.uuid4())[:8]
    background_tasks.add_task(process_faq_ingest_job, job_id)

    return {
        "success": True,
        "message": f"FAQ reindex started for {len(config.FAQ_URLS)} pages",
        "job_id": job_id,
    }


@app.get("/admin/faq-urls")
def admin_faq_urls(_: bool = Depends(verify_admin)):
    return {"count": len(config.FAQ_URLS), "urls": config.FAQ_URLS}


@app.get("/admin/websites")
def admin_list_websites(_: bool = Depends(verify_admin)):
    from core.ingestion import _load_website_index

    return _load_website_index()
