from collections import deque
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
import urllib.robotparser
from typing import List, Set, Dict, Any, Optional, Deque, Tuple
import time
import random
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor as _ThreadPool

from config import USER_AGENTS

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

# ─── Production Constants ────────────────────────────────────────────
CRAWL_TIMEOUT_SECONDS = 600
MAX_RETRIES = 3
CONCURRENCY = 5
CONTEXT_REFRESH_EVERY = 50
PAGE_TIMEOUT_MS = 20_000
SPA_RENDER_WAIT_MS = 1000

# ─── Smart Traps ─────────────────────────────────────────────────────
PATH_TRAPS = (
    "/special:", "/talk:", "/user:", "/file:",
    "/category:", "/template:", "/help:",
)
QUERY_TRAPS = (
    "action=", "oldid=", "diff=", "printable=", "sort=",
    "limit=", "offset=", "returnto=",
    "file:", "special:", "talk:", "user:",
    "category:", "template:", "help:",
    "file%3a", "special%3a", "talk%3a", "user%3a",
    "category%3a", "template%3a", "help%3a",
)

IGNORE_EXTENSIONS = (
    ".css", ".js", ".zip", ".tar", ".gz", ".mp4", ".mp3",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
    ".woff", ".woff2", ".ttf", ".eot", ".ico",
)

DOC_EXTENSIONS = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx")


# ─── Utility Functions ───────────────────────────────────────────────

def is_trap(url: str) -> bool:
    lower_url = url.lower()
    parsed = urlparse(lower_url)
    if any(trap in parsed.path for trap in PATH_TRAPS):
        return True
    if any(trap in parsed.query for trap in QUERY_TRAPS):
        return True
    return False


def normalize_host(netloc: str) -> str:
    """Lower-case host and drop a leading 'www.' so www / non-www are treated as the same site."""
    host = netloc.lower()
    return host[4:] if host.startswith("www.") else host


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    normalized = f"{parsed.scheme}://{parsed.netloc}{path}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


