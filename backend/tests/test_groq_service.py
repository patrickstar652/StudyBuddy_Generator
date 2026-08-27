import json
from types import SimpleNamespace

import pytest

from services.groq_service import GroqService


class CharacterTokenizer:
    def encode(self, text):
        return [ord(character) for character in text]

    def decode(self, tokens):
        return "".join(chr(token) for token in tokens)


def _service_with_response(payload, captured=None):
    service = GroqService.__new__(GroqService)
    service.model = "openai/gpt-oss-120b"
    service._tokenizer = CharacterTokenizer()

    def fake_call(_system_prompt, user_prompt, **_kwargs):
        if captured is not None:
            captured["user_prompt"] = user_prompt
            captured["response_format"] = _kwargs.get("response_format")
        return json.dumps(payload, ensure_ascii=False)

    service._call_llm = fake_call
    return service


def _valid_mixed_quiz():
    return {
        "quiz_title": "測驗",
        "questions": [
            {
                "id": 1,
                "type": "multiple_choice",
                "question": "問題一？",
                "options": ["A. 一", "B. 二", "C. 三", "D. 四"],
                "correct_answer": "A",
                "explanation": "解釋一",
            },
            {
                "id": 2,
                "type": "short_answer",
                "question": "問題二？",
                "expected_answer": "答案二",
                "explanation": "解釋二",
            },
        ],
    }


def test_groq_service_fails_fast_without_api_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="GROQ_API_KEY"):
        GroqService()


def test_structured_call_forwards_json_response_format():
    captured = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content='{"ok": true}'))]
            )

    service = GroqService.__new__(GroqService)
    service.model = "openai/gpt-oss-120b"
    service.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions())
    )

    result = service._call_llm(
        "system",
        "user",
        response_format={"type": "json_object"},
    )

    assert result == '{"ok": true}'
    assert captured["model"] == "openai/gpt-oss-120b"
    assert captured["response_format"] == {"type": "json_object"}


def test_long_content_sampling_includes_tail_and_returns_coverage():
    captured = {}
    service = _service_with_response(_valid_mixed_quiz(), captured)
    service.QUIZ_SOURCE_TOKEN_BUDGET = 120
    content = "BEGIN_SENTINEL\n" + ("middle section content\n" * 500) + "END_SENTINEL"

    result = service.generate_quiz(content, num_questions=2, question_type="mixed")

    assert "error" not in result
    assert "BEGIN_SENTINEL" in captured["user_prompt"]
    assert "END_SENTINEL" in captured["user_prompt"]
    coverage = result["source_coverage"]
    assert coverage["strategy"] == "representative_token_segments"
    assert coverage["truncated"] is True
    assert coverage["includes_start"] is True
    assert coverage["includes_end"] is True
    assert coverage["selected_ranges"][0][0] == 0
    assert coverage["selected_ranges"][-1][1] == coverage["source_token_count"]
    assert coverage["selected_token_count"] <= 120


def _assert_all_objects_are_strict(schema):
    if schema.get("type") == "object":
        assert schema["additionalProperties"] is False
        assert set(schema["required"]) == set(schema["properties"])
        for child in schema["properties"].values():
            _assert_all_objects_are_strict(child)
    if schema.get("type") == "array":
        _assert_all_objects_are_strict(schema["items"])
    for child in schema.get("anyOf", []):
        _assert_all_objects_are_strict(child)


def test_quiz_generation_uses_groq_strict_json_schema():
    captured = {}
    service = _service_with_response(_valid_mixed_quiz(), captured)

    result = service.generate_quiz("content", num_questions=2, question_type="mixed")

    assert "error" not in result
    response_format = captured["response_format"]
    assert response_format["type"] == "json_schema"
    assert response_format["json_schema"]["strict"] is True
    schema = response_format["json_schema"]["schema"]
    _assert_all_objects_are_strict(schema)
    alternatives = schema["properties"]["questions"]["items"]["anyOf"]
    assert alternatives[0]["properties"]["correct_answer"]["enum"] == [
        "A",
        "B",
        "C",
        "D",
    ]
    assert "expected_answer" in alternatives[1]["properties"]


def test_unknown_model_falls_back_to_json_object_mode():
    service = GroqService.__new__(GroqService)
    service.model = "custom/unsupported-model"

    response_format = service._summary_response_format()

    assert response_format == {"type": "json_object"}


def test_quiz_rejects_valid_json_with_wrong_count():
    service = _service_with_response({"quiz_title": "測驗", "questions": []})

    result = service.generate_quiz("content", num_questions=2, question_type="mixed")

    assert result["questions"] == []
    assert "error" in result


def test_flashcards_reject_valid_json_with_wrong_shape():
    service = _service_with_response(
        {
            "deck_title": "卡片",
            "cards": [
                {"id": 1, "front": "正面", "back": "背面"},
            ],
        }
    )

    result = service.generate_flashcards("content", num_cards=1)

    assert result["cards"] == []
    assert "error" in result


def test_summary_rejects_valid_json_with_invalid_importance():
    service = _service_with_response(
        {
            "document_title": "文件",
            "tldr": "摘要",
            "key_points": [
                {
                    "id": 1,
                    "title": "重點",
                    "description": "說明",
                    "importance": "urgent",
                }
            ],
            "keywords": ["關鍵詞"],
        }
    )

    result = service.generate_summary("content", num_points=1)

    assert result["key_points"] == []
    assert "error" in result
