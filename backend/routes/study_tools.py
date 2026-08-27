"""Quiz, flashcard, summary, search, and document Q&A routes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from flask import Blueprint, current_app, jsonify, request

from config import get_database, is_database_configured
from services import get_groq_service, get_rag_service


study_tools_bp = Blueprint("study_tools", __name__)

# Explicit no-DATABASE_URL fallback. Persistent mode never reads from these
# stores, so a database outage cannot be disguised as an empty successful list.
quizzes_store: dict[str, list[dict[str, Any]]] = {}
flashcards_store: dict[str, list[dict[str, Any]]] = {}
summaries_store: dict[str, list[dict[str, Any]]] = {}


def _valid_document_id(document_id: str) -> bool:
    try:
        uuid.UUID(document_id)
    except (ValueError, AttributeError):
        return False
    return True


def _request_json() -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _bounded_integer(
    data: dict[str, Any],
    key: str,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    value = data.get(key, default)
    if isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{key} must be an integer") from error
    return min(max(parsed, minimum), maximum)


def _document_ready(document_id: str):
    if not _valid_document_id(document_id):
        return False, (jsonify({"error": "Invalid document ID"}), 400)
    if not get_rag_service().is_document_indexed(document_id):
        return False, (jsonify({"error": "Document not found or not indexed"}), 404)
    return True, None


def _created_at() -> str:
    return datetime.now(timezone.utc).isoformat()


@study_tools_bp.route("/quiz/<document_id>", methods=["POST"])
def generate_quiz(document_id: str):
    """Generate and optionally persist a quiz."""

    try:
        ready, error_response = _document_ready(document_id)
        if not ready:
            return error_response

        data = _request_json()
        try:
            num_questions = _bounded_integer(data, "num_questions", 5, 1, 10)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        question_type = data.get("question_type", "mixed")
        if question_type not in {"multiple_choice", "short_answer", "mixed"}:
            return jsonify({"error": "Invalid question_type"}), 400

        content = get_rag_service().get_full_text(document_id)
        quiz = get_groq_service().generate_quiz(
            content,
            num_questions,
            question_type,
        )

        quiz_id = str(uuid.uuid4())
        saved_to_database = False
        if "error" not in quiz:
            record = {
                "id": quiz_id,
                "document_id": document_id,
                "title": quiz.get("quiz_title", "自動生成測驗"),
                "questions": quiz.get("questions", []),
                "settings": {
                    "num_questions": num_questions,
                    "question_type": question_type,
                    "source_coverage": quiz["source_coverage"],
                },
                "created_at": _created_at(),
            }
            if is_database_configured():
                get_database().save_quiz(record)
                saved_to_database = True
            else:
                quizzes_store.setdefault(document_id, []).insert(0, record)

        return jsonify(
            {
                "document_id": document_id,
                "quiz_id": quiz_id,
                "quiz": quiz,
                "saved_to_database": saved_to_database,
            }
        )
    except Exception:
        current_app.logger.exception("Quiz generation failed for %s", document_id)
        return jsonify({"error": "Quiz generation failed"}), 500


@study_tools_bp.route("/flashcards/<document_id>", methods=["POST"])
def generate_flashcards(document_id: str):
    """Generate and optionally persist a flashcard deck."""

    try:
        ready, error_response = _document_ready(document_id)
        if not ready:
            return error_response

        data = _request_json()
        try:
            num_cards = _bounded_integer(data, "num_cards", 10, 5, 20)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

        content = get_rag_service().get_full_text(document_id)
        flashcards = get_groq_service().generate_flashcards(content, num_cards)

        flashcard_id = str(uuid.uuid4())
        saved_to_database = False
        if "error" not in flashcards:
            record = {
                "id": flashcard_id,
                "document_id": document_id,
                "deck_title": flashcards.get("deck_title", "自動生成閃卡"),
                "cards": flashcards.get("cards", []),
                "source_coverage": flashcards["source_coverage"],
                "created_at": _created_at(),
            }
            if is_database_configured():
                get_database().save_flashcards(record)
                saved_to_database = True
            else:
                flashcards_store.setdefault(document_id, []).insert(0, record)

        return jsonify(
            {
                "document_id": document_id,
                "flashcard_id": flashcard_id,
                "flashcards": flashcards,
                "saved_to_database": saved_to_database,
            }
        )
    except Exception:
        current_app.logger.exception(
            "Flashcard generation failed for %s",
            document_id,
        )
        return jsonify({"error": "Flashcard generation failed"}), 500


@study_tools_bp.route("/summary/<document_id>", methods=["POST"])
def generate_summary(document_id: str):
    """Generate and optionally persist a TL;DR summary."""

    try:
        ready, error_response = _document_ready(document_id)
        if not ready:
            return error_response

        data = _request_json()
        try:
            num_points = _bounded_integer(data, "num_points", 5, 3, 10)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

        content = get_rag_service().get_full_text(document_id)
        summary = get_groq_service().generate_summary(content, num_points)

        summary_id = str(uuid.uuid4())
        saved_to_database = False
        if "error" not in summary:
            record = {
                "id": summary_id,
                "document_id": document_id,
                "document_title": summary.get("document_title", ""),
                "tldr": summary.get("tldr", ""),
                "key_points": summary.get("key_points", []),
                "keywords": summary.get("keywords", []),
                "source_coverage": summary["source_coverage"],
                "created_at": _created_at(),
            }
            if is_database_configured():
                get_database().save_summary(record)
                saved_to_database = True
            else:
                summaries_store.setdefault(document_id, []).insert(0, record)

        return jsonify(
            {
                "document_id": document_id,
                "summary_id": summary_id,
                "summary": summary,
                "saved_to_database": saved_to_database,
            }
        )
    except Exception:
        current_app.logger.exception("Summary generation failed for %s", document_id)
        return jsonify({"error": "Summary generation failed"}), 500


@study_tools_bp.route("/ask/<document_id>", methods=["POST"])
def ask_question(document_id: str):
    """Answer a question using the document's most relevant chunks."""

    try:
        ready, error_response = _document_ready(document_id)
        if not ready:
            return error_response

        question = str(_request_json().get("question", "")).strip()
        if not question:
            return jsonify({"error": "Question is required"}), 400
        if len(question) > 4000:
            return jsonify({"error": "Question is too long"}), 400

        rag_service = get_rag_service()
        context = rag_service.get_context_for_query(document_id, question)
        sources = rag_service.search(document_id, question, top_k=3)
        answer = get_groq_service().answer_question(question, context)

        return jsonify(
            {
                "document_id": document_id,
                "question": question,
                "answer": answer,
                "sources": sources,
            }
        )
    except Exception:
        current_app.logger.exception("Document Q&A failed for %s", document_id)
        return jsonify({"error": "Question answering failed"}), 500


