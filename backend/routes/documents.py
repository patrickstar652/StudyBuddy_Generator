"""
文件管理路由
處理文件上傳、列表、刪除等操作
完整流程：上傳 → 切片 → 向量嵌入 → 保存到 Supabase
"""

import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from services import get_rag_service, get_document_processor
from config import get_supabase

documents_bp = Blueprint('documents', __name__)

# 允許的文件類型
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt'}

# 內存存儲（僅用於無 Supabase 時的備用方案）
documents_store = {}

# 是否使用 Supabase
USE_SUPABASE = os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_KEY')


def allowed_file(filename: str) -> bool:
    """檢查文件類型是否允許"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@documents_bp.route('/upload', methods=['POST'])
def upload_document():
    """
    上傳文件並完成完整處理流程：
    1. 驗證文件類型
    2. 保存到本地
    3. 提取文字並切片
    4. 生成向量嵌入
    5. 保存到 Supabase（如果已配置）
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            'error': f'File type not allowed. Supported types: {", ".join(ALLOWED_EXTENSIONS)}'
        }), 400
    
    try:
        # 生成唯一文件 ID
        doc_id = str(uuid.uuid4())
        
        # 安全處理文件名
        original_filename = secure_filename(file.filename)
        _, ext = os.path.splitext(original_filename)
        stored_filename = f"{doc_id}{ext}"
        
        # 1. 保存文件到本地
        upload_folder = current_app.config['UPLOAD_FOLDER']
        file_path = os.path.join(upload_folder, stored_filename)
        file.save(file_path)
        
        # 2. 提取文字並獲取文件資訊
        processor = get_document_processor()
        doc_info = processor.get_document_info(file_path)
        
        # 3. 切片並生成向量嵌入（RAG 索引）
        rag_service = get_rag_service()
        index_result = rag_service.index_document(doc_id, file_path)
        
        # 4. 準備文件元數據
        doc_metadata = {
            'id': doc_id,
            'original_filename': original_filename,
            'stored_filename': stored_filename,
            'file_path': file_path,
            'file_size': doc_info['file_size'],
            'total_characters': doc_info['total_characters'],
            'total_tokens': doc_info['total_tokens'],
            'total_chunks': index_result['chunks_indexed'],
            'status': 'ready'
        }
        
        # 5. 保存到 Supabase（如果已配置）
        if USE_SUPABASE:
            try:
                supabase = get_supabase()
                
                # 保存文件元數據
                supabase_doc_data = {
                    'id': doc_id,
                    'original_filename': original_filename,
                    'stored_filename': stored_filename,
                    'file_size': doc_info['file_size'],
                    'total_characters': doc_info['total_characters'],
                    'total_tokens': doc_info['total_tokens'],
                    'total_chunks': index_result['chunks_indexed'],
                    'status': 'ready'
                }
                supabase.save_document(supabase_doc_data)
                
                # 保存向量嵌入（從 RAG service 獲取）
                embeddings_data = index_result.get('embeddings_for_db', [])
                if embeddings_data:
                    supabase.save_embeddings(embeddings_data)
                
                doc_metadata['saved_to_supabase'] = True
                
            except Exception as supabase_error:
                # Supabase 失敗不影響主流程
                print(f"Supabase save failed: {supabase_error}")
                doc_metadata['saved_to_supabase'] = False
        else:
            doc_metadata['saved_to_supabase'] = False
        
        # 6. 保存到內存存儲（備用）
        documents_store[doc_id] = doc_metadata
        
        return jsonify({
            'message': 'Document uploaded, chunked, and indexed successfully',
            'document': doc_metadata,
            'processing_details': {
                'chunks_created': index_result['chunks_indexed'],
                'total_tokens': doc_info['total_tokens'],
                'embedding_model': 'text2vec-base-chinese',
                'status': 'ready'
            }
        }), 201
        
    except Exception as e:
        # 清理：如果處理失敗，刪除已上傳的文件
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/', methods=['GET'])
def get_documents():
    """獲取所有文件列表"""
    try:
        if USE_SUPABASE:
            supabase = get_supabase()
            result = supabase.get_documents()
            documents = result.data if result.data else []
        else:
            documents = list(documents_store.values())
        
        return jsonify({'documents': documents})
    except Exception as e:
        # 如果 Supabase 失敗，回退到內存存儲
        documents = list(documents_store.values())
        return jsonify({'documents': documents})


@documents_bp.route('/<doc_id>', methods=['GET'])
def get_document(doc_id: str):
    """獲取單個文件資訊"""
    try:
        if USE_SUPABASE:
            supabase = get_supabase()
            result = supabase.get_document(doc_id)
            if result.data:
                return jsonify({'document': result.data})
        
        # 回退到內存存儲
        if doc_id in documents_store:
            return jsonify({'document': documents_store[doc_id]})
        
        return jsonify({'error': 'Document not found'}), 404
        
    except Exception as e:
        # 如果 Supabase 失敗，嘗試內存存儲
        if doc_id in documents_store:
            return jsonify({'document': documents_store[doc_id]})
        return jsonify({'error': 'Document not found'}), 404


@documents_bp.route('/<doc_id>', methods=['DELETE'])
def delete_document(doc_id: str):
    """刪除文件"""
    if doc_id not in documents_store:
        return jsonify({'error': 'Document not found'}), 404
    
    try:
        doc = documents_store[doc_id]
        
        # 刪除文件
        if os.path.exists(doc['file_path']):
            os.remove(doc['file_path'])
        
        # 從 RAG 索引中移除
        rag_service = get_rag_service()
        rag_service.remove_document(doc_id)
        
        # 從存儲中移除
        del documents_store[doc_id]
        
        return jsonify({'message': 'Document deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@documents_bp.route('/<doc_id>/preview', methods=['GET'])
def preview_document(doc_id: str):
    """預覽文件內容"""
    if doc_id not in documents_store:
        return jsonify({'error': 'Document not found'}), 404
    
    try:
        rag_service = get_rag_service()
        
        if not rag_service.is_document_indexed(doc_id):
            return jsonify({'error': 'Document not indexed'}), 400
        
        # 獲取前 2000 字符作為預覽
        full_text = rag_service.get_full_text(doc_id)
        preview = full_text[:2000] + ('...' if len(full_text) > 2000 else '')
        
        return jsonify({
            'preview': preview,
            'total_length': len(full_text)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
