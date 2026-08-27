"""Groq-backed quiz, flashcard, summary, and Q&A generation."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Callable, Optional

import tiktoken
from dotenv import load_dotenv
from groq import Groq


load_dotenv()
logger = logging.getLogger(__name__)

STRICT_SCHEMA_MODELS = {
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
}


class StructuredOutputError(ValueError):
    """Raised when syntactically valid JSON violates the expected contract."""


@dataclass(frozen=True)
class ContentSelection:
    """Representative source text and auditable coverage metadata."""

    text: str
    coverage: dict[str, Any]


def _is_identifier(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _require_exact_keys(
    value: dict[str, Any],
    expected: set[str],
    context: str,
) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise StructuredOutputError(
            f"{context} has invalid fields (missing={missing}, extra={extra})"
        )


def _require_nonempty_string(value: Any, context: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise StructuredOutputError(f"{context} must be a non-empty string")


def _closed_object(properties: dict[str, Any]) -> dict[str, Any]:
    """Build an object schema compatible with Groq strict output mode."""

    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


class GroqService:
    QUIZ_SOURCE_TOKEN_BUDGET = 6000
    FLASHCARD_SOURCE_TOKEN_BUDGET = 6000
    SUMMARY_SOURCE_TOKEN_BUDGET = 9000
    REPRESENTATIVE_SEGMENTS = 4

    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is required for quiz, flashcard, summary, and Q&A generation"
            )

        self.client = Groq(api_key=api_key)
        self.model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self._tokenizer = tiktoken.get_encoding("cl100k_base")

    def _call_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        response_format: Optional[dict[str, str]] = None,
    ) -> str:
        """Call Groq and return the first response message."""

        try:
            request_options: dict[str, Any] = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "max_tokens": 4096,
            }
            if response_format is not None:
                request_options["response_format"] = response_format
            response = self.client.chat.completions.create(**request_options)
            return response.choices[0].message.content
        except Exception as error:
            raise RuntimeError(f"LLM call failed: {error}") from error

    def _structured_response_format(
        self,
        name: str,
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        """Use strict schemas where Groq guarantees constrained decoding."""

        if self.model not in STRICT_SCHEMA_MODELS:
            logger.warning(
                "Model %s is not configured for strict schema output; "
                "falling back to JSON object mode",
                self.model,
            )
            return {"type": "json_object"}
        return {
            "type": "json_schema",
            "json_schema": {
                "name": name,
                "strict": True,
                "schema": schema,
            },
        }

    @staticmethod
    def _multiple_choice_schema() -> dict[str, Any]:
        return _closed_object(
            {
                "id": {"type": "integer"},
                "type": {"type": "string", "enum": ["multiple_choice"]},
                "question": {"type": "string"},
                "options": {"type": "array", "items": {"type": "string"}},
                "correct_answer": {
                    "type": "string",
                    "enum": ["A", "B", "C", "D"],
                },
                "explanation": {"type": "string"},
            }
        )

    @staticmethod
    def _short_answer_schema() -> dict[str, Any]:
        return _closed_object(
            {
                "id": {"type": "integer"},
                "type": {"type": "string", "enum": ["short_answer"]},
                "question": {"type": "string"},
                "expected_answer": {"type": "string"},
                "explanation": {"type": "string"},
            }
        )

    def _quiz_response_format(self, question_type: str) -> dict[str, Any]:
        if question_type == "multiple_choice":
            item_schema = self._multiple_choice_schema()
        elif question_type == "short_answer":
            item_schema = self._short_answer_schema()
        else:
            item_schema = {
                "anyOf": [
                    self._multiple_choice_schema(),
                    self._short_answer_schema(),
                ]
            }
        return self._structured_response_format(
            "studybuddy_quiz",
            _closed_object(
                {
                    "quiz_title": {"type": "string"},
                    "questions": {"type": "array", "items": item_schema},
                }
            ),
        )

    def _flashcard_response_format(self) -> dict[str, Any]:
        card_schema = _closed_object(
            {
                "id": {"type": "integer"},
                "front": {"type": "string"},
                "back": {"type": "string"},
                "category": {"type": "string"},
            }
        )
        return self._structured_response_format(
            "studybuddy_flashcards",
            _closed_object(
                {
                    "deck_title": {"type": "string"},
                    "cards": {"type": "array", "items": card_schema},
                }
            ),
        )

    def _summary_response_format(self) -> dict[str, Any]:
        point_schema = _closed_object(
            {
                "id": {"type": "integer"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "importance": {
                    "type": "string",
                    "enum": ["high", "medium", "low"],
                },
            }
        )
        return self._structured_response_format(
            "studybuddy_summary",
            _closed_object(
                {
                    "document_title": {"type": "string"},
                    "tldr": {"type": "string"},
                    "key_points": {"type": "array", "items": point_schema},
                    "keywords": {"type": "array", "items": {"type": "string"}},
                }
            ),
        )

    def _encoding(self):
        tokenizer = getattr(self, "_tokenizer", None)
        if tokenizer is None:
            tokenizer = tiktoken.get_encoding("cl100k_base")
            self._tokenizer = tokenizer
        return tokenizer

    def _select_representative_content(
        self,
        content: str,
        max_source_tokens: int,
        segment_count: int | None = None,
    ) -> ContentSelection:
        """Select token windows across the whole document, including its tail."""

        if max_source_tokens <= 0:
            raise ValueError("max_source_tokens must be positive")

        tokenizer = self._encoding()
        tokens = tokenizer.encode(content)
        total_tokens = len(tokens)
        if total_tokens <= max_source_tokens:
            ranges = [[0, total_tokens]] if total_tokens else []
            return ContentSelection(
                text=content,
                coverage={
                    "strategy": "full_document",
                    "source_token_count": total_tokens,
                    "selected_token_count": total_tokens,
                    "coverage_ratio": 1.0,
                    "segment_count": 1 if total_tokens else 0,
                    "includes_start": bool(total_tokens),
                    "includes_end": bool(total_tokens),
                    "truncated": False,
                    "selected_ranges": ranges,
                },
            )

        requested_segments = segment_count or self.REPRESENTATIVE_SEGMENTS
        segments = max(2, min(requested_segments, max_source_tokens, total_tokens))
        base_window = max_source_tokens // segments
        remainder = max_source_tokens % segments
        selected_ranges: list[list[int]] = []
        rendered_sections: list[str] = []

        for index in range(segments):
            partition_start = total_tokens * index // segments
            partition_end = total_tokens * (index + 1) // segments
            partition_length = partition_end - partition_start
            window_length = min(
                partition_length,
                base_window + (1 if index < remainder else 0),
            )

            if index == 0:
                start = partition_start
            elif index == segments - 1:
                start = partition_end - window_length
            else:
                start = partition_start + (partition_length - window_length) // 2
            end = start + window_length
            selected_ranges.append([start, end])
            section_text = tokenizer.decode(tokens[start:end])
            rendered_sections.append(
                f"【代表片段 {index + 1}/{segments}｜來源 token {start + 1}-{end}】\n"
                f"{section_text}"
            )

        selected_tokens = sum(end - start for start, end in selected_ranges)
        coverage = {
            "strategy": "representative_token_segments",
            "source_token_count": total_tokens,
            "selected_token_count": selected_tokens,
            "coverage_ratio": round(selected_tokens / total_tokens, 6),
            "segment_count": segments,
            "includes_start": selected_ranges[0][0] == 0,
            "includes_end": selected_ranges[-1][1] == total_tokens,
            "truncated": True,
            "selected_ranges": selected_ranges,
        }
        return ContentSelection(
            text="\n\n---\n\n".join(rendered_sections),
            coverage=coverage,
        )

    def _prepare_source(
        self,
        content: str,
        max_source_tokens: int,
        task: str,
    ) -> ContentSelection:
        selection = self._select_representative_content(
            content,
            max_source_tokens,
        )
        logger.info(
            "Prepared %s source with strategy=%s selected=%s/%s tokens tail=%s",
            task,
            selection.coverage["strategy"],
            selection.coverage["selected_token_count"],
            selection.coverage["source_token_count"],
            selection.coverage["includes_end"],
        )
        return selection

    @staticmethod
    def _parse_json_object(response: str) -> dict[str, Any]:
        if not isinstance(response, str):
            raise StructuredOutputError("response must be text")
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        try:
            parsed = json.loads(cleaned.strip())
        except json.JSONDecodeError as error:
            raise StructuredOutputError("response is not valid JSON") from error
        if not isinstance(parsed, dict):
            raise StructuredOutputError("top-level JSON value must be an object")
        return parsed

    def _validated_result(
        self,
        response: str,
        validator: Callable[[dict[str, Any]], None],
        coverage: dict[str, Any],
        fallback: dict[str, Any],
        label: str,
    ) -> dict[str, Any]:
        try:
            result = self._parse_json_object(response)
            validator(result)
        except StructuredOutputError as error:
            logger.warning("Rejected malformed %s JSON: %s", label, error)
            return {
                **fallback,
                "source_coverage": coverage,
                "raw_response": response[:4000] if isinstance(response, str) else "",
                "error": f"生成的{label}格式不正確，請重試：{error}",
            }
        return {**result, "source_coverage": coverage}

    @staticmethod
    def _validate_quiz(
        value: dict[str, Any],
        expected_count: int,
        requested_type: str,
    ) -> None:
        _require_exact_keys(value, {"quiz_title", "questions"}, "quiz")
        _require_nonempty_string(value["quiz_title"], "quiz.quiz_title")
        questions = value["questions"]
        if not isinstance(questions, list) or len(questions) != expected_count:
            raise StructuredOutputError(
                f"quiz.questions must contain exactly {expected_count} items"
            )

        observed_types: list[str] = []
        for index, question in enumerate(questions, start=1):
            if not isinstance(question, dict):
                raise StructuredOutputError(f"quiz.questions[{index}] must be an object")
            question_type = question.get("type")
            if question_type == "multiple_choice":
                expected_keys = {
                    "id",
                    "type",
                    "question",
                    "options",
                    "correct_answer",
                    "explanation",
                }
                _require_exact_keys(question, expected_keys, f"quiz.questions[{index}]")
                options = question["options"]
                if (
                    not isinstance(options, list)
                    or len(options) != 4
                    or any(not isinstance(option, str) or not option.strip() for option in options)
                    or len(set(options)) != 4
                ):
                    raise StructuredOutputError(
                        f"quiz.questions[{index}].options must contain four strings"
                    )
                if (
                    not isinstance(question["correct_answer"], str)
                    or question["correct_answer"] not in {"A", "B", "C", "D"}
                ):
                    raise StructuredOutputError(
                        f"quiz.questions[{index}].correct_answer must be A, B, C, or D"
                    )
            elif question_type == "short_answer":
                expected_keys = {
                    "id",
                    "type",
                    "question",
                    "expected_answer",
                    "explanation",
                }
                _require_exact_keys(question, expected_keys, f"quiz.questions[{index}]")
                _require_nonempty_string(
                    question["expected_answer"],
                    f"quiz.questions[{index}].expected_answer",
                )
            else:
                raise StructuredOutputError(
                    f"quiz.questions[{index}].type is unsupported"
                )

            if not _is_identifier(question["id"]) or question["id"] != index:
                raise StructuredOutputError(
                    f"quiz.questions[{index}].id must equal {index}"
                )
            _require_nonempty_string(
                question["question"],
                f"quiz.questions[{index}].question",
            )
            _require_nonempty_string(
                question["explanation"],
                f"quiz.questions[{index}].explanation",
            )
            observed_types.append(question_type)

        if requested_type in {"multiple_choice", "short_answer"}:
            if any(item_type != requested_type for item_type in observed_types):
                raise StructuredOutputError(
                    f"quiz contains a type other than requested {requested_type}"
                )
        elif abs(
            observed_types.count("multiple_choice")
            - observed_types.count("short_answer")
        ) > 1:
            raise StructuredOutputError("mixed quiz types must be evenly balanced")

    @staticmethod
    def _validate_flashcards(value: dict[str, Any], expected_count: int) -> None:
        _require_exact_keys(value, {"deck_title", "cards"}, "flashcards")
        _require_nonempty_string(value["deck_title"], "flashcards.deck_title")
        cards = value["cards"]
        if not isinstance(cards, list) or len(cards) != expected_count:
            raise StructuredOutputError(
                f"flashcards.cards must contain exactly {expected_count} items"
            )
        expected_keys = {"id", "front", "back", "category"}
        for index, card in enumerate(cards, start=1):
            if not isinstance(card, dict):
                raise StructuredOutputError(f"flashcards.cards[{index}] must be an object")
            _require_exact_keys(card, expected_keys, f"flashcards.cards[{index}]")
            if not _is_identifier(card["id"]) or card["id"] != index:
                raise StructuredOutputError(
                    f"flashcards.cards[{index}].id must equal {index}"
                )
            for field in ("front", "back", "category"):
                _require_nonempty_string(
                    card[field],
                    f"flashcards.cards[{index}].{field}",
                )

    @staticmethod
    def _validate_summary(value: dict[str, Any], expected_count: int) -> None:
        _require_exact_keys(
            value,
            {"document_title", "tldr", "key_points", "keywords"},
            "summary",
        )
        _require_nonempty_string(value["document_title"], "summary.document_title")
        _require_nonempty_string(value["tldr"], "summary.tldr")
        key_points = value["key_points"]
        if not isinstance(key_points, list) or len(key_points) != expected_count:
            raise StructuredOutputError(
                f"summary.key_points must contain exactly {expected_count} items"
            )
        expected_keys = {"id", "title", "description", "importance"}
        for index, point in enumerate(key_points, start=1):
            if not isinstance(point, dict):
                raise StructuredOutputError(f"summary.key_points[{index}] must be an object")
            _require_exact_keys(point, expected_keys, f"summary.key_points[{index}]")
            if not _is_identifier(point["id"]) or point["id"] != index:
                raise StructuredOutputError(
                    f"summary.key_points[{index}].id must equal {index}"
                )
            _require_nonempty_string(
                point["title"],
                f"summary.key_points[{index}].title",
            )
            _require_nonempty_string(
                point["description"],
                f"summary.key_points[{index}].description",
            )
            if (
                not isinstance(point["importance"], str)
                or point["importance"] not in {"high", "medium", "low"}
            ):
                raise StructuredOutputError(
                    f"summary.key_points[{index}].importance is invalid"
                )

        keywords = value["keywords"]
        if (
            not isinstance(keywords, list)
            or not keywords
            or any(not isinstance(keyword, str) or not keyword.strip() for keyword in keywords)
        ):
            raise StructuredOutputError(
                "summary.keywords must contain at least one non-empty string"
            )

    def generate_quiz(
        self,
        content: str,
        num_questions: int = 5,
        question_type: str = "mixed",
    ) -> dict[str, Any]:
        """Generate a strictly validated quiz from representative source text."""

        selection = self._prepare_source(
            content,
            self.QUIZ_SOURCE_TOKEN_BUDGET,
            "quiz",
        )
        system_prompt = """你是一位專業的教育專家，擅長根據學習材料創建高品質的測驗題目。

