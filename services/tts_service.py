"""ElevenLabs streaming TTS with sentence buffering for realtime chat audio."""

import asyncio
import base64
import re
from typing import AsyncIterator, List, Optional

import httpx

import config

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n+")
_MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_MARKDOWN_CHARS_RE = re.compile(r"[*_#>`|]")


class SentenceBuffer:
    """Accumulate LLM tokens and emit speakable sentence-sized chunks."""

    MIN_CHARS = 40
    MAX_CHARS = 220

    def __init__(self) -> None:
        self._buf = ""

    def add(self, text: str) -> List[str]:
        if not text:
            return []
        self._buf += text
        return self._pop_ready()

    def flush(self) -> List[str]:
        remaining = self._buf.strip()
        self._buf = ""
        return [remaining] if remaining else []

    def _pop_ready(self) -> List[str]:
        ready: List[str] = []
        while self._buf:
            split_at = self._find_split_index()
            if split_at is None:
                break
            sentence = self._buf[:split_at].strip()
            self._buf = self._buf[split_at:].lstrip()
            if sentence:
                ready.append(sentence)
        return ready

    def _find_split_index(self) -> Optional[int]:
        for match in _SENTENCE_RE.finditer(self._buf):
            end = match.end()
            if end >= self.MIN_CHARS:
                return end
        if len(self._buf) >= self.MAX_CHARS:
            space = self._buf.rfind(" ", 0, self.MAX_CHARS)
            if space > 0:
                return space
            return self.MAX_CHARS
        return None


def strip_for_tts(text: str) -> str:
    """Remove markdown and markers that sound bad in speech."""
    text = text.replace("[NOT_FOUND]", "")
    text = _MARKDOWN_LINK_RE.sub(r"\1", text)
    text = _MARKDOWN_CHARS_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tts_stream_format() -> str:
    """Short format label for SSE events: pcm, mp3, etc."""
    fmt = config.ELEVENLABS_OUTPUT_FORMAT.lower()
    if fmt.startswith("pcm"):
        return "pcm"
    if "mp3" in fmt:
        return "mp3"
    return fmt.split("_")[0]


def tts_sample_rate() -> Optional[int]:
    fmt = config.ELEVENLABS_OUTPUT_FORMAT.lower()
    if fmt.startswith("pcm_"):
        try:
            return int(fmt.split("_", 1)[1])
        except ValueError:
            return None
    return None


def tts_media_type() -> str:
    rate = tts_sample_rate()
    if rate:
        return f"audio/L16; rate={rate}; channels=1"
    return "audio/mpeg"


def tts_accept_header() -> str:
    if tts_stream_format() == "pcm":
        return "audio/pcm"
    return "audio/mpeg"


def _build_tts_payload(text: str) -> dict:
    return {
        "text": text,
        "model_id": config.ELEVENLABS_MODEL_ID,
        "voice_settings": {
            "stability": config.ELEVENLABS_STABILITY,
            "similarity_boost": config.ELEVENLABS_SIMILARITY,
            "use_speaker_boost": config.ELEVENLABS_USE_SPEAKER_BOOST,
            "style": config.ELEVENLABS_STYLE,
            "speed": config.ELEVENLABS_SPEED,
        },
        "seed": config.ELEVENLABS_SEED,
    }


async def stream_tts(text: str) -> AsyncIterator[bytes]:
    """Stream audio bytes from ElevenLabs for a text segment."""
    if not text.strip():
        return
    if not config.ELEVENLABS_API_KEY or not config.ELEVENLABS_VOICE_ID:
        print("[TTS] Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID")
        return

    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/"
        f"{config.ELEVENLABS_VOICE_ID}/stream"
    )
    params = {
        "optimize_streaming_latency": config.ELEVENLABS_STREAMING_LATENCY,
        "output_format": config.ELEVENLABS_OUTPUT_FORMAT,
    }
    payload = _build_tts_payload(text)
    headers = {
        "xi-api-key": config.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": tts_accept_header(),
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST", url, params=params, json=payload, headers=headers
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    print(f"[TTS] ElevenLabs error {response.status_code}: {body[:200]!r}")
                    return
                async for chunk in response.aiter_bytes(chunk_size=4096):
                    if chunk:
                        yield chunk
    except Exception as e:
        print(f"[TTS] Stream error: {e}")


async def synthesize_tts(text: str) -> bytes:
    """Generate complete audio for a text snippet (for testing/download)."""
    clean = strip_for_tts(text)
    if not clean:
        raise ValueError("Text is empty after cleanup")
    if not config.ELEVENLABS_API_KEY or not config.ELEVENLABS_VOICE_ID:
        raise ValueError("ElevenLabs is not configured (ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID)")

    parts: List[bytes] = []
    async for chunk in stream_tts(clean):
        parts.append(chunk)
    audio = b"".join(parts)
    if not audio:
        raise ValueError("ElevenLabs returned no audio")
    return audio


class TtsPipeline:
    """Sequential TTS worker so audio chunks stay in sentence order."""

    _STOP = object()

    def __init__(self) -> None:
        self._input: asyncio.Queue = asyncio.Queue()
        self._output: asyncio.Queue = asyncio.Queue()
        self._task: Optional[asyncio.Task] = None
        self._seq = 0

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    async def enqueue(self, text: str) -> None:
        clean = strip_for_tts(text)
        if clean:
            await self._input.put(clean)

    async def stop(self) -> int:
        await self._input.put(self._STOP)
        if self._task:
            await self._task
        return self._seq

    def drain_events(self) -> List[dict]:
        events: List[dict] = []
        while True:
            try:
                events.append(self._output.get_nowait())
            except asyncio.QueueEmpty:
                break
        return events

    async def _run(self) -> None:
        while True:
            item = await self._input.get()
            if item is self._STOP:
                break
            try:
                async for chunk in stream_tts(item):
                    self._seq += 1
                    event = {
                        "type": "audio_chunk",
                        "seq": self._seq,
                        "format": tts_stream_format(),
                        "data": base64.b64encode(chunk).decode("ascii"),
                    }
                    sample_rate = tts_sample_rate()
                    if sample_rate:
                        event["sample_rate"] = sample_rate
                    await self._output.put(event)
            except Exception as e:
                print(f"[TTS] Pipeline error: {e}")
                await self._output.put({"type": "audio_error", "message": str(e)})
