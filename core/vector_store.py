import os
import re
import logging
import random
import threading
from typing import List, Dict, Any, Tuple, Optional

import chromadb
import numpy as np
from chromadb.config import Settings
from rank_bm25 import BM25Okapi

import config

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────
# BM25 tokenizer (generic)
# ────────────────────────────────────────────────────────────────
_STOPWORDS = frozenset({
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "ought", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "out", "off",
    "over", "under", "again", "further", "then", "once", "here", "there",
    "when", "where", "why", "how", "all", "each", "every", "both", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "just", "because", "but",
    "and", "or", "if", "while", "this", "that", "these", "those", "i",
    "me", "my", "we", "our", "you", "your", "he", "him", "his", "she",
    "her", "it", "its", "they", "them", "their", "what", "which", "who",
    "whom",
})

_TOKEN_RE = re.compile(r"\w+")


def _tokenize(text: str) -> List[str]:
    tokens = _TOKEN_RE.findall(text.lower())
    return [t for t in tokens if t not in _STOPWORDS or any(c.isdigit() for c in t)]


# ────────────────────────────────────────────────────────────────
# VectorStore — singleton, cosine distance, cached BM25
# ────────────────────────────────────────────────────────────────
class VectorStore:
    _instance: Optional["VectorStore"] = None
    _init_lock = threading.Lock()

    # Bumped by ANY instance on mutation so the singleton knows to rebuild BM25
    _mutation_version: int = 0

    def __init__(self):
        chroma_mode = os.getenv("CHROMA_DB_MODE", "local")

        if chroma_mode == "server":
            host = os.getenv("CHROMA_SERVER_HOST", "localhost")
            port = int(os.getenv("CHROMA_SERVER_PORT", "8000"))
            print(f"[VECTOR_STORE] Connecting to ChromaDB server at {host}:{port}")
            self.client = chromadb.HttpClient(
                host=host,
                port=port,
                settings=Settings(allow_reset=True, anonymized_telemetry=False),
            )
        else:
            print(f"[VECTOR_STORE] Using local ChromaDB at {config.CHROMA_DB_DIR}")
            self.client = chromadb.PersistentClient(
                path=config.CHROMA_DB_DIR,
                settings=Settings(allow_reset=True, anonymized_telemetry=False),
            )

        # NOTE: If the collection already exists with L2 distance, ChromaDB will
        # return the existing (L2) collection.  You MUST reindex once after this
        # change: call reset_collection() then re-ingest all documents.
        self.collection = self.client.get_or_create_collection(
            name=config.CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

        # BM25 cache (per-instance, but only the singleton is used at query time)
        self._bm25: Optional[BM25Okapi] = None
        self._bm25_docs: List[str] = []
        self._bm25_metas: List[Dict[str, Any]] = []
        self._bm25_ids: List[str] = []
        self._bm25_lock = threading.Lock()
        self._cached_version: int = -1

        # Pre-build BM25 index at startup so first query is fast
        self._ensure_bm25_index()

    # ── Singleton accessor ──────────────────────────────────────
    @classmethod
    def get_instance(cls) -> "VectorStore":
        """Return the process-wide singleton (preferred for query-time code)."""
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ── Mutation version ────────────────────────────────────────
    @classmethod
    def _bump_version(cls):
        cls._mutation_version += 1

    # ── Collection management ───────────────────────────────────
    def reset_collection(self):
        self.client.delete_collection(config.CHROMA_COLLECTION_NAME)
        self.collection = self.client.get_or_create_collection(
            name=config.CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        VectorStore._bump_version()

    # ── CRUD ────────────────────────────────────────────────────
    def upsert_chunks(
        self,
        texts: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        ids: List[str],
    ):
        self.collection.upsert(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )
        VectorStore._bump_version()

    def delete_by_url(self, url: str) -> int:
        try:
            result = self.collection.get(where={"url": url})
            ids = result.get("ids", [])
            if ids:
                self.collection.delete(ids=ids)
                VectorStore._bump_version()
            return len(ids)
        except Exception:
            return 0

    def delete_by_filename(self, filename: str) -> int:
        try:
            result = self.collection.get(where={"filename": filename})
            ids = result.get("ids", [])
            if ids:
                self.collection.delete(ids=ids)
                VectorStore._bump_version()
            return len(ids)
        except Exception:
            return 0

    def filename_exists(self, filename: str) -> bool:
        try:
            result = self.collection.get(where={"filename": filename}, limit=1)
            return len(result.get("ids", [])) > 0
        except Exception:
            return False

    # ── BM25 index management ──────────────────────────────────
    def _ensure_bm25_index(self):
        """Build or refresh the BM25 index.  Rebuilds only when data has changed."""
        current_version = VectorStore._mutation_version

        with self._bm25_lock:
            if self._bm25 is not None and self._cached_version == current_version:
                return

            print(f"[VECTOR_STORE] Building BM25 index (version {current_version})...")
            try:
                total_count = self.collection.count()
                batch_size = int(os.getenv("CHROMA_BM25_BUILD_BATCH_SIZE", "1000"))
                docs: List[str] = []
                metas: List[Dict[str, Any]] = []
                ids: List[str] = []

                for offset in range(0, total_count, batch_size):
                    result = self.collection.get(
                        include=["documents", "metadatas"],
                        limit=batch_size,
                        offset=offset,
                    )
                    docs.extend(result.get("documents", []))
                    metas.extend(result.get("metadatas", []))
                    ids.extend(result.get("ids", []))

                self._bm25_docs = docs
                self._bm25_metas = metas
                self._bm25_ids = ids

                if self._bm25_docs:
                    tokenized = [_tokenize(doc) for doc in self._bm25_docs]
                    self._bm25 = BM25Okapi(tokenized)
                else:
                    self._bm25 = None

                self._cached_version = current_version
                print(f"[VECTOR_STORE] BM25 index ready — {len(self._bm25_docs)} documents")
            except Exception as e:
                print(f"[VECTOR_STORE] Failed to build BM25 index: {e}")
                self._bm25 = None

    # ── Search ─────────────────────────────────────────────────
    def query(
        self,
        embedding: List[float],
        top_k: int = 5,
    ) -> Tuple[List[str], List[Dict[str, Any]], List[float]]:
        result = self.collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
        )
        docs = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        return docs, metadatas, distances

    def hybrid_search(
        self,
        query: str,
        embedding: List[float],
        top_k: int = 5,
        vector_weight: float = 0.6,
        bm25_weight: float = 0.4,
        max_distance: float = 0.85,
    ) -> Tuple[List[str], List[Dict[str, Any]], List[float]]:
        """
        Hybrid search: cosine vector search + cached BM25 keyword search,
        merged via Reciprocal Rank Fusion (RRF).

        Cosine distance range in ChromaDB: 0 (identical) → 2 (opposite).
        max_distance: results beyond this threshold are discarded.
        """
        candidate_pool = min(top_k * 3, 20)

        # ── 1. Vector search (fast — index lives in ChromaDB) ──
        vector_results = self.collection.query(
            query_embeddings=[embedding],
            n_results=candidate_pool,
        )
        v_docs = vector_results.get("documents", [[]])[0]
        v_metas = vector_results.get("metadatas", [[]])[0]
        v_distances = vector_results.get("distances", [[]])[0]
        v_ids = vector_results.get("ids", [[]])[0]

        # ── 2. BM25 search (from cache — no full-collection fetch) ──
        self._ensure_bm25_index()

        bm25_ranking: List[Tuple[int, float]] = []
        if self._bm25 is not None:
            tokenized_query = _tokenize(query)
            if tokenized_query:
                scores = self._bm25.get_scores(tokenized_query)
                top_indices = np.argsort(scores)[::-1][:candidate_pool]
                bm25_ranking = [
                    (int(idx), float(scores[idx]))
                    for idx in top_indices
                    if scores[idx] > 0
                ]

        # ── 3. RRF merge keyed by ChromaDB document ID ──
        rrf_scores: Dict[str, float] = {}
        id_to_doc: Dict[str, str] = {}
        id_to_meta: Dict[str, Dict[str, Any]] = {}
        id_to_dist: Dict[str, float] = {}

        k = 60  # RRF constant

        for rank, (doc, meta, dist, doc_id) in enumerate(
            zip(v_docs, v_metas, v_distances, v_ids)
        ):
            if dist > max_distance:
                continue
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + vector_weight / (k + rank + 1)
            id_to_doc[doc_id] = doc
            id_to_meta[doc_id] = meta
            id_to_dist[doc_id] = dist

        for rank, (corpus_idx, _score) in enumerate(bm25_ranking):
            doc_id = self._bm25_ids[corpus_idx]
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + bm25_weight / (k + rank + 1)
            if doc_id not in id_to_doc:
                id_to_doc[doc_id] = self._bm25_docs[corpus_idx]
                id_to_meta[doc_id] = (
                    self._bm25_metas[corpus_idx]
                    if corpus_idx < len(self._bm25_metas)
                    else {}
                )
                id_to_dist[doc_id] = 1.0

        # ── 4. Sort by fused score and return top_k ──
        sorted_ids = sorted(rrf_scores, key=rrf_scores.get, reverse=True)

        final_docs: List[str] = []
        final_metas: List[Dict[str, Any]] = []
        final_distances: List[float] = []

        for doc_id in sorted_ids:
            final_docs.append(id_to_doc[doc_id])
            final_metas.append(id_to_meta[doc_id])
            final_distances.append(id_to_dist[doc_id])
            if len(final_docs) >= top_k:
                break

        print(
            f"[HYBRID_SEARCH] vector={len(v_docs)}, "
            f"bm25={len(bm25_ranking)}, final={len(final_docs)}"
        )
        return final_docs, final_metas, final_distances

    # ── Utility methods ────────────────────────────────────────
    def url_exists(self, url: str) -> bool:
        try:
            result = self.collection.get(where={"url": url}, limit=1)
            return len(result.get("ids", [])) > 0
        except Exception:
            return False

    def get_all_documents(self) -> Tuple[List[str], List[Dict[str, Any]], List[str]]:
        """Fetch ALL documents (used by admin/ingestion, NOT by query path)."""
        try:
            result = self.collection.get(include=["documents", "metadatas"])
            return (
                result.get("documents", []),
                result.get("metadatas", []),
                result.get("ids", []),
            )
        except Exception as e:
            print(f"[VECTOR_STORE] Error fetching all documents: {e}")
            return [], [], []

    def get_random_chunks(self, limit: int = 50) -> List[str]:
        try:
            result = self.collection.get(limit=limit * 2, include=["documents"])
            docs = result.get("documents", [])
            if len(docs) > limit:
                return random.sample(docs, limit)
            return docs
        except Exception as e:
            print(f"[VECTOR_STORE] Error fetching random chunks: {e}")
            return []
