"""RAG knowledge-base tool for the LangGraph agent."""

from __future__ import annotations

import json

from langchain_core.tools import tool


@tool
def search_knowledge_base(query: str) -> str:
    """Search the UIDAI / Aadhaar FAQ knowledge base for enrolment, update, e-Aadhaar, lock/unlock, documents, fees, and related questions.

    Use for general Aadhaar questions. Do NOT use this for nearby centre / map / PIN-code location lookups.
    """
    from services.rag_service import (
        _build_sources,
        _compute_confidence,
        _merge_context,
        embed_query,
    )
    from core.vector_store import VectorStore

    q = (query or "").strip()
    if not q:
        return json.dumps({"success": False, "error": "Empty query", "documents": []})

    vs = VectorStore.get_instance()
    embedding = embed_query(q)
    docs, metadatas, distances = vs.hybrid_search(q, embedding, top_k=5)
    docs, metadatas, distances = _merge_context(docs, metadatas, distances)
    sources = _build_sources(docs, metadatas)

    documents = []
    for doc, meta, dist in zip(docs, metadatas, distances):
        documents.append(
            {
                "text": doc[:1200],
                "source": meta.get("source", "Unknown"),
                "url": meta.get("url", ""),
                "heading": meta.get("heading") or None,
                "distance": dist,
            }
        )

    return json.dumps(
        {
            "success": True,
            "query": q,
            "confidence": _compute_confidence(distances),
            "documents": documents,
            "sources": sources,
        },
        ensure_ascii=False,
    )
