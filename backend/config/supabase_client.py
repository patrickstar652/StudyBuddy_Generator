"""
Supabase 客戶端配置
處理向量資料庫和文件元數據存儲
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class SupabaseClient:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not SupabaseClient._initialized:
            self._initialize()
            SupabaseClient._initialized = True
    
    def _initialize(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
        
        self.client: Client = create_client(url, key)
    
    def get_client(self) -> Client:
        return self.client
    
    # Document operations
    def save_document(self, doc_data: dict):
        """保存文件元數據到 Supabase"""
        return self.client.table('documents').insert(doc_data).execute()
    
    def get_documents(self, user_id: str = None):
        """獲取所有文件"""
        query = self.client.table('documents').select('*')
        if user_id:
            query = query.eq('user_id', user_id)
        return query.order('created_at', desc=True).execute()
    
    def get_document(self, doc_id: str):
        """獲取單個文件"""
        return self.client.table('documents').select('*').eq('id', doc_id).single().execute()
    
    def delete_document(self, doc_id: str):
        """刪除文件"""
        return self.client.table('documents').delete().eq('id', doc_id).execute()
    
    # Vector embeddings operations
    def save_embeddings(self, embeddings_data: list):
        """保存向量嵌入"""
        return self.client.table('document_embeddings').insert(embeddings_data).execute()
    
    def search_similar(self, query_embedding: list, doc_id: str, limit: int = 5):
        """
        使用向量相似度搜索
        
        Args:
            query_embedding: 查詢向量 (768 維，來自 text2vec-base-chinese)
            doc_id: 文件 ID
            limit: 返回結果數量
        """
        # 使用 Supabase 的 RPC 函數進行向量搜索
        return self.client.rpc(
            'match_documents',
            {
                'query_embedding': query_embedding,
                'match_count': limit,
                'filter_doc_id': doc_id
            }
        ).execute()
    
    def get_document_chunks(self, doc_id: str):
        """獲取文件的所有文字區塊"""
        return self.client.table('document_embeddings').select('content, chunk_index').eq('document_id', doc_id).order('chunk_index').execute()
    
    # Quiz and flashcard operations
    def save_quiz(self, quiz_data: dict):
        """保存測驗"""
        return self.client.table('quizzes').insert(quiz_data).execute()
    
    def get_quizzes(self, doc_id: str):
        """獲取文件的所有測驗（按時間倒序）"""
        return self.client.table('quizzes').select('*').eq('document_id', doc_id).order('created_at', desc=True).execute()
    
    def save_flashcards(self, flashcard_data: dict):
        """保存閃卡"""
        return self.client.table('flashcards').insert(flashcard_data).execute()
    
    def get_flashcards(self, doc_id: str):
        """獲取文件的所有閃卡（按時間倒序）"""
        return self.client.table('flashcards').select('*').eq('document_id', doc_id).order('created_at', desc=True).execute()


def get_supabase() -> SupabaseClient:
    """獲取 Supabase 客戶端實例"""
    return SupabaseClient()
