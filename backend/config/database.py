"""Neon Postgres connection and persistence helpers.

The backend talks to Neon through the standard PostgreSQL protocol.  A pooled
Neon ``DATABASE_URL`` is recommended; each operation opens a short-lived
psycopg connection and lets Neon's PgBouncer endpoint handle pooling.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

import psycopg
from pgvector.psycopg import register_vector
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


class DatabaseConfigurationError(RuntimeError):
    """Raised when database access is requested without a connection URL."""


def is_database_configured() -> bool:
    """Return whether persistent Postgres storage is explicitly configured."""

    return bool(os.getenv("DATABASE_URL", "").strip())


class Database:
    """Small repository layer for the Study Buddy Postgres schema."""

    def __init__(self, database_url: str | None = None):
        self.database_url = (database_url or os.getenv("DATABASE_URL", "")).strip()
        if not self.database_url:
            raise DatabaseConfigurationError(
                "DATABASE_URL must be set before using persistent database storage"
            )

    @contextmanager
    def connection(self) -> Iterator[Connection]:
        """Yield a transaction-scoped connection with pgvector registered."""

        with psycopg.connect(self.database_url, row_factory=dict_row) as connection:
            register_vector(connection)
            yield connection

    def ping(self) -> None:
        """Verify that the configured database is reachable and queryable."""

        with self.connection() as connection:
            connection.execute("SELECT 1")

    def save_document(
        self,
        document: dict[str, Any],
        chunks: Sequence[dict[str, Any]],
    ) -> None:
        """Persist document metadata and all chunk embeddings atomically."""

        document_sql = """
            INSERT INTO documents (
                id,
                original_filename,
                stored_filename,
                file_size,
                total_characters,
                total_tokens,
                total_chunks,
                status,
                extracted_text,
                embedding_model,
                embedding_dimension
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """
        chunk_sql = """
            INSERT INTO document_embeddings (
                document_id,
                content,
                chunk_index,
                token_count,
                start_token,
                end_token,
                embedding
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """

        document_params = (
            document["id"],
            document["original_filename"],
            document["stored_filename"],
            document["file_size"],
            document["total_characters"],
            document["total_tokens"],
            document["total_chunks"],
            document["status"],
            document["extracted_text"],
            document["embedding_model"],
            document["embedding_dimension"],
        )
        chunk_params = [
            (
                chunk["document_id"],
                chunk["content"],
                chunk["chunk_index"],
                chunk["token_count"],
                chunk["start_token"],
                chunk["end_token"],
                chunk["embedding"],
            )
            for chunk in chunks
        ]

        with self.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(document_sql, document_params)
                if chunk_params:
                    cursor.executemany(chunk_sql, chunk_params)

    def get_documents(self) -> list[dict[str, Any]]:
        """Return document metadata, newest first, without extracted contents."""

        query = """
            SELECT
                id,
                original_filename,
                stored_filename,
                file_size,
                total_characters,
                total_tokens,
                total_chunks,
                status,
                embedding_model,
                embedding_dimension,
                created_at,
                updated_at
            FROM documents
            ORDER BY created_at DESC
        """
        with self.connection() as connection:
            return list(connection.execute(query).fetchall())

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        """Return one document's public metadata."""

        query = """
            SELECT
                id,
                original_filename,
                stored_filename,
                file_size,
                total_characters,
                total_tokens,
                total_chunks,
                status,
                embedding_model,
                embedding_dimension,
                created_at,
                updated_at
            FROM documents
            WHERE id = %s
        """
        with self.connection() as connection:
            return connection.execute(query, (document_id,)).fetchone()

    def get_document_text(self, document_id: str) -> str | None:
        """Return the exact extracted text used to build a document's chunks."""

        with self.connection() as connection:
            row = connection.execute(
                "SELECT extracted_text FROM documents WHERE id = %s",
                (document_id,),
            ).fetchone()
        return row["extracted_text"] if row else None

    def get_document_rag_payload(self, document_id: str) -> dict[str, Any] | None:
        """Return embedding identity, exact text, and chunks in one transaction."""

        metadata_query = """
            SELECT embedding_model, embedding_dimension, extracted_text
            FROM documents
            WHERE id = %s
        """
        chunks_query = """
            SELECT
                content,
                chunk_index,
                token_count,
                start_token,
                end_token,
                embedding
            FROM document_embeddings
            WHERE document_id = %s
            ORDER BY chunk_index ASC
        """
        with self.connection() as connection:
            metadata = connection.execute(
                metadata_query,
                (document_id,),
            ).fetchone()
            if metadata is None:
                return None
            chunks = list(
                connection.execute(chunks_query, (document_id,)).fetchall()
            )
        return {**metadata, "chunks": chunks}

    def get_document_chunks(self, document_id: str) -> list[dict[str, Any]]:
        """Return ordered chunks and embeddings used to hydrate the RAG cache."""

        query = """
            SELECT
                content,
                chunk_index,
                token_count,
                start_token,
                end_token,
                embedding
            FROM document_embeddings
            WHERE document_id = %s
            ORDER BY chunk_index ASC
        """
        with self.connection() as connection:
            return list(connection.execute(query, (document_id,)).fetchall())

    def delete_document(self, document_id: str) -> dict[str, Any] | None:
        """Delete a document and cascade to chunks and generated study tools."""

        with self.connection() as connection:
            return connection.execute(
                """
                DELETE FROM documents
                WHERE id = %s
                RETURNING id, stored_filename
                """,
                (document_id,),
            ).fetchone()

    def save_quiz(self, quiz: dict[str, Any]) -> None:
        query = """
            INSERT INTO quizzes (id, document_id, title, questions, settings)
            VALUES (%s, %s, %s, %s, %s)
        """
        params = (
            quiz["id"],
            quiz["document_id"],
            quiz["title"],
            Jsonb(quiz["questions"]),
            Jsonb(quiz.get("settings")),
        )
        with self.connection() as connection:
            connection.execute(query, params)

    def get_quizzes(self, document_id: str) -> list[dict[str, Any]]:
        return self._get_history("quizzes", document_id)

    def save_flashcards(self, flashcards: dict[str, Any]) -> None:
        query = """
            INSERT INTO flashcards (id, document_id, deck_title, cards)
            VALUES (%s, %s, %s, %s)
        """
        params = (
            flashcards["id"],
            flashcards["document_id"],
            flashcards["deck_title"],
            Jsonb(flashcards["cards"]),
        )
        with self.connection() as connection:
            connection.execute(query, params)

    def get_flashcards(self, document_id: str) -> list[dict[str, Any]]:
        return self._get_history("flashcards", document_id)

    def save_summary(self, summary: dict[str, Any]) -> None:
        query = """
            INSERT INTO summaries (
                id,
                document_id,
                document_title,
                tldr,
                key_points,
                keywords
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        params = (
            summary["id"],
            summary["document_id"],
            summary.get("document_title"),
            summary["tldr"],
            Jsonb(summary["key_points"]),
            Jsonb(summary.get("keywords")),
        )
        with self.connection() as connection:
            connection.execute(query, params)

    def get_summaries(self, document_id: str) -> list[dict[str, Any]]:
        return self._get_history("summaries", document_id)

    def _get_history(
        self,
        table: str,
        document_id: str,
    ) -> list[dict[str, Any]]:
        # Only callers in this module can select the table; user input is always
        # passed separately as a bound parameter.
        allowed_tables = {"quizzes", "flashcards", "summaries"}
        if table not in allowed_tables:
            raise ValueError(f"Unsupported history table: {table}")

        query = f"""
            SELECT *
            FROM {table}
            WHERE document_id = %s
            ORDER BY created_at DESC
        """
        with self.connection() as connection:
            return list(connection.execute(query, (document_id,)).fetchall())


_database: Database | None = None


def get_database() -> Database:
    """Return a process-local repository for the current ``DATABASE_URL``."""

    global _database
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise DatabaseConfigurationError(
            "DATABASE_URL must be set before using persistent database storage"
        )
    if _database is None or _database.database_url != database_url:
        _database = Database(database_url)
    return _database