請嚴格輸出一個 JSON 物件，且只能包含 quiz_title 與 questions。
每個題目的 id 必須從 1 連續編號。選擇題必須有四個選項、A-D 正確答案與解釋；簡答題必須有預期答案與解釋。
不要輸出 Markdown 或任何 JSON 以外的文字。"""
        type_instruction = {
            "multiple_choice": "全部使用 multiple_choice",
            "short_answer": "全部使用 short_answer",
            "mixed": "multiple_choice 與 short_answer 數量差不得超過一題",
        }
        sampling_note = (
            "內容為完整文件。"
            if not selection.coverage["truncated"]
            else "內容為涵蓋文件開頭、中段與結尾的代表性 token 片段。"
        )
        user_prompt = f"""請生成恰好 {num_questions} 道題目。
題型要求：{type_instruction[question_type]}
資料涵蓋方式：{sampling_note}

學習內容：
{selection.text}
"""
        response = self._call_llm(
            system_prompt,
            user_prompt,
            temperature=0.5,
            response_format=self._quiz_response_format(question_type),
        )
        return self._validated_result(
            response,
            lambda value: self._validate_quiz(value, num_questions, question_type),
            selection.coverage,
            {"quiz_title": "自動生成測驗", "questions": []},
            "測驗",
        )

    def generate_flashcards(
        self,
        content: str,
        num_cards: int = 10,
    ) -> dict[str, Any]:
        """Generate a strictly validated flashcard deck."""

        selection = self._prepare_source(
            content,
            self.FLASHCARD_SOURCE_TOKEN_BUDGET,
            "flashcards",
        )
        system_prompt = """你是一位專業的教育專家，擅長提取學習材料中的關鍵概念並製作閃卡。

