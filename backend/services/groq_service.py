"""
Groq LLM 服務
處理所有 AI 生成任務：測驗、閃卡、摘要
"""

import os
import json
from typing import List, Dict, Any
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class GroqService:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY must be set in environment variables")
        
        self.client = Groq(api_key=api_key)
        self.model = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
    
    def _call_llm(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        """調用 Groq LLM"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature,
                max_tokens=4096
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"LLM call failed: {str(e)}")
    
    def generate_quiz(self, content: str, num_questions: int = 5, question_type: str = "mixed") -> Dict[str, Any]:
        """
        生成隨堂考
        
        Args:
            content: 文件內容
            num_questions: 題目數量 (5-10)
            question_type: 題目類型 (multiple_choice, short_answer, mixed)
        
        Returns:
            包含測驗題目的字典
        """
        system_prompt = """你是一位專業的教育專家，擅長根據學習材料創建高品質的測驗題目。
        
你的任務是根據提供的內容生成測驗題目。請確保：
1. 題目涵蓋內容的重要概念
2. 難度適中，適合學生自我測驗
3. 選擇題有一個正確答案和三個干擾選項
4. 簡答題需要明確的預期答案

請以 JSON 格式返回，格式如下：
{
    "quiz_title": "測驗標題",
    "questions": [
        {
            "id": 1,
            "type": "multiple_choice",
            "question": "題目內容",
            "options": ["A. 選項1", "B. 選項2", "C. 選項3", "D. 選項4"],
            "correct_answer": "A",
            "explanation": "解釋為什麼這是正確答案"
        },
        {
            "id": 2,
            "type": "short_answer",
            "question": "簡答題內容",
            "expected_answer": "預期答案要點",
            "explanation": "詳細解釋"
        }
    ]
}

只返回 JSON，不要包含其他文字。"""

        type_instruction = {
            "multiple_choice": "只生成選擇題",
            "short_answer": "只生成簡答題",
            "mixed": "混合生成選擇題和簡答題（各半）"
        }
        
        user_prompt = f"""請根據以下學習內容生成 {num_questions} 道測驗題目。
題目類型要求：{type_instruction.get(question_type, type_instruction['mixed'])}

學習內容：
{content[:8000]}  # 限制內容長度避免 token 超限
"""

        response = self._call_llm(system_prompt, user_prompt, temperature=0.5)
        
        # 解析 JSON 回應
        try:
            # 移除可能的 markdown 標記
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            return json.loads(response.strip())
        except json.JSONDecodeError:
            return {
                "quiz_title": "自動生成測驗",
                "questions": [],
                "raw_response": response,
                "error": "無法解析生成的測驗，請重試"
            }
    
    def generate_flashcards(self, content: str, num_cards: int = 10) -> Dict[str, Any]:
        """
        生成閃卡
        
        Args:
            content: 文件內容
            num_cards: 閃卡數量
        
        Returns:
            包含閃卡的字典
        """
        system_prompt = """你是一位專業的教育專家，擅長提取學習材料中的關鍵概念並製作閃卡。

你的任務是從提供的內容中識別重要的：
1. 專業術語和定義
2. 關鍵概念和解釋
3. 重要人物/事件和說明
4. 公式/原理和用途

請以 JSON 格式返回，格式如下：
{
    "deck_title": "閃卡組標題",
    "cards": [
        {
            "id": 1,
            "front": "正面（術語/概念/問題）",
            "back": "背面（定義/解釋/答案）",
            "category": "分類標籤"
        }
    ]
}

只返回 JSON，不要包含其他文字。閃卡應該簡潔明瞭，適合快速複習。"""

        user_prompt = f"""請從以下學習內容中提取 {num_cards} 個最重要的概念，製作成閃卡。

學習內容：
{content[:8000]}
"""

        response = self._call_llm(system_prompt, user_prompt, temperature=0.3)
        
        try:
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            return json.loads(response.strip())
        except json.JSONDecodeError:
            return {
                "deck_title": "自動生成閃卡",
                "cards": [],
                "raw_response": response,
                "error": "無法解析生成的閃卡，請重試"
            }
    
    def generate_summary(self, content: str, num_points: int = 5) -> Dict[str, Any]:
        """
        生成 TL;DR 摘要
        
        Args:
            content: 文件內容
            num_points: 摘要要點數量
        
        Returns:
            包含摘要的字典
        """
        system_prompt = """你是一位專業的文件分析專家，擅長將複雜的學術內容精煉成易於理解的重點摘要。

你的任務是提取文件的核心要點，每個要點應該：
1. 捕捉一個重要的主要概念或發現
2. 簡潔但完整（1-3句話）
3. 使用清晰易懂的語言
4. 按重要性或邏輯順序排列

請以 JSON 格式返回，格式如下：
{
    "document_title": "文件標題（從內容推斷）",
    "tldr": "一句話總結整個文件",
    "key_points": [
        {
            "id": 1,
            "title": "要點標題",
            "description": "詳細說明",
            "importance": "high/medium/low"
        }
    ],
    "keywords": ["關鍵詞1", "關鍵詞2", "關鍵詞3"]
}

只返回 JSON，不要包含其他文字。"""

        user_prompt = f"""請為以下學習內容生成 {num_points} 個核心重點摘要（TL;DR）。

學習內容：
{content[:12000]}
"""

        response = self._call_llm(system_prompt, user_prompt, temperature=0.3)
        
        try:
            response = response.strip()
            if response.startswith("```json"):
                response = response[7:]
            if response.startswith("```"):
                response = response[3:]
            if response.endswith("```"):
                response = response[:-3]
            
            return json.loads(response.strip())
        except json.JSONDecodeError:
            return {
                "document_title": "文件摘要",
                "tldr": "",
                "key_points": [],
                "keywords": [],
                "raw_response": response,
                "error": "無法解析生成的摘要，請重試"
            }
    
    def answer_question(self, question: str, context: str) -> str:
        """
        基於上下文回答問題（RAG）
        
        Args:
            question: 使用者問題
            context: 相關文件內容
        
        Returns:
            回答字串
        """
        system_prompt = """你是一位知識淵博的學習助手。請根據提供的學習材料內容回答使用者的問題。

規則：
1. 只根據提供的內容回答，不要編造資訊
2. 如果內容中沒有相關資訊，請誠實說明
3. 回答要清晰、有條理
4. 可以適當引用原文來支持你的回答"""

        user_prompt = f"""參考資料：
{context}

問題：{question}

請根據以上參考資料回答問題。"""

        return self._call_llm(system_prompt, user_prompt, temperature=0.5)


def get_groq_service() -> GroqService:
    """獲取 Groq 服務實例"""
    return GroqService()
