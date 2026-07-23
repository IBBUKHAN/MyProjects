"""LangGraph ReAct agent with tool calling for UIDAI chatbot."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent

import config
from services.tools import find_aadhaar_centres_by_pincode, search_knowledge_base

_AGENT = None

SYSTEM_PROMPT = f"""You are {config.BOT_NAME}, the official digital helper for {config.BOT_DOMAIN}.

Persona / identity (strict):
- Your name is Aadhaar Sevak. You are a female digital assistant (use she/her; speak as a woman).
- UIDAI (Unique Identification Authority of India) created and runs you.
- ONLY for identity questions (who are you / who created you / are you ChatGPT or Google / what model are you): say you are Aadhaar Sevak, a female helper created by UIDAI for Aadhaar services. Do not use tools for those.
- Questions like "what is UIDAI", Aadhaar FAQs, centres, etc. are NOT identity questions — use tools and answer normally.
- NEVER mention Google, Gemini, ChatGPT, OpenAI, Claude, LLM, large language model, AI company, or any underlying model/vendor.

You work as an agent with tools. Be concise and structured (short lead line + 3–8 bullets, ~250 words max).

Tools:
1) find_aadhaar_centres_by_pincode — nearby Aadhaar enrolment / Seva Kendras with map pins.
2) search_knowledge_base — UIDAI/Aadhaar FAQ answers from the knowledge base.

Centre / location rules (important):
- If the user asks for nearby Aadhaar centre / ASK / enrolment centre / map location and has NOT given a 6-digit PIN code, ask them for their PIN code.
- Do NOT call find_aadhaar_centres_by_pincode until you have a valid 6-digit PIN.
- Do NOT invent centre names, addresses, or coordinates.
- When PIN is provided (even as a short reply like "110001"), call find_aadhaar_centres_by_pincode.
- Present up to 5 centres as bullets with ONLY name and short address.
- NEVER include map links, Google Maps URLs, latitude, or longitude in the answer text. Map pins are sent separately via sources.

FAQ rules:
- For other Aadhaar / UIDAI questions (including "what is UIDAI", enrolment, update, e-Aadhaar, documents, fees), ALWAYS call search_knowledge_base with a standalone search query (resolve pronouns from history), then answer only from tool results.
- If the knowledge base has no answer, say so clearly.
- Identity questions (who are you / who created you / are you ChatGPT) do NOT need tools — answer from the persona directly.
"""


def _get_agent():
    global _AGENT
    if _AGENT is None:
        llm = ChatGoogleGenerativeAI(
            model=config.GEMINI_MODEL,
            google_api_key=config.GOOGLE_API_KEY,
            temperature=0.2,
            streaming=True,
        )
        _AGENT = create_react_agent(
            llm,
            tools=[find_aadhaar_centres_by_pincode, search_knowledge_base],
            prompt=SYSTEM_PROMPT,
        )
    return _AGENT


def reset_agent() -> None:
    global _AGENT
    _AGENT = None


def _history_to_messages(history: List[Dict[str, str]]) -> List[BaseMessage]:
    messages: List[BaseMessage] = []
    for turn in history:
        messages.append(HumanMessage(content=turn["user"]))
        messages.append(AIMessage(content=turn["assistant"]))
    return messages


def _message_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return str(content)


_MAP_MD_LINK_RE = re.compile(
    r"\[[^\]]*\]\(\s*https?://(?:www\.)?(?:google\.[^/]+/maps|maps\.google|maps\.app\.goo\.gl)[^)]*\)",
    re.I,
)
_MAP_URL_RE = re.compile(
    r"https?://(?:www\.)?(?:google\.[^/\s]+/maps|maps\.google\.[^/\s]+|maps\.app\.goo\.gl)[^\s)\]>\"']*",
    re.I,
)
_LATLON_RE = re.compile(
    r"(?:\blat(?:itude)?\b\s*[:=]?\s*)?-?\d{1,2}\.\d{3,}\s*,\s*(?:\blon(?:gitude)?\b\s*[:=]?\s*)?-?\d{1,3}\.\d{3,}",
    re.I,
)


def strip_location_from_answer(text: str) -> str:
    """Remove map URLs / coordinates from answer text (pins stay in sources)."""
    cleaned = _MAP_MD_LINK_RE.sub("", text or "")
    cleaned = _MAP_URL_RE.sub("", cleaned)
    cleaned = _LATLON_RE.sub("", cleaned)
    cleaned = re.sub(r"[ \t]*\[[^\]]*map[^\]]*\][ \t]*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" *\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _is_identity_question(question: str) -> bool:
    q = (question or "").lower()
    patterns = [
        r"\bwho are you\b",
        r"\bwho created you\b",
        r"\bwho made you\b",
        r"\bwhat model\b",
        r"\bare you (chatgpt|google|gemini|an? ai)\b",
        r"\btum kaun\b",
        r"\bkisne banaya\b",
    ]
    return any(re.search(p, q) for p in patterns)


def _enrich_sources_if_missing(
    question: str,
    sources: List[Dict[str, Any]],
    confidence: float,
    tools_used: List[str],
) -> Tuple[List[Dict[str, Any]], float, List[str], bool]:
    """If the agent skipped KB search, still attach retrieval sources."""
    if sources or "find_aadhaar_centres_by_pincode" in tools_used:
        return sources, confidence, tools_used, False
    if _is_identity_question(question):
        return sources, confidence, tools_used, False

    raw = search_knowledge_base.invoke({"query": question})
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except json.JSONDecodeError:
        return sources, confidence, tools_used, False

    filled = list(data.get("sources") or [])
    conf = float(data.get("confidence") or 0.0)
    used = list(tools_used)
    if "search_knowledge_base" not in used:
        used.append("search_knowledge_base")
    not_found = not filled and conf < 0.15
    return filled, max(confidence, conf), used, not_found


def _extract_tool_artifacts(
    messages: List[BaseMessage],
) -> Tuple[List[Dict[str, Any]], float, bool]:
    """Build sources + confidence from tool outputs."""
    sources: List[Dict[str, Any]] = []
    confidence = 0.0
    used_kb = False
    used_centres = False

    for msg in messages:
        if not isinstance(msg, ToolMessage):
            continue
        raw = _message_text(msg.content)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if "centres" in data:
            used_centres = True
            for c in data.get("centres") or []:
                sources.append(
                    {
                        "source": c.get("name", "Aadhaar Centre"),
                        "url": c.get("map_pin", ""),
                        "snippet": c.get("address", ""),
                        "heading": c.get("name"),
                        "latitude": c.get("latitude"),
                        "longitude": c.get("longitude"),
                    }
                )
            if data.get("success") and data.get("centres"):
                confidence = max(confidence, 0.9)

        if "documents" in data or "sources" in data:
            used_kb = True
            confidence = max(confidence, float(data.get("confidence") or 0.0))
            for s in data.get("sources") or []:
                sources.append(s)

    not_found = False
    if used_kb and not used_centres and confidence < 0.15 and not sources:
        not_found = True
    return sources, confidence, not_found


def run_agent(
    question: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Run the LangGraph agent once and return answer + sources."""
    agent = _get_agent()
    messages = _history_to_messages(history or [])
    messages.append(HumanMessage(content=question))

    result = agent.invoke({"messages": messages})
    out_messages: List[BaseMessage] = result.get("messages") or []
    return _finalize_agent_result(out_messages, question=question)


