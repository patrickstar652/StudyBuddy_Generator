"""
學習工具路由
處理測驗生成、閃卡生成、摘要生成等功能
"""

import os
import uuid
from flask import Blueprint, request, jsonify

from services import get_groq_service, get_rag_service
from config import get_supabase

study_tools_bp = Blueprint('study_tools', __name__)

# 是否使用 Supabase
USE_SUPABASE = os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_KEY')


@study_tools_bp.route('/quiz/<doc_id>', methods=['POST'])
def generate_quiz(doc_id: str):
    """
    生成隨堂考
    
    Request body:
    {
        "num_questions": 5,  // 可選，默認 5
        "question_type": "mixed"  // 可選: multiple_choice, short_answer, mixed
    }
    """
    try:
        rag_service = get_rag_service()
        
        if not rag_service.is_document_indexed(doc_id):
            return jsonify({'error': 'Document not found or not indexed'}), 404
        
        # 獲取請求參數
        data = request.get_json() or {}
        num_questions = min(max(data.get('num_questions', 5), 1), 10)
        question_type = data.get('question_type', 'mixed')
        
        if question_type not in ['multiple_choice', 'short_answer', 'mixed']:
            question_type = 'mixed'
        
        # 獲取文件內容
        content = rag_service.get_full_text(doc_id)
        
        # 生成測驗
        groq_service = get_groq_service()
        quiz = groq_service.generate_quiz(content, num_questions, question_type)
        
        # 存入 Supabase（如果已配置）
        quiz_id = str(uuid.uuid4())
        if USE_SUPABASE:
            try:
                supabase = get_supabase()
                supabase.save_quiz({
                    'id': quiz_id,
                    'document_id': doc_id,
                    'title': quiz.get('quiz_title', '自動生成測驗'),
                    'questions': quiz.get('questions', []),
                    'settings': {'num_questions': num_questions, 'question_type': question_type}
                })
            except Exception as e:
                print(f"Failed to save quiz to Supabase: {e}")
        
        return jsonify({
            'document_id': doc_id,
            'quiz_id': quiz_id,
            'quiz': quiz,
            'saved_to_supabase': USE_SUPABASE
        })
        
    except Exception as e:
        import traceback
        print(f"Quiz generation error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@study_tools_bp.route('/flashcards/<doc_id>', methods=['POST'])
def generate_flashcards(doc_id: str):
    """
    生成閃卡
    
    Request body:
    {
        "num_cards": 10  // 可選，默認 10
    }
    """
    try:
        rag_service = get_rag_service()
        
        if not rag_service.is_document_indexed(doc_id):
            return jsonify({'error': 'Document not found or not indexed'}), 404
        
        # 獲取請求參數
        data = request.get_json() or {}
        num_cards = min(max(data.get('num_cards', 10), 5), 20)
        
        # 獲取文件內容
        content = rag_service.get_full_text(doc_id)
        
        # 生成閃卡
        groq_service = get_groq_service()
        flashcards = groq_service.generate_flashcards(content, num_cards)
        
        # 存入 Supabase（如果已配置）
        flashcard_id = str(uuid.uuid4())
        if USE_SUPABASE:
            try:
                supabase = get_supabase()
                supabase.save_flashcards({
                    'id': flashcard_id,
                    'document_id': doc_id,
                    'deck_title': flashcards.get('deck_title', '自動生成閃卡'),
                    'cards': flashcards.get('cards', [])
                })
            except Exception as e:
                print(f"Failed to save flashcards to Supabase: {e}")
        
        return jsonify({
            'document_id': doc_id,
            'flashcard_id': flashcard_id,
            'flashcards': flashcards,
            'saved_to_supabase': USE_SUPABASE
        })
        
    except Exception as e:
        import traceback
        print(f"Flashcards generation error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@study_tools_bp.route('/summary/<doc_id>', methods=['POST'])
def generate_summary(doc_id: str):
    """
    生成 TL;DR 摘要
    
    Request body:
    {
        "num_points": 5  // 可選，默認 5
    }
    """
    try:
        rag_service = get_rag_service()
        
        if not rag_service.is_document_indexed(doc_id):
            return jsonify({'error': 'Document not found or not indexed'}), 404
        
        # 獲取請求參數
        data = request.get_json() or {}
        num_points = min(max(data.get('num_points', 5), 3), 10)
        
        # 獲取文件內容
        content = rag_service.get_full_text(doc_id)
        
        # 生成摘要
        groq_service = get_groq_service()
        summary = groq_service.generate_summary(content, num_points)
        
        # 存入 Supabase（如果已配置）
        summary_id = str(uuid.uuid4())
        if USE_SUPABASE:
            try:
                supabase = get_supabase()
                supabase.client.table('summaries').insert({
                    'id': summary_id,
                    'document_id': doc_id,
                    'document_title': summary.get('document_title', ''),
                    'tldr': summary.get('tldr', ''),
                    'key_points': summary.get('key_points', []),
                    'keywords': summary.get('keywords', [])
                }).execute()
            except Exception as e:
                print(f"Failed to save summary to Supabase: {e}")
        
        return jsonify({
            'document_id': doc_id,
            'summary_id': summary_id,
            'summary': summary,
            'saved_to_supabase': USE_SUPABASE
        })
        
    except Exception as e:
        import traceback
        print(f"Summary generation error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@study_tools_bp.route('/ask/<doc_id>', methods=['POST'])
def ask_question(doc_id: str):
    """
    向文件提問（RAG 問答）
    
    Request body:
    {
        "question": "你的問題"
    }
    """
    try:
        rag_service = get_rag_service()
        
        if not rag_service.is_document_indexed(doc_id):
            return jsonify({'error': 'Document not found or not indexed'}), 404
        
        # 獲取請求參數
        data = request.get_json() or {}
        question = data.get('question', '').strip()
        
        if not question:
            return jsonify({'error': 'Question is required'}), 400
        
        # 獲取相關上下文
        context = rag_service.get_context_for_query(doc_id, question)
        
        # 獲取相關區塊用於顯示來源
        sources = rag_service.search(doc_id, question, top_k=3)
        
        # 生成回答
        groq_service = get_groq_service()
        answer = groq_service.answer_question(question, context)
        
        return jsonify({
            'document_id': doc_id,
            'question': question,
            'answer': answer,
            'sources': sources
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@study_tools_bp.route('/search/<doc_id>', methods=['POST'])
def search_document(doc_id: str):
    """
    在文件中搜索
    
    Request body:
    {
        "query": "搜索關鍵字",
        "top_k": 5  // 可選
    }
    """
    try:
        rag_service = get_rag_service()
        
        if not rag_service.is_document_indexed(doc_id):
            return jsonify({'error': 'Document not found or not indexed'}), 404
        
        # 獲取請求參數
        data = request.get_json() or {}
        query = data.get('query', '').strip()
        top_k = min(max(data.get('top_k', 5), 1), 20)
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # 搜索
        results = rag_service.search(doc_id, query, top_k)
        
        return jsonify({
            'document_id': doc_id,
            'query': query,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ 歷史記錄 API ============

@study_tools_bp.route('/flashcards/<doc_id>', methods=['GET'])
def get_flashcards_history(doc_id: str):
    """
    獲取文件的閃卡歷史記錄
    """
    try:
        if not USE_SUPABASE:
            return jsonify({'flashcards': [], 'message': 'Supabase not configured'}), 200
        
        supabase = get_supabase()
        result = supabase.get_flashcards(doc_id)
        
        return jsonify({
            'document_id': doc_id,
            'flashcards': result.data if result.data else []
        })
        
    except Exception as e:
        print(f"Failed to get flashcards history: {e}")
        return jsonify({'error': str(e)}), 500


@study_tools_bp.route('/quizzes/<doc_id>', methods=['GET'])
def get_quizzes_history(doc_id: str):
    """
    獲取文件的測驗歷史記錄
    """
    try:
        if not USE_SUPABASE:
            return jsonify({'quizzes': [], 'message': 'Supabase not configured'}), 200
        
        supabase = get_supabase()
        result = supabase.get_quizzes(doc_id)
        
        return jsonify({
            'document_id': doc_id,
            'quizzes': result.data if result.data else []
        })
        
    except Exception as e:
        print(f"Failed to get quizzes history: {e}")
        return jsonify({'error': str(e)}), 500


@study_tools_bp.route('/summaries/<doc_id>', methods=['GET'])
def get_summaries_history(doc_id: str):
    """
    獲取文件的摘要歷史記錄
    """
    try:
        if not USE_SUPABASE:
            return jsonify({'summaries': [], 'message': 'Supabase not configured'}), 200
        
        supabase = get_supabase()
        result = supabase.client.table('summaries').select('*').eq('document_id', doc_id).order('created_at', desc=True).execute()
        
        return jsonify({
            'document_id': doc_id,
            'summaries': result.data if result.data else []
        })
        
    except Exception as e:
        print(f"Failed to get summaries history: {e}")
        return jsonify({'error': str(e)}), 500
