import io
import json
import threading
from pathlib import Path

import numpy as np
import pytest

from app import create_app
from config.database import Database, DatabaseConfigurationError
from routes import documents as document_routes
from routes import study_tools as study_routes
from services.rag_service import RAGService
from services.groq_service import GroqService
import services.rag_service as rag_module


@pytest.fixture
def app(tmp_path):
    flask_app = create_app()
    flask_app.config.update(TESTING=True, UPLOAD_FOLDER=str(tmp_path))
    document_routes.documents_store.clear()
    study_routes.quizzes_store.clear()
    study_routes.flashcards_store.clear()
    study_routes.summaries_store.clear()
    return flask_app


def test_database_requires_explicit_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(DatabaseConfigurationError, match="DATABASE_URL"):
        Database()


def test_document_list_uses_memory_only_without_database(app, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    document_id = "08e40330-70f5-40f6-995a-2304a73fe0bd"
    document_routes.documents_store[document_id] = {
        "id": document_id,
        "original_filename": "memory.txt",
        "stored_filename": f"{document_id}.txt",
    }

    response = app.test_client().get("/api/documents/")

    assert response.status_code == 200
    assert response.get_json()["documents"] == [
        {
            "id": document_id,
            "original_filename": "memory.txt",
            "stored_filename": f"{document_id}.txt",
            "saved_to_database": False,
        }
    ]


def test_configured_database_error_is_not_hidden_by_memory(app, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured.example/test")
    document_routes.documents_store["fallback"] = {"id": "fallback"}

    class BrokenDatabase:
        def get_documents(self):
            raise RuntimeError("database offline")

    monkeypatch.setattr(document_routes, "get_database", lambda: BrokenDatabase())

    response = app.test_client().get("/api/documents/")

    assert response.status_code == 500
    assert response.get_json() == {"error": "Failed to list documents"}


def test_upload_reports_real_database_persistence_and_keeps_unicode_name(
    app,
    monkeypatch,
):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured.example/test")
    captured = {}

    class FakeProcessor:
        def extract_text(self, _file_path):
            return "測試內容"

        def count_tokens(self, _text):
            return 4

    class FakeRAG:
        def index_text(self, document_id, text):
            return {
                "chunks_indexed": 1,
                "embedding_model": "test-model",
                "embedding_dimension": 3,
                "embeddings_for_db": [
                    {
                        "document_id": document_id,
                        "content": text,
                        "chunk_index": 0,
                        "token_count": 4,
                        "start_token": 0,
                        "end_token": 4,
                        "embedding": np.array([1.0, 0.0, 0.0], dtype=np.float32),
                    }
                ],
            }

        def remove_document(self, _document_id):
            raise AssertionError("successful uploads must remain cached")

    class FakeDatabase:
        def save_document(self, document, chunks):
            captured["document"] = document
            captured["chunks"] = chunks

    monkeypatch.setattr(document_routes, "get_document_processor", FakeProcessor)
    monkeypatch.setattr(document_routes, "get_rag_service", FakeRAG)
    monkeypatch.setattr(document_routes, "get_database", FakeDatabase)

    response = app.test_client().post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"placeholder"), "學習筆記.txt")},
        content_type="multipart/form-data",
    )

    body = response.get_json()
    assert response.status_code == 201
    assert body["document"]["original_filename"] == "學習筆記.txt"
    assert body["document"]["stored_filename"].endswith(".txt")
    assert body["document"]["saved_to_database"] is True
    assert captured["document"]["extracted_text"] == "測試內容"
    assert len(captured["chunks"]) == 1


