"""RAG pipeline with streaming SSE support for UIDAI chatbot."""

import base64
import time
import uuid
from datetime import datetime
from typing import Any, AsyncIterator, Dict, List, Optional

from google import genai
from google.genai import types
from starlette.concurrency import run_in_threadpool

import config
from core.vector_store import VectorStore
from services.tts_service import (
    synthesize_tts,
    tts_sample_rate,
    tts_stream_format,
)

gemini_client = genai.Client(api_key=config.GOOGLE_API_KEY)

_session_history: Dict[str, List[Dict[str, str]]] = {}
MAX_HISTORY = 5
_HISTORY_ANSWER_CHARS = 300


def resolve_session_id(session_id: Optional[str]) -> str:
    """Use provided session_id; generate a UUID if null/empty."""
    if session_id is None or not str(session_id).strip():
        return str(uuid.uuid4())
    return str(session_id).strip()


def get_session_history(session_id: str) -> List[Dict[str, str]]:
    return _session_history.get(session_id, [])[-MAX_HISTORY:]


def add_to_history(session_id: str, question: str, answer: str) -> None:
    if session_id not in _session_history:
        _session_history[session_id] = []
    _session_history[session_id].append({"user": question, "assistant": answer})
    _session_history[session_id] = _session_history[session_id][-MAX_HISTORY:]


def _format_history_for_prompt(
    history: List[Dict[str, str]],
    truncate_answers: bool = False,
) -> str:
    if not history:
        return "No previous conversation.\n"
    parts = []
    for turn in history:
        answer = turn["assistant"]
        if truncate_answers and len(answer) > _HISTORY_ANSWER_CHARS:
            answer = answer[:_HISTORY_ANSWER_CHARS].rstrip() + "..."
        parts.append(f"User: {turn['user']}\nAssistant: {answer}")
    return "\n\n".join(parts) + "\n\n"


def rewrite_query_for_retrieval(
    question: str,
    history: List[Dict[str, str]],
) -> str:
    """Rewrite follow-ups into a standalone search query. Uses original question if alone."""
    if not history:
        return question

    history_text = _format_history_for_prompt(history, truncate_answers=True)
    prompt = f"""Given the conversation history and the latest user question, rewrite the latest question as a standalone search query for a UIDAI / Aadhaar knowledge base.

    Rules:
    - Resolve pronouns and references using history (it, them, this, that, etc.).
    - Keep the same intent and language as the user question.
    - If the question is already self-contained, return it unchanged.
    - Output ONLY the rewritten query — no quotes, labels, or explanation.

    Conversation History:
    {history_text}
    Latest Question:
    {question}

    Standalone search query:"""

    try:
        response = gemini_client.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.0),
        )
        rewritten = (response.text or "").strip().strip('"').strip("'")
        if rewritten:
            print(f"[RAG] Query rewrite: {question!r} -> {rewritten!r}")
            return rewritten
    except Exception as e:
        print(f"[RAG] Query rewrite failed, using original: {e}")

    return question


def embed_query(query: str) -> List[float]:
    result = gemini_client.models.embed_content(
        model=config.GEMINI_EMBEDDING_MODEL,
        contents=query,
    )
    return result.embeddings[0].values


def build_prompt(
    question: str,
    docs: List[str],
    metadatas: List[Dict[str, Any]],
    history: List[Dict[str, str]],
) -> str:
    history_text = _format_history_for_prompt(history)

    context_blocks = []
    for doc, meta in zip(docs, metadatas):
        source = meta.get("source", "Unknown")
        url = meta.get("url", "Unknown")
        context_blocks.append(f"[SOURCE: {source} | URL: {url}]\n{doc}")

    context = "\n\n---\n\n".join(context_blocks) if context_blocks else "(empty)"
    today = datetime.now().strftime("%d %B %Y")

    return f"""You are {config.BOT_NAME}, the official digital helper for {config.BOT_DOMAIN}.
    Today's date: {today}

    Persona / identity (strict):
    - Your name is Aadhaar Sevak. You are a female digital assistant (she/her). UIDAI created you.
    - Never mention Google, Gemini, ChatGPT, OpenAI, LLM, or any model vendor.

    Guidelines:
    - Language (strict): reply in the SAME language as the user's question. If they ask in Hindi/Hinglish, answer in Hindi/Hinglish — do not default to English even if the knowledge base is English; translate the facts.
    - Answer from the knowledge base below only.
    - If the answer is not there, say so briefly (in the user's language) and append [NOT_FOUND] on a new line.
    - Keep answers short and structured:
    - Start with 1 short lead sentence (optional).
    - Use bullet points for steps, options, or key facts.
    - Prefer 3–8 bullets; max ~250 words total.
    - Do not repeat the same idea; no long paragraphs.
    - Include a link only if it is essential and present in the knowledge base.

    Conversation History:
    {history_text}

    User Question:
    {question}

    Knowledge Base:
    {context}

    Provide a short structured answer.
    """


def _merge_context(
    docs: List[str],
    metadatas: List[Dict[str, Any]],
    distances: List[float],
    max_tokens: int = 5000,
):
    merged_docs, merged_metas, merged_dist = [], [], []
    seen = set()
    total = 0.0
    for doc, meta, dist in zip(docs, metadatas, distances):
        key = doc[:200]
        if key in seen:
            continue
        seen.add(key)
        tokens = len(doc.split()) * 1.3
        if total + tokens > max_tokens:
            break
        merged_docs.append(doc)
        merged_metas.append(meta)
        merged_dist.append(dist)
        total += tokens
    return merged_docs, merged_metas, merged_dist


