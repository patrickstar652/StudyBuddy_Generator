"""
RAG（檢索增強生成）服務
處理文件嵌入和語義搜索
"""

import os
import numpy as np
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import faiss

from .document_processor import get_document_processor


class RAGService:
    def __init__(self):
        # 使用中文優化的嵌入模型
        model_name = os.getenv("EMBEDDING_MODEL", "shibing624/text2vec-base-chinese")
        print(f"載入嵌入模型: {model_name}")
        self.embedding_model = SentenceTransformer(model_name)
        self.embedding_dim = self.embedding_model.get_sentence_embedding_dimension()
        print(f"嵌入維度: {self.embedding_dim}")
        self.document_processor = get_document_processor()
        
        # 內存中的向量索引（每個文件一個）
        self.indices: Dict[str, faiss.IndexFlatIP] = {}
        self.chunks_store: Dict[str, List[Dict]] = {}
    
    def create_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        為文字列表創建嵌入向量
        使用中文優化模型 text2vec-base-chinese
        
        Args:
            texts: 文字列表
        
        Returns:
            嵌入向量陣列 (768 維)
        """
        # 使用 batch 處理提高效率
        embeddings = self.embedding_model.encode(
            texts, 
            convert_to_numpy=True,
            normalize_embeddings=True,  # 自動正規化
            show_progress_bar=len(texts) > 10  # 大量文字時顯示進度
        )
        # 確保正規化（用於餘弦相似度）
        faiss.normalize_L2(embeddings)
        return embeddings
    
    def index_document(self, doc_id: str, file_path: str) -> Dict[str, Any]:
        """
        索引一個文件
        
        Args:
            doc_id: 文件 ID
            file_path: 文件路徑
        
        Returns:
            索引結果資訊（包含可保存到 Supabase 的嵌入數據）
        """
        # 提取文字
        text = self.document_processor.extract_text(file_path)
        
        # 分割成區塊
        chunks = self.document_processor.split_into_chunks(text)
        
        if not chunks:
            raise ValueError("No content could be extracted from the document")
        
        # 創建嵌入
        texts = [chunk["content"] for chunk in chunks]
        embeddings = self.create_embeddings(texts)
        
        # 創建 FAISS 索引
        index = faiss.IndexFlatIP(self.embedding_dim)
        index.add(embeddings)
        
        # 存儲索引和區塊
        self.indices[doc_id] = index
        self.chunks_store[doc_id] = chunks
        
        # 準備 Supabase 嵌入數據
        embeddings_for_db = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            embeddings_for_db.append({
                'document_id': doc_id,
                'content': chunk['content'],
                'chunk_index': chunk['chunk_index'],
                'embedding': embedding.tolist()  # 轉換為列表以便 JSON 序列化
            })
        
        return {
            "doc_id": doc_id,
            "chunks_indexed": len(chunks),
            "total_tokens": sum(chunk["token_count"] for chunk in chunks),
            "full_text": text,  # 返回完整文字供後續使用
            "embeddings_for_db": embeddings_for_db  # 供 Supabase 保存
        }
    
    def search(self, doc_id: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        在文件中搜索相關內容
        
        Args:
            doc_id: 文件 ID
            query: 搜索查詢
            top_k: 返回結果數量
        
        Returns:
            相關區塊列表
        """
        if doc_id not in self.indices:
            raise ValueError(f"Document {doc_id} not indexed")
        
        # 創建查詢嵌入
        query_embedding = self.create_embeddings([query])
        
        # 搜索
        index = self.indices[doc_id]
        scores, indices = index.search(query_embedding, min(top_k, index.ntotal))
        
        # 獲取結果
        results = []
        chunks = self.chunks_store[doc_id]
        
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(chunks):
                results.append({
                    "content": chunks[idx]["content"],
                    "chunk_index": chunks[idx]["chunk_index"],
                    "score": float(score)
                })
        
        return results
    
    def get_full_text(self, doc_id: str) -> str:
        """
        獲取文件的完整文字
        
        Args:
            doc_id: 文件 ID
        
        Returns:
            完整文字
        """
        if doc_id not in self.chunks_store:
            raise ValueError(f"Document {doc_id} not indexed")
        
        chunks = self.chunks_store[doc_id]
        # 合併所有區塊（考慮重疊，只取每個區塊的前半部分，最後一個區塊除外）
        full_text = ""
        for i, chunk in enumerate(chunks):
            if i == len(chunks) - 1:
                full_text += chunk["content"]
            else:
                # 只取非重疊部分
                content = chunk["content"]
                # 大約取 80% 避免重複
                cut_point = int(len(content) * 0.8)
                full_text += content[:cut_point]
        
        return full_text
    
    def get_context_for_query(self, doc_id: str, query: str, max_tokens: int = 4000) -> str:
        """
        獲取用於回答問題的上下文
        
        Args:
            doc_id: 文件 ID
            query: 問題
            max_tokens: 最大 token 數量
        
        Returns:
            相關上下文
        """
        results = self.search(doc_id, query, top_k=10)
        
        context_parts = []
        total_tokens = 0
        
        for result in results:
            chunk_tokens = self.document_processor.count_tokens(result["content"])
            if total_tokens + chunk_tokens > max_tokens:
                break
            context_parts.append(result["content"])
            total_tokens += chunk_tokens
        
        return "\n\n---\n\n".join(context_parts)
    
    def is_document_indexed(self, doc_id: str) -> bool:
        """檢查文件是否已索引"""
        return doc_id in self.indices
    
    def remove_document(self, doc_id: str):
        """移除文件索引"""
        if doc_id in self.indices:
            del self.indices[doc_id]
        if doc_id in self.chunks_store:
            del self.chunks_store[doc_id]


# 單例實例
_rag_service: Optional[RAGService] = None

def get_rag_service() -> RAGService:
    """獲取 RAG 服務實例"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