def _finalize_agent_result(
    out_messages: List[BaseMessage],
    question: str = "",
) -> Dict[str, Any]:
    answer = ""
    for msg in reversed(out_messages):
        if isinstance(msg, AIMessage) and _message_text(msg.content).strip():
            if getattr(msg, "tool_calls", None):
                text = _message_text(msg.content).strip()
                if text and msg is out_messages[-1]:
                    answer = text
                    break
                continue
            answer = _message_text(msg.content).strip()
            if answer:
                break

    if not answer:
        answer = "Sorry, I could not generate an answer. Please try again."

    answer = strip_location_from_answer(answer)
    sources, confidence, not_found = _extract_tool_artifacts(out_messages)
    tools_used = sorted(
        {
            getattr(m, "name", "")
            for m in out_messages
            if isinstance(m, ToolMessage) and getattr(m, "name", "")
        }
    )

    sources, confidence, tools_used, fallback_not_found = _enrich_sources_if_missing(
        question, sources, confidence, tools_used
    )
    if fallback_not_found:
        not_found = True

    if re.search(r"\bpin\b|\bpincode\b|\bpin code\b", answer, re.I) and not sources:
        not_found = False
        confidence = max(confidence, 0.5)

    return {
        "answer": answer,
        "sources": [] if not_found else sources,
        "confidence": confidence,
        "notFound": not_found,
        "tools_used": tools_used,
        "messages": out_messages,
    }


async def stream_agent(
    question: str,
    history: Optional[List[Dict[str, str]]] = None,
):
    """Yield live agent events: tool_start / token / final."""
    agent = _get_agent()
    messages = _history_to_messages(history or [])
    messages.append(HumanMessage(content=question))

    final_messages: List[BaseMessage] = list(messages)
    collected_tools: List[BaseMessage] = []
    seen_tools: set[str] = set()

    async for mode, chunk in agent.astream(
        {"messages": messages},
        stream_mode=["messages", "updates", "values"],
    ):
        if mode == "updates":
            if isinstance(chunk, dict):
                for node, update in chunk.items():
                    if node == "tools" and isinstance(update, dict):
                        for msg in update.get("messages") or []:
                            collected_tools.append(msg)
                            name = getattr(msg, "name", None)
                            if name and name not in seen_tools:
                                seen_tools.add(name)
                                yield {"kind": "tool_start", "name": name}
        elif mode == "messages":
            msg_chunk, metadata = chunk
            if metadata.get("langgraph_node") != "agent":
                continue
            if getattr(msg_chunk, "tool_call_chunks", None):
                continue
            if getattr(msg_chunk, "tool_calls", None):
                continue
            text = _message_text(getattr(msg_chunk, "content", ""))
            if text:
                yield {"kind": "token", "text": text}
        elif mode == "values":
            if isinstance(chunk, dict) and chunk.get("messages"):
                final_messages = list(chunk["messages"])

    # Ensure tool outputs are present even if values snapshot dropped them
    if collected_tools:
        existing = {id(m) for m in final_messages}
        for msg in collected_tools:
            if id(msg) not in existing:
                final_messages.append(msg)

    yield {
        "kind": "final",
        "result": _finalize_agent_result(final_messages, question=question),
    }