請嚴格輸出一個 JSON 物件，且只能包含 deck_title 與 cards。
每張卡片只能包含 id、front、back、category；id 必須從 1 連續編號。
不要輸出 Markdown 或任何 JSON 以外的文字。"""
        sampling_note = (
            "內容為完整文件。"
            if not selection.coverage["truncated"]
            else "內容為涵蓋文件開頭、中段與結尾的代表性 token 片段。"
        )
        user_prompt = f"""請生成恰好 {num_cards} 張閃卡。
資料涵蓋方式：{sampling_note}

學習內容：
{selection.text}
"""
        response = self._call_llm(
            system_prompt,
            user_prompt,
            temperature=0.3,
            response_format=self._flashcard_response_format(),
        )
        return self._validated_result(
            response,
            lambda value: self._validate_flashcards(value, num_cards),
            selection.coverage,
            {"deck_title": "自動生成閃卡", "cards": []},
            "閃卡",
        )

    def generate_summary(
        self,
        content: str,
        num_points: int = 5,
    ) -> dict[str, Any]:
        """Generate a strictly validated representative summary."""

        selection = self._prepare_source(
            content,
            self.SUMMARY_SOURCE_TOKEN_BUDGET,
            "summary",
        )
        system_prompt = """你是一位專業的文件分析專家，擅長將複雜學術內容精煉成重點摘要。