@study_tools_bp.route("/search/<document_id>", methods=["POST"])
def search_document(document_id: str):
    """Return semantically similar document chunks."""

    try:
        ready, error_response = _document_ready(document_id)
        if not ready:
            return error_response

        data = _request_json()
        query = str(data.get("query", "")).strip()
        if not query:
            return jsonify({"error": "Query is required"}), 400
        if len(query) > 4000:
            return jsonify({"error": "Query is too long"}), 400
        try:
            top_k = _bounded_integer(data, "top_k", 5, 1, 20)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400

        results = get_rag_service().search(document_id, query, top_k)
        return jsonify(
            {
                "document_id": document_id,
                "query": query,
                "results": results,
            }
        )
    except Exception:
        current_app.logger.exception("Document search failed for %s", document_id)
        return jsonify({"error": "Document search failed"}), 500


@study_tools_bp.route("/flashcards/<document_id>", methods=["GET"])
def get_flashcards_history(document_id: str):
    return _history_response(
        document_id,
        "flashcards",
        flashcards_store,
        lambda: get_database().get_flashcards(document_id),
    )


@study_tools_bp.route("/quizzes/<document_id>", methods=["GET"])
def get_quizzes_history(document_id: str):
    return _history_response(
        document_id,
        "quizzes",
        quizzes_store,
        lambda: get_database().get_quizzes(document_id),
    )


@study_tools_bp.route("/summaries/<document_id>", methods=["GET"])
def get_summaries_history(document_id: str):
    return _history_response(
        document_id,
        "summaries",
        summaries_store,
        lambda: get_database().get_summaries(document_id),
    )


def _history_response(
    document_id: str,
    response_key: str,
    fallback_store: dict[str, list[dict[str, Any]]],
    database_loader,
):
    if not _valid_document_id(document_id):
        return jsonify({"error": "Invalid document ID"}), 400
    try:
        if is_database_configured():
            history = database_loader()
        else:
            history = fallback_store.get(document_id, [])
        return jsonify({"document_id": document_id, response_key: history})
    except Exception:
        current_app.logger.exception(
            "Failed to retrieve %s history for %s",
            response_key,
            document_id,
        )
        return jsonify({"error": f"Failed to retrieve {response_key} history"}), 500