def get_robots_parser(base_url: str):
    parsed = urlparse(base_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
    except Exception:
        pass
    return rp


def _is_doc_url(url: str) -> bool:
    lower = url.lower()
    return any(lower.endswith(ext) or (ext + "?") in lower for ext in DOC_EXTENSIONS)


def _should_ignore(url: str) -> bool:
    lower = url.lower()
    return any(
        lower.endswith(ext) or (ext + "?") in lower or (ext + "&") in lower
        for ext in IGNORE_EXTENSIONS
    )


def _robots_loaded(rp: urllib.robotparser.RobotFileParser) -> bool:
    """Check if robots.txt was actually fetched and parsed."""
    return bool(getattr(rp, "entries", None))


def _extract_links(html: str, current_url: str, base_domain: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag.get("href", "")
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue

        full_url = urljoin(current_url, href).split("#")[0]
        parsed_url = urlparse(full_url)

        if normalize_host(parsed_url.netloc) != normalize_host(base_domain):
            continue
        if _should_ignore(full_url):
            continue

        norm_url = normalize_url(full_url)
        if is_trap(norm_url):
            continue

        links.append(norm_url)
    return links


# ─── Async Crawler Engine ────────────────────────────────────────────

async def _fetch_with_retry(page, url: str, retries: int = MAX_RETRIES):
    for attempt in range(retries):
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
            return response
        except Exception:
            if attempt < retries - 1:
                wait = 2 ** attempt
                logger.warning(
                    f"[CRAWLER] Attempt {attempt + 1}/{retries} failed for {url}, "
                    f"retrying in {wait}s..."
                )
                await asyncio.sleep(wait)
            else:
                raise


async def _crawl_async(
    base_url: str,
    max_pages: int,
    max_depth: int,
    count_only: bool,
    on_url_discovered=None,
    stop_check=None,
):
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

    rp = get_robots_parser(base_url)
    robots_ok = _robots_loaded(rp)
    base_domain = urlparse(base_url).netloc
    user_agent = random.choice(USER_AGENTS)

    visited: Set[str] = set()
    discovered: List[str] = []
    discovered_set: Set[str] = set()
    html_count = pdf_count = doc_count = 0
    pages_processed = 0
    crawl_start = time.time()

    start_url = normalize_url(base_url)
    queue: Deque[Tuple[str, int]] = deque([(start_url, 0)])
    visited.add(start_url)

    browser = None
    context = None
    worker_pages: list = []

    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True)

            async def _create_context():
                ctx = await browser.new_context(
                    user_agent=user_agent,
                    viewport={"width": 1280, "height": 800},
                )
                await ctx.route(
                    "**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,mp4,mp3,avi,flv,mov,wmv,ico,eot}",
                    lambda route: route.abort(),
                )
                return ctx

            async def _create_workers(ctx, count):
                return [await ctx.new_page() for _ in range(count)]

            context = await _create_context()
            worker_pages = await _create_workers(context, CONCURRENCY)

            def _add_discovered(url: str, depth: int, file_type: str):
                """Deduplicated append to discovered list."""
                nonlocal html_count, pdf_count, doc_count
                if url in discovered_set:
                    return
                if len(discovered) >= max_pages:
                    return
                discovered_set.add(url)
                discovered.append(url)
                if file_type == "pdf":
                    pdf_count += 1
                elif file_type == "doc":
                    doc_count += 1
                else:
                    html_count += 1
                elapsed_s = time.time() - crawl_start
                logger.info(
                    f"[CRAWLER] [{elapsed_s:.1f}s] Found #{len(discovered)} "
                    f"[{file_type.upper()}] (Depth {depth}): {url}"
                )
                if on_url_discovered:
                    on_url_discovered(url, depth, file_type, len(discovered))

            async def _process_url(page, url: str, depth: int) -> List[tuple]:
                nonlocal pages_processed

                await asyncio.sleep(random.uniform(0.2, 0.6))

                try:
                    response = await _fetch_with_retry(page, url)
                    if response is None or response.status >= 400:
                        if response and response.status >= 400:
                            logger.warning(f"[CRAWLER] HTTP {response.status} for {url}")
                        return []

                    content_type = response.headers.get("content-type", "").lower()
                    is_pdf = "application/pdf" in content_type
                    is_doc = (
                        "application/msword" in content_type
                        or "officedocument.wordprocessingml" in content_type
                    )

                    if not ("text/html" in content_type or is_pdf or is_doc):
                        return []

                    if is_pdf:
                        file_type = "pdf"
                    elif is_doc:
                        file_type = "doc"
                    else:
                        file_type = "html"

                    _add_discovered(url, depth, file_type)
                    pages_processed += 1

                    if file_type == "html":
                        await page.wait_for_timeout(SPA_RENDER_WAIT_MS)
                        content = await page.content()
                        new_links = _extract_links(content, url, base_domain)
                        return [(link, depth + 1) for link in new_links]

                    return []

                except PlaywrightTimeout:
                    logger.warning(f"[CRAWLER] Timeout at {url} (skipping)")
                    return []
                except Exception as e:
                    if "Download is starting" in str(e):
                        _add_discovered(url, depth, "file")
                    else:
                        logger.warning(f"[CRAWLER] Error at {url}: {e}")
                    return []

            # ─── Main Crawl Loop ─────────────────────────────────
            while queue and len(discovered) < max_pages:
                elapsed = time.time() - crawl_start
                if elapsed > CRAWL_TIMEOUT_SECONDS:
                    logger.warning(
                        f"[CRAWLER] Crawl timeout reached ({CRAWL_TIMEOUT_SECONDS}s). Stopping."
                    )
                    break

                if stop_check and stop_check():
                    logger.info("[CRAWLER] Stop signal received. Aborting crawl.")
                    break

                if pages_processed > 0 and pages_processed % CONTEXT_REFRESH_EVERY == 0:
                    logger.info(
                        f"[CRAWLER] Refreshing browser context (after {pages_processed} pages)..."
                    )
                    for pg in worker_pages:
                        await pg.close()
                    await context.close()
                    context = await _create_context()
                    worker_pages = await _create_workers(context, CONCURRENCY)

                batch: List[Tuple[str, int]] = []
                while queue and len(batch) < CONCURRENCY:
                    url, depth = queue.popleft()

                    if depth > max_depth:
                        continue

                    if robots_ok and not rp.can_fetch(user_agent, url):
                        logger.info(f"[CRAWLER] Skipping {url} (robots.txt)")
                        continue

                    if _is_doc_url(url):
                        lower = url.lower()
                        ft = "pdf" if ".pdf" in lower else "doc"
                        _add_discovered(url, depth, ft)
                        continue

                    if len(discovered) + len(batch) >= max_pages:
                        break

                    batch.append((url, depth))

                if not batch:
                    if not queue:
                        break
                    continue

                logger.info(f"[CRAWLER] Processing batch of {len(batch)} URLs concurrently...")
                tasks = [
                    _process_url(worker_pages[i % len(worker_pages)], url, depth)
                    for i, (url, depth) in enumerate(batch)
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, Exception):
                        logger.warning(f"[CRAWLER] Batch error: {result}")
                        continue
                    if isinstance(result, list):
                        for link, new_depth in result:
                            if link not in visited:
                                visited.add(link)
                                queue.append((link, new_depth))

        finally:
            logger.info("[CRAWLER] Cleaning up browser resources...")
            for pg in worker_pages:
                try:
                    await pg.close()
                except Exception:
                    pass
            if context:
                try:
                    await context.close()
                except Exception:
                    pass
            if browser:
                try:
                    await browser.close()
                except Exception:
                    pass

    elapsed = time.time() - crawl_start
    logger.info(
        f"\n[CRAWLER] Crawl complete for {base_url}. "
        f"Found {len(discovered)} pages in {elapsed:.1f}s."
    )

    if count_only:
        return {
            "total_pages": len(discovered),
            "html_pages": html_count,
            "pdf_pages": pdf_count,
            "doc_pages": doc_count,
        }
    return discovered


# ─── Sync Wrappers (safe for FastAPI/uvicorn) ────────────────────────

def _crawl(
    base_url: str,
    max_pages: int,
    max_depth: int,
    count_only: bool,
    on_url_discovered=None,
    stop_check=None,
):
    try:
        import playwright  # noqa: F401
    except ImportError:
        logger.error(
            "[CRAWLER] Playwright not installed. "
            "Run: pip install playwright && playwright install chromium"
        )
        if count_only:
            return {"total_pages": 0, "html_pages": 0, "pdf_pages": 0, "doc_pages": 0}
        return []

    def _run_in_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(
                _crawl_async(
                    base_url, max_pages, max_depth, count_only,
                    on_url_discovered, stop_check,
                )
            )
        finally:
            loop.close()

    with _ThreadPool(max_workers=1) as executor:
        future = executor.submit(_run_in_thread)
        return future.result()


def get_internal_links(
    base_url: str,
    max_pages: int = 500,
    max_depth: int = 3,
    on_url_discovered=None,
    stop_check=None,
) -> List[str]:
    logger.info(
        f"\n[CRAWLER] Starting discovery crawl for {base_url} "
        f"(Max: {max_pages}, Depth: {max_depth})"
    )
    return _crawl(
        base_url, max_pages, max_depth, count_only=False,
        on_url_discovered=on_url_discovered, stop_check=stop_check,
    )


def count_website_pages(base_url: str, max_pages: int = 500, max_depth: int = 3) -> dict:
    logger.info(
        f"\n[COUNTER] Starting page count for: {base_url} "
        f"(Max: {max_pages}, Depth: {max_depth})"
    )
    return _crawl(base_url, max_pages, max_depth, count_only=True)