def _build_sources(docs: List[str], metadatas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sources = []
    for doc, meta in zip(docs, metadatas):
        heading = (meta.get("heading") or "").strip()
        snippet = doc[:300] + ("..." if len(doc) > 300 else "")
        if heading:
            snippet = f"{heading}\n{snippet}"
        sources.append(
            {
                "source": meta.get("source", "Unknown"),
                "url": meta.get("url", ""),
                "snippet": snippet[:400],
                "heading": heading or None,
            }
        )
    return sources


def _compute_confidence(distances: List[float]) -> float:
    if not distances:
        return 0.0
    avg = sum(distances) / len(distances)
    return max(0.0, min(1.0, 1.0 - avg))


def generate_answer(prompt: str) -> str:
    try:
        response = gemini_client.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        return response.text.strip()
    except Exception as e:
        print(f"[RAG] LLM error: {e}")
        return "Sorry, I encountered an error. Please try again."


async def generate_answer_stream(prompt: str) -> AsyncIterator[str]:
    try:
        response = await gemini_client.aio.models.generate_content_stream(
            model=config.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        async for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        print(f"[RAG] Stream error: {e}")
        yield "Sorry, I encountered an error. Please try again."


def answer_with_rag(
    question: str,
    session_id: Optional[str] = None,
    top_k: int = 5,
) -> Dict[str, Any]:
    from services.agent_service import run_agent

    session_id = resolve_session_id(session_id)
    history = get_session_history(session_id)
    result = run_agent(question, history)
    answer = result["answer"]
    not_found = bool(result.get("notFound"))

    add_to_history(session_id, question, answer)
    return {
        "answer": answer,
        "sources": result.get("sources") or [],
        "confidence": float(result.get("confidence") or 0.0),
        "session_id": session_id,
        "userToken": session_id,
        "notFound": not_found,
    }


async def answer_with_rag_stream(
    question: str,
    session_id: Optional[str] = None,
    top_k: int = 5,
    enable_audio: bool = False,
) -> AsyncIterator[Dict[str, Any]]:
    from services.agent_service import stream_agent, strip_location_from_answer

    start = time.time()
    session_id = resolve_session_id(session_id)
    yield {
        "type": "status",
        "step": "agent",
        "message": "Working on your request...",
    }

    history = await run_in_threadpool(get_session_history, session_id)

    use_audio = enable_audio and bool(config.ELEVENLABS_API_KEY and config.ELEVENLABS_VOICE_ID)
    if enable_audio and not use_audio:
        print("[RAG] enable_audio=true but ElevenLabs is not configured")

    streamed_text = ""
    result: Dict[str, Any] | None = None
    tools_announced: set[str] = set()

    async for event in stream_agent(question, history):
        kind = event.get("kind")
        if kind == "tool_start":
            name = event.get("name") or ""
            if name in tools_announced:
                continue
            tools_announced.add(name)
            if name == "find_aadhaar_centres_by_pincode":
                yield {
                    "type": "status",
                    "step": "centres",
                    "message": "Finding nearby centres for you...",
                }
            elif name == "search_knowledge_base":
                yield {
                    "type": "status",
                    "step": "search",
                    "message": "Looking that up for you...",
                }
            else:
                yield {
                    "type": "status",
                    "step": "tool",
                    "message": "Working on your request...",
                }
        elif kind == "token":
            if not streamed_text:
                yield {
                    "type": "status",
                    "step": "generate",
                    "message": "Putting the answer together...",
                }
            text = event.get("text") or ""
            if not text:
                continue
            streamed_text += text
            yield {"type": "answer_chunk", "content": text}
        elif kind == "final":
            result = event.get("result") or {}

    if result is None:
        result = {
            "answer": strip_location_from_answer(streamed_text)
            or "Sorry, I could not generate an answer. Please try again.",
            "sources": [],
            "confidence": 0.0,
            "notFound": False,
            "tools_used": sorted(tools_announced),
        }

    # Prefer cleaned final answer for history (map links stripped)
    full_answer = result.get("answer") or strip_location_from_answer(streamed_text)
    sources = result.get("sources") or []
    confidence = float(result.get("confidence") or 0.0)
    not_found = bool(result.get("notFound"))
    tools_used = result.get("tools_used") or sorted(tools_announced)

    # If model streamed text but final strip differs, client already got tokens;
    # history stores the cleaned version.
    add_to_history(session_id, question, full_answer)

    # Full audio before sources so UI can start playback sooner
    if use_audio and full_answer:
        try:
            audio = await synthesize_tts(full_answer)
            event: Dict[str, Any] = {
                "type": "audio_chunk",
                "seq": 1,
                "format": tts_stream_format(),
                "data": base64.b64encode(audio).decode("ascii"),
                "complete": True,
            }
            sample_rate = tts_sample_rate()
            if sample_rate:
                event["sample_rate"] = sample_rate
            yield event
            yield {"type": "audio_done", "total_chunks": 1}
        except Exception as e:
            print(f"[RAG] TTS error: {e}")
            yield {"type": "audio_error", "message": str(e)}

    if "find_aadhaar_centres_by_pincode" in tools_used:
        yield {"type": "maps", "data": [] if not_found else sources}
    else:
        yield {"type": "sources", "data": [] if not_found else sources}
    yield {
        "type": "metadata",
        "confidence": confidence,
        "userToken": session_id,
        "notFound": not_found,
        "audioEnabled": use_audio,
        "toolsUsed": tools_used,
        "timing": {"total": time.time() - start},
    }
