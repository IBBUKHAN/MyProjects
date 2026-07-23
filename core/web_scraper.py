"""Generic web page scraper — Playwright + markdown, no domain-specific filters."""

import random
import re
import threading
from typing import Any, Dict, List, Optional

from markdownify import markdownify as md

from config import USER_AGENTS

_EXTRACT_JS = """() => {
    document.querySelectorAll(
        'script, style, noscript, iframe, svg, img, video, audio, canvas'
    ).forEach(el => el.remove());

    const main = document.querySelector(
        'main, article, #content, .content, .content-area, [role="main"]'
    );
    if (main) return main.innerHTML;

    document.querySelectorAll(
        'header, footer, nav, aside, .sidebar, .menu, .navbar'
    ).forEach(el => el.remove());
    return document.body ? document.body.innerHTML : '';
}"""

PAGE_TIMEOUT_MS = 30_000


class _BrowserPool:
    def __init__(self):
        self._pw = None
        self._browser = None
        self._lock = threading.Lock()

    def _ensure_browser(self):
        if self._browser and self._browser.is_connected():
            return
        from playwright.sync_api import sync_playwright

        if self._pw is None:
            self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)

    def get_page(self, user_agent: str):
        with self._lock:
            self._ensure_browser()
        ctx = self._browser.new_context(
            user_agent=user_agent,
            viewport={"width": 1920, "height": 1080},
        )
        ctx.route(
            "**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,mp4,mp3,ico}",
            lambda route: route.abort(),
        )
        return ctx, ctx.new_page()


_pool = _BrowserPool()


def _normalize_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def _split_by_headings(markdown_text: str) -> List[Dict[str, Any]]:
    lines = markdown_text.split("\n")
    sections: List[Dict[str, Any]] = []
    heading = ""
    block: List[str] = []
    idx = 1

    def flush():
        nonlocal idx
        body = "\n".join(block).strip()
        if len(body) > 20:
            sections.append({"page_num": idx, "text": body, "heading": heading})
            idx += 1
        block.clear()

    for line in lines:
        if re.match(r"^#{1,4}\s+", line.strip()):
            flush()
            heading = re.sub(r"^#{1,4}\s+", "", line.strip())
            block.append(line)
        else:
            block.append(line)

    flush()
    if not sections and markdown_text.strip():
        sections.append({"page_num": 1, "text": markdown_text.strip(), "heading": ""})
    return sections


def extract_website_text(url: str) -> List[Dict[str, Any]]:
    """Fetch URL, extract main content, return heading-based sections."""
    print(f"[WEB_SCRAPER] {url}")
    ctx: Optional[object] = None

    try:
        ctx, page = _pool.get_page(random.choice(USER_AGENTS))
        page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
        page.wait_for_timeout(1500)
        html = page.evaluate(_EXTRACT_JS)
    except Exception as e:
        print(f"[WEB_SCRAPER] Failed: {e}")
        return []
    finally:
        if ctx:
            try:
                ctx.close()
            except Exception:
                pass

    if not html or not str(html).strip():
        return []

    markdown = _normalize_text(md(html, heading_style="ATX"))
    if not markdown:
        return []

    sections = _split_by_headings(markdown)
    print(f"[WEB_SCRAPER] {len(markdown)} chars, {len(sections)} sections")
    return sections
