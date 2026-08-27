"""RAG indexing, persistence hydration, and semantic search services."""

from __future__ import annotations

import os
import threading
from typing import Any, Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from config import get_database, is_database_configured
from .document_processor import get_document_processor


class RAGService:
    """Create embeddings and maintain a per-document FAISS read-through cache."""

    def __init__(self):
        self.model_name = os.getenv(
            "EMBEDDING_MODEL",
            "shibing624/text2vec-base-chinese",
        )
        self.embedding_model = SentenceTransformer(self.model_name)
        self.embedding_dim = self.embedding_model.get_embedding_dimension()
        self.document_processor = get_document_processor()

        self.indices: dict[str, faiss.IndexFlatIP] = {}
        self.chunks_store: dict[str, list[dict[str, Any]]] = {}
        self.full_text_store: dict[str, str] = {}
        self._cache_lock = threading.RLock()

    def create_embeddings(self, texts: list[str]) -> np.ndarray:
        """Create normalized float32 embeddings for text chunks."""

        embeddings = self.embedding_model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=len(texts) > 10,
        )
        embeddings = np.ascontiguousarray(embeddings, dtype=np.float32)
        # Keep this explicit so alternate SentenceTransformer implementations
        # still satisfy IndexFlatIP's cosine-similarity assumptions.
        faiss.normalize_L2(embeddings)
        return embeddings

    def index_text(self, document_id: str, text: str) -> dict[str, Any]:
        """Index already-extracted text and return persistence-ready chunks."""

        chunks = self.document_processor.split_into_chunks(text)
        if not chunks:
            raise ValueError("No content could be extracted from the document")

        embeddings = self.create_embeddings([chunk["content"] for chunk in chunks])
        self._cache_document(document_id, chunks, embeddings, text)

        chunks_for_database = []
        for chunk, embedding in zip(chunks, embeddings):
            chunks_for_database.append(
                {
                    "document_id": document_id,
                    "content": chunk["content"],
                    "chunk_index": chunk["chunk_index"],
                    "token_count": chunk["token_count"],
                    "start_token": chunk["start_token"],
                    "end_token": chunk["end_token"],
                    "embedding": embedding,
                }
            )

        return {
            "doc_id": document_id,
            "chunks_indexed": len(chunks),
            "total_tokens": sum(chunk["token_count"] for chunk in chunks),
            "full_text": text,
            "embedding_model": self.model_name,
            "embedding_dimension": self.embedding_dim,
            "embeddings_for_db": chunks_for_database,
        }

    def _cache_document(
        self,
        document_id: str,
        chunks: list[dict[str, Any]],
        embeddings: np.ndarray,
        full_text: str,
    ) -> None:
        """Atomically replace one document in the process-local FAISS cache."""

        if embeddings.ndim != 2 or embeddings.shape[0] != len(chunks):
            raise ValueError("Chunk and embedding counts do not match")

        index = faiss.IndexFlatIP(int(embeddings.shape[1]))
        index.add(np.ascontiguousarray(embeddings, dtype=np.float32))
        with self._cache_lock:
            self.indices[document_id] = index
            self.chunks_store[document_id] = chunks
            self.full_text_store[document_id] = full_text

    def _hydrate_document(self, document_id: str) -> bool:
        """Load persisted chunks/embeddings into FAISS after a process restart."""

        with self._cache_lock:
            if document_id in self.indices:
                return True

        if not is_database_configured():
            return False

        payload = get_database().get_document_rag_payload(document_id)
        if payload is None or not payload["chunks"]:
            return False

        persisted_model = payload["embedding_model"]
        persisted_dimension = int(payload["embedding_dimension"])
        if (
            persisted_model != self.model_name
            or persisted_dimension != self.embedding_dim
        ):
            raise ValueError(
                "Stored document embeddings were created with "
                f"{persisted_model!r} ({persisted_dimension} dimensions), but "
                f"the configured model is {self.model_name!r} "
                f"({self.embedding_dim} dimensions). Restore the exact original "
                "EMBEDDING_MODEL or re-upload the document."
            )

        stored_chunks = payload["chunks"]

        embeddings = np.ascontiguousarray(
            [np.asarray(chunk["embedding"], dtype=np.float32) for chunk in stored_chunks],
            dtype=np.float32,
        )
        if embeddings.ndim != 2:
            raise ValueError(f"Stored embeddings for document {document_id} are invalid")
        if embeddings.shape[1] != persisted_dimension:
            raise ValueError(
                f"Stored vectors contain {embeddings.shape[1]} dimensions, but "
                f"document metadata declares {persisted_dimension}; the persisted "
                "RAG data is inconsistent."
            )
        faiss.normalize_L2(embeddings)

        chunks = [
            {
                "content": row["content"],
                "chunk_index": row["chunk_index"],
                "token_count": row["token_count"],
                "start_token": row["start_token"],
                "end_token": row["end_token"],
            }
            for row in stored_chunks
        ]
        full_text = payload["extracted_text"]
        if full_text is None:
            return False

        self._cache_document(document_id, chunks, embeddings, full_text)
        return True

    def search(
        self,
        document_id: str,
        query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Search a document's cached or lazily hydrated vector index."""

        if not self._hydrate_document(document_id):
            raise ValueError(f"Document {document_id} not indexed")

        query_embedding = self.create_embeddings([query])
        with self._cache_lock:
            index = self.indices[document_id]
            chunks = self.chunks_store[document_id]
            scores, indices = index.search(
                query_embedding,
                min(top_k, index.ntotal),
            )

        results = []
        for score, chunk_position in zip(scores[0], indices[0]):
            if 0 <= chunk_position < len(chunks):
                chunk = chunks[chunk_position]
                results.append(
                    {
                        "content": chunk["content"],
                        "chunk_index": chunk["chunk_index"],
                        "score": float(score),
                    }
                )
        return results

    def get_full_text(self, document_id: str) -> str:
        """Return exact extracted text, hydrating it from Postgres if needed."""

        if not self._hydrate_document(document_id):
            raise ValueError(f"Document {document_id} not indexed")
        with self._cache_lock:
            return self.full_text_store[document_id]

    def get_context_for_query(
        self,
        document_id: str,
        query: str,
        max_tokens: int = 4000,
    ) -> str:
        """Build a token-bounded context from the most relevant chunks."""

        results = self.search(document_id, query, top_k=10)
        context_parts = []
        total_tokens = 0
        for result in results:
            chunk_tokens = self.document_processor.count_tokens(result["content"])
            if total_tokens + chunk_tokens > max_tokens:
                break
            context_parts.append(result["content"])
            total_tokens += chunk_tokens
        return "\n\n---\n\n".join(context_parts)

    def is_document_indexed(self, document_id: str) -> bool:
        """Check memory and then persistent storage for a document index."""

        return self._hydrate_document(document_id)

    def remove_document(self, document_id: str) -> None:
        """Remove one document from the process-local cache."""

        with self._cache_lock:
            self.indices.pop(document_id, None)
            self.chunks_store.pop(document_id, None)
            self.full_text_store.pop(document_id, None)


_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Return the process-local RAG service."""

    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service


def evict_document_cache(document_id: str) -> None:
    """Evict cached RAG state without initializing the embedding model."""

    if _rag_service is not None:
        _rag_service.remove_document(document_id)