def test_upload_database_failure_rolls_back_local_state(app, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured.example/test")
    removed = []

    class FakeProcessor:
        def extract_text(self, _file_path):
            return "content"

        def count_tokens(self, _text):
            return 1

    class FakeRAG:
        def index_text(self, document_id, text):
            return {
                "chunks_indexed": 1,
                "embedding_model": "test-model",
                "embedding_dimension": 3,
                "embeddings_for_db": [],
            }

        def remove_document(self, document_id):
            removed.append(document_id)

    class BrokenDatabase:
        def save_document(self, _document, _chunks):
            raise RuntimeError("write failed")

    monkeypatch.setattr(document_routes, "get_document_processor", FakeProcessor)
    monkeypatch.setattr(document_routes, "get_rag_service", FakeRAG)
    monkeypatch.setattr(document_routes, "get_database", BrokenDatabase)

    response = app.test_client().post(
        "/api/documents/upload",
        data={"file": (io.BytesIO(b"placeholder"), "notes.txt")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 500
    assert response.get_json() == {"error": "Document processing failed"}
    assert len(removed) == 1
    assert document_routes.documents_store == {}
    assert list(Path(app.config["UPLOAD_FOLDER"]).iterdir()) == []


def test_study_save_failure_does_not_claim_success(app, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured.example/test")
    document_id = "dbfa7066-2982-4ca5-a8cc-ef31f5da318b"

    class FakeRAG:
        def is_document_indexed(self, _document_id):
            return True

        def get_full_text(self, _document_id):
            return "study content"

    class FakeGroq:
        def generate_quiz(self, _content, _count, _question_type):
            return {
                "quiz_title": "Quiz",
                "questions": [],
                "source_coverage": {"strategy": "full_document"},
            }

    class BrokenDatabase:
        def save_quiz(self, _record):
            raise RuntimeError("write failed")

    monkeypatch.setattr(study_routes, "get_rag_service", FakeRAG)
    monkeypatch.setattr(study_routes, "get_groq_service", FakeGroq)
    monkeypatch.setattr(study_routes, "get_database", BrokenDatabase)

    response = app.test_client().post(
        f"/api/study/quiz/{document_id}",
        json={"num_questions": 5, "question_type": "mixed"},
    )

    assert response.status_code == 500
    assert response.get_json() == {"error": "Quiz generation failed"}


def test_malformed_valid_quiz_json_is_not_persisted(app, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured.example/test")
    document_id = "bff9839f-687f-4e46-9902-0d94e1f901a9"
    save_attempts = []

    class FakeRAG:
        def is_document_indexed(self, _document_id):
            return True

        def get_full_text(self, _document_id):
            return "study content"

    class FakeDatabase:
        def save_quiz(self, record):
            save_attempts.append(record)

    groq_service = GroqService.__new__(GroqService)
    groq_service.model = "openai/gpt-oss-120b"
    groq_service._tokenizer = type(
        "CharacterTokenizer",
        (),
        {
            "encode": lambda _self, text: [ord(character) for character in text],
            "decode": lambda _self, tokens: "".join(chr(token) for token in tokens),
        },
    )()
    groq_service._call_llm = lambda *_args, **_kwargs: json.dumps(
        {"quiz_title": "Looks valid", "questions": []}
    )

    monkeypatch.setattr(study_routes, "get_rag_service", FakeRAG)
    monkeypatch.setattr(study_routes, "get_groq_service", lambda: groq_service)
    monkeypatch.setattr(study_routes, "get_database", FakeDatabase)

    response = app.test_client().post(
        f"/api/study/quiz/{document_id}",
        json={"num_questions": 2, "question_type": "mixed"},
    )

    body = response.get_json()
    assert response.status_code == 200
    assert "error" in body["quiz"]
    assert body["saved_to_database"] is False
    assert save_attempts == []


def test_quiz_persists_source_coverage_in_existing_settings(app, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured.example/test")
    document_id = "6b234bee-44b8-4645-8242-f7b62ad62fea"
    saved_records = []
    coverage = {
        "strategy": "representative_token_segments",
        "source_token_count": 20000,
        "selected_token_count": 6000,
        "coverage_ratio": 0.3,
        "segment_count": 4,
        "includes_start": True,
        "includes_end": True,
        "truncated": True,
        "selected_ranges": [[0, 1500], [18500, 20000]],
    }

    class FakeRAG:
        def is_document_indexed(self, _document_id):
            return True

        def get_full_text(self, _document_id):
            return "long study content"

    class FakeGroq:
        def generate_quiz(self, _content, _count, _question_type):
            return {
                "quiz_title": "Quiz",
                "questions": [],
                "source_coverage": coverage,
            }

    class FakeDatabase:
        def save_quiz(self, record):
            saved_records.append(record)

    monkeypatch.setattr(study_routes, "get_rag_service", FakeRAG)
    monkeypatch.setattr(study_routes, "get_groq_service", FakeGroq)
    monkeypatch.setattr(study_routes, "get_database", FakeDatabase)

    response = app.test_client().post(
        f"/api/study/quiz/{document_id}",
        json={"num_questions": 2, "question_type": "mixed"},
    )

    assert response.status_code == 200
    assert response.get_json()["saved_to_database"] is True
    assert saved_records[0]["settings"]["source_coverage"] == coverage


def test_rag_lazily_hydrates_persisted_chunks(monkeypatch):
    document_id = "0569a728-3ec6-48b3-aaca-6a52468246cb"

    class FakeDatabase:
        def get_document_rag_payload(self, requested_id):
            assert requested_id == document_id
            return {
                "embedding_model": "test-model",
                "embedding_dimension": 3,
                "extracted_text": "first second",
                "chunks": [
                    {
                        "content": "first",
                        "chunk_index": 0,
                        "token_count": 1,
                        "start_token": 0,
                        "end_token": 1,
                        "embedding": np.array([1.0, 0.0, 0.0], dtype=np.float32),
                    },
                    {
                        "content": "second",
                        "chunk_index": 1,
                        "token_count": 1,
                        "start_token": 1,
                        "end_token": 2,
                        "embedding": np.array([0.0, 1.0, 0.0], dtype=np.float32),
                    },
                ],
            }

    service = RAGService.__new__(RAGService)
    service.model_name = "test-model"
    service.embedding_dim = 3
    service.indices = {}
    service.chunks_store = {}
    service.full_text_store = {}
    service._cache_lock = threading.RLock()

    monkeypatch.setattr(rag_module, "is_database_configured", lambda: True)
    monkeypatch.setattr(rag_module, "get_database", FakeDatabase)

    assert service.is_document_indexed(document_id) is True
    assert service.indices[document_id].ntotal == 2
    assert service.get_full_text(document_id) == "first second"


def test_rag_rejects_same_dimension_from_different_model(monkeypatch):
    document_id = "0af52157-fc11-405e-94a4-c83d56f18bad"

    class FakeDatabase:
        def get_document_rag_payload(self, _document_id):
            return {
                "embedding_model": "different-model",
                "embedding_dimension": 3,
                "extracted_text": "content",
                "chunks": [
                    {
                        "content": "content",
                        "chunk_index": 0,
                        "token_count": 1,
                        "start_token": 0,
                        "end_token": 1,
                        "embedding": np.array([1.0, 0.0, 0.0], dtype=np.float32),
                    }
                ],
            }

    service = RAGService.__new__(RAGService)
    service.model_name = "configured-model"
    service.embedding_dim = 3
    service.indices = {}
    service.chunks_store = {}
    service.full_text_store = {}
    service._cache_lock = threading.RLock()

    monkeypatch.setattr(rag_module, "is_database_configured", lambda: True)
    monkeypatch.setattr(rag_module, "get_database", FakeDatabase)

    with pytest.raises(ValueError, match="different-model.*configured-model"):
        service.is_document_indexed(document_id)
    assert service.indices == {}


def test_cold_database_delete_does_not_initialize_model_and_cleanup_is_nonfatal(
    app,
    monkeypatch,
):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured.example/test")
    document_id = "8f241d47-f863-4a74-bf4f-1f11f6084c63"

    class FakeDatabase:
        def delete_document(self, requested_id):
            assert requested_id == document_id
            return {"id": document_id, "stored_filename": f"{document_id}.txt"}

    monkeypatch.setattr(document_routes, "get_database", FakeDatabase)
    monkeypatch.setattr(
        document_routes,
        "get_rag_service",
        lambda: (_ for _ in ()).throw(AssertionError("model must stay cold")),
    )
    monkeypatch.setattr(
        document_routes,
        "evict_document_cache",
        lambda _document_id: (_ for _ in ()).throw(RuntimeError("cache cleanup failed")),
    )
    monkeypatch.setattr(
        Path,
        "unlink",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("file cleanup failed")),
    )

    response = app.test_client().delete(f"/api/documents/{document_id}")

    assert response.status_code == 200
    assert response.get_json() == {"message": "Document deleted successfully"}


def test_cold_cache_eviction_does_not_construct_rag_service(monkeypatch):
    monkeypatch.setattr(rag_module, "_rag_service", None)
    monkeypatch.setattr(
        rag_module,
        "RAGService",
        lambda: (_ for _ in ()).throw(AssertionError("model must stay cold")),
    )

    rag_module.evict_document_cache("6c654f13-a995-4b97-a3d6-e9a6c3dd1730")

    assert rag_module._rag_service is None
