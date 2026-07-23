"""In-memory pub/sub for crawl/ingest SSE progress (no Redis required)."""

import json
import threading
import time
from collections import defaultdict
from typing import Any, Dict, Iterator, List, Optional

_lock = threading.Lock()
_subscribers: Dict[str, List[threading.Event]] = defaultdict(list)
_event_log: Dict[str, List[str]] = defaultdict(list)
_stop_flags: Dict[str, bool] = {}


def publish_event(channel: str, payload: Dict[str, Any]) -> None:
    data = json.dumps(payload, ensure_ascii=False, default=str)
    with _lock:
        _event_log[channel].append(data)
        for event in _subscribers[channel]:
            event.set()


def get_events_since(channel: str, cursor: int) -> tuple[List[str], int]:
    with _lock:
        events = _event_log.get(channel, [])
        if cursor >= len(events):
            return [], cursor
        return events[cursor:], len(events)


def subscribe(channel: str) -> Iterator[str]:
    """Yield SSE data lines for a channel until terminal status."""
    terminal = {"completed", "failed", "crawling_stop", "error"}
    cursor = 0

    while True:
        with _lock:
            events = _event_log.get(channel, [])
            while cursor < len(events):
                yield events[cursor]
                cursor += 1
                try:
                    payload = json.loads(events[cursor - 1])
                    if payload.get("status") in terminal:
                        return
                except json.JSONDecodeError:
                    pass

        wait_event = threading.Event()
        with _lock:
            _subscribers[channel].append(wait_event)
        wait_event.wait(timeout=0.5)
        with _lock:
            if wait_event in _subscribers[channel]:
                _subscribers[channel].remove(wait_event)


def request_stop(job_id: str) -> None:
    with _lock:
        _stop_flags[job_id] = True


def should_stop(job_id: str) -> bool:
    with _lock:
        return _stop_flags.get(job_id, False)


def clear_job(job_id: str) -> None:
    channel = f"crawl:job:{job_id}"
    with _lock:
        _event_log.pop(channel, None)
        _subscribers.pop(channel, None)
        _stop_flags.pop(job_id, None)
