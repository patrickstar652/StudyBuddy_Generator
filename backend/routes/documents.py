"""Document upload, retrieval, preview, and deletion routes."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request

from config import get_database, is_database_configured
from services import evict_document_cache, get_document_processor, get_rag_service


documents_bp = Blueprint("documents", __name__)

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}

# This store is intentionally used only when DATABASE_URL is absent.  In
# database mode Neon is the source of truth and errors are surfaced to callers.
documents_store: dict[str, dict] = {}


def _display_filename(filename: str) -> str:
    """Keep Unicode display names while discarding any client-supplied path."""

    return filename.replace("\\", "/").rsplit("/", 1)[-1].strip()


def allowed_file(filename: str) -> bool:
    """Check a filename against the parser formats this backend supports."""

    display_name = _display_filename(filename)
    return (
        "." in display_name
        and display_name.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


def _valid_document_id(document_id: str) -> bool:
    try:
        uuid.UUID(document_id)
    except (ValueError, AttributeError):
        return False
    return True


def _remove_local_file(stored_filename: str) -> None:
    """Best-effort idempotent cleanup for a generated upload filename."""

    file_path = Path(current_app.config["UPLOAD_FOLDER"]) / Path(stored_filename).name
    try:
        file_path.unlink(missing_ok=True)
    except OSError:
        current_app.logger.warning(
            "Local file cleanup failed for %s",
            file_path,
            exc_info=True,
        )


def _cleanup_deleted_document(document_id: str, stored_filename: str) -> None:
    """Clear optional process-local state without changing delete success."""

    try:
        evict_document_cache(document_id)
    except Exception:
        current_app.logger.warning(
            "Database state is committed, but RAG cache eviction failed for %s",
            document_id,
            exc_info=True,
        )
    _remove_local_file(stored_filename)


@documents_bp.route("/upload", methods=["POST"])
def upload_document():
    """Extract, chunk, embed, and atomically persist an uploaded document."""

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(uploaded_file.filename):
        supported = ", ".join(sorted(ALLOWED_EXTENSIONS))
        return jsonify({"error": f"File type not allowed. Supported types: {supported}"}), 400

    document_id = str(uuid.uuid4())
    original_filename = _display_filename(uploaded_file.filename)
    extension = "." + original_filename.rsplit(".", 1)[1].lower()
    stored_filename = f"{document_id}{extension}"
    file_path = os.path.join(current_app.config["UPLOAD_FOLDER"], stored_filename)
    rag_service = None

    try:
        uploaded_file.save(file_path)

        processor = get_document_processor()
        extracted_text = processor.extract_text(file_path)
        rag_service = get_rag_service()
        index_result = rag_service.index_text(document_id, extracted_text)

        now = datetime.now(timezone.utc).isoformat()
        document_metadata = {
            "id": document_id,
            "original_filename": original_filename,
            "stored_filename": stored_filename,
            "file_size": os.path.getsize(file_path),
            "total_characters": len(extracted_text),
            "total_tokens": processor.count_tokens(extracted_text),
            "total_chunks": index_result["chunks_indexed"],
            "status": "ready",
            "embedding_model": index_result["embedding_model"],
            "embedding_dimension": index_result["embedding_dimension"],
            "created_at": now,
            "updated_at": now,
        }

        if is_database_configured():
            persistence_record = {
                **document_metadata,
                "extracted_text": extracted_text,
            }
            get_database().save_document(
                persistence_record,
                index_result["embeddings_for_db"],
            )
            saved_to_database = True
        else:
            documents_store[document_id] = document_metadata
            saved_to_database = False

        response_document = {
            **document_metadata,
            "saved_to_database": saved_to_database,
        }
        return (
            jsonify(
                {
                    "message": "Document uploaded, chunked, and indexed successfully",
                    "document": response_document,
                    "processing_details": {
                        "chunks_created": index_result["chunks_indexed"],
                        "total_tokens": document_metadata["total_tokens"],
                        "embedding_model": index_result["embedding_model"],
                        "embedding_dimension": index_result["embedding_dimension"],
                        "status": "ready",
                    },
                }
            ),
            201,
        )
    except Exception:
        current_app.logger.exception("Document upload/index/persistence failed")
        if rag_service is not None:
            try:
                rag_service.remove_document(document_id)
            except Exception:
                current_app.logger.warning(
                    "Failed to evict partially indexed document %s",
                    document_id,
                    exc_info=True,
                )
        documents_store.pop(document_id, None)
        _remove_local_file(stored_filename)
        return jsonify({"error": "Document processing failed"}), 500


@documents_bp.route("/", methods=["GET"])
def get_documents():
    """Return documents from Neon or the explicit no-database fallback."""

    try:
        if is_database_configured():
            documents = [
                {**document, "saved_to_database": True}
                for document in get_database().get_documents()
            ]
        else:
            documents = [
                {**document, "saved_to_database": False}
                for document in documents_store.values()
            ]
        return jsonify({"documents": documents})
    except Exception:
        current_app.logger.exception("Failed to list documents")
        return jsonify({"error": "Failed to list documents"}), 500


@documents_bp.route("/<document_id>", methods=["GET"])
def get_document(document_id: str):
    """Return one document's metadata."""

    if not _valid_document_id(document_id):
        return jsonify({"error": "Invalid document ID"}), 400

    try:
        if is_database_configured():
            document = get_database().get_document(document_id)
            if document is not None:
                return jsonify(
                    {"document": {**document, "saved_to_database": True}}
                )
        else:
            document = documents_store.get(document_id)
            if document is not None:
                return jsonify(
                    {"document": {**document, "saved_to_database": False}}
                )
        return jsonify({"error": "Document not found"}), 404
    except Exception:
        current_app.logger.exception("Failed to retrieve document %s", document_id)
        return jsonify({"error": "Failed to retrieve document"}), 500


@documents_bp.route("/<document_id>", methods=["DELETE"])
def delete_document(document_id: str):
    """Delete document persistence, generated history, cache, and local file."""

    if not _valid_document_id(document_id):
        return jsonify({"error": "Invalid document ID"}), 400

    try:
        if is_database_configured():
            deleted = get_database().delete_document(document_id)
            if deleted is None:
                return jsonify({"error": "Document not found"}), 404
            stored_filename = deleted["stored_filename"]
        else:
            document = documents_store.pop(document_id, None)
            if document is None:
                return jsonify({"error": "Document not found"}), 404
            stored_filename = document["stored_filename"]

        # The database transaction has committed before this point. Cache and
        # local upload cleanup are optional, repeatable, and never turn a
        # successful persistent delete into a 500 response.
        _cleanup_deleted_document(document_id, stored_filename)

        return jsonify({"message": "Document deleted successfully"})
    except Exception:
        current_app.logger.exception("Failed to delete document %s", document_id)
        return jsonify({"error": "Failed to delete document"}), 500


@documents_bp.route("/<document_id>/preview", methods=["GET"])
def preview_document(document_id: str):
    """Return a short preview, hydrating persisted RAG state when necessary."""

    if not _valid_document_id(document_id):
        return jsonify({"error": "Invalid document ID"}), 400

    try:
        rag_service = get_rag_service()
        if not rag_service.is_document_indexed(document_id):
            return jsonify({"error": "Document not found or not indexed"}), 404

        full_text = rag_service.get_full_text(document_id)
        preview = full_text[:2000] + ("..." if len(full_text) > 2000 else "")
        return jsonify({"preview": preview, "total_length": len(full_text)})
    except Exception:
        current_app.logger.exception("Failed to preview document %s", document_id)
        return jsonify({"error": "Failed to preview document"}), 500