請嚴格輸出一個 JSON 物件，且只能包含 document_title、tldr、key_points、keywords。
每個 key point 只能包含 id、title、description、importance；id 必須從 1 連續編號，importance 只能是 high、medium、low。
不要輸出 Markdown 或任何 JSON 以外的文字。"""
        sampling_note = (
            "內容為完整文件。"
            if not selection.coverage["truncated"]
            else "內容為涵蓋文件開頭、中段與結尾的代表性 token 片段；摘要必須綜合所有片段。"
        )
        user_prompt = f"""請生成恰好 {num_points} 個核心重點。
資料涵蓋方式：{sampling_note}

學習內容：
{selection.text}
"""
        response = self._call_llm(
            system_prompt,
            user_prompt,
            temperature=0.3,
            response_format=self._summary_response_format(),
        )
        return self._validated_result(
            response,
            lambda value: self._validate_summary(value, num_points),
            selection.coverage,
            {
                "document_title": "文件摘要",
                "tldr": "",
                "key_points": [],
                "keywords": [],
            },
            "摘要",
        )

    def answer_question(self, question: str, context: str) -> str:
        """Answer a question using already-retrieved RAG context."""

        system_prompt = """你是一位知識淵博的學習助手。請根據提供的學習材料內容回答使用者的問題。

規則：
1. 只根據提供的內容回答，不要編造資訊
2. 如果內容中沒有相關資訊，請誠實說明
3. 回答要清晰、有條理
4. 可以適當引用原文來支持回答"""
        user_prompt = f"""參考資料：
{context}

問題：{question}

請根據以上參考資料回答問題。"""
        return self._call_llm(system_prompt, user_prompt, temperature=0.5)


def get_groq_service() -> GroqService:
    """Return a configured Groq service."""

    return GroqService()
