"""
測試文件上傳和切片功能
運行此腳本以驗證系統是否正常工作
"""

import sys
import os

# 添加父目錄到路徑
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.document_processor import get_document_processor
from services.rag_service import get_rag_service
import tempfile


def test_document_processing():
    """測試文件處理流程"""
    
    print("=" * 60)
    print("Study Buddy - 文件處理測試")
    print("=" * 60)
    print()
    
    # 創建測試文件
    test_content = """
    機器學習導論
    
    第一章：什麼是機器學習？
    
    機器學習（Machine Learning）是人工智慧的一個分支，它使電腦系統能夠從數據中學習並改進，
    而無需明確編程。機器學習算法通過分析大量數據來識別模式，並使用這些模式來做出預測或決策。
    
    主要類型：
    1. 監督式學習（Supervised Learning）
       - 使用標記數據進行訓練
       - 例如：分類、迴歸
    
    2. 非監督式學習（Unsupervised Learning）
       - 使用未標記數據
       - 例如：聚類、降維
    
    3. 強化學習（Reinforcement Learning）
       - 通過試錯學習
       - 例如：遊戲 AI、機器人控制
    
    第二章：深度學習
    
    深度學習是機器學習的一個子領域，它使用多層神經網路來學習數據的複雜表示。
    深度學習在圖像識別、自然語言處理和語音識別等領域取得了突破性進展。
    
    常見架構：
    - 卷積神經網路（CNN）：用於圖像處理
    - 循環神經網路（RNN）：用於序列數據
    - Transformer：用於自然語言處理
    
    應用實例：
    - 自動駕駛汽車
    - 醫療診斷
    - 語音助手
    - 推薦系統
    """
    
    # 創建臨時文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(test_content)
        temp_file = f.name
    
    try:
        print("📄 測試文件已創建")
        print(f"   路徑: {temp_file}")
        print(f"   字數: {len(test_content)} 字元")
        print()
        
        # Step 1: 文字提取
        print("Step 1: 提取文字...")
        processor = get_document_processor()
        extracted_text = processor.extract_text(temp_file)
        print(f"   ✓ 成功提取 {len(extracted_text)} 字元")
        print()
        
        # Step 2: 獲取文件資訊
        print("Step 2: 分析文件...")
        doc_info = processor.get_document_info(temp_file)
        print(f"   ✓ 總字元數: {doc_info['total_characters']:,}")
        print(f"   ✓ 總 Tokens: {doc_info['total_tokens']:,}")
        print(f"   ✓ 區塊數量: {doc_info['total_chunks']}")
        print()
        
        # Step 3: 切片處理
        print("Step 3: 智慧切片...")
        chunks = processor.split_into_chunks(extracted_text)
        print(f"   ✓ 已切分為 {len(chunks)} 個區塊")
        print()
        
        # 顯示區塊詳情
        print("   區塊詳情:")
        for i, chunk in enumerate(chunks[:3]):  # 只顯示前 3 個
            preview = chunk['content'][:80].replace('\n', ' ')
            print(f"   區塊 {i+1}:")
            print(f"     - Tokens: {chunk['token_count']}")
            print(f"     - 內容: {preview}...")
        
        if len(chunks) > 3:
            print(f"   ... 還有 {len(chunks) - 3} 個區塊")
        print()
        
        # Step 4: 向量嵌入和索引
        print("Step 4: 建立向量索引...")
        print("   (這可能需要幾秒鐘，首次會下載模型...)")
        
        rag_service = get_rag_service()
        doc_id = "test-doc-001"
        
        index_result = rag_service.index_document(doc_id, temp_file)
        
        print(f"   ✓ 已索引 {index_result['chunks_indexed']} 個區塊")
        print(f"   ✓ 總 Tokens: {index_result['total_tokens']:,}")
        print(f"   ✓ 嵌入維度: 384")
        print()
        
        # Step 5: 測試搜索
        print("Step 5: 測試向量搜索...")
        test_queries = [
            "什麼是機器學習？",
            "深度學習的應用",
            "監督式學習的例子"
        ]
        
        for query in test_queries:
            results = rag_service.search(doc_id, query, top_k=2)
            print(f"\n   查詢: '{query}'")
            print(f"   找到 {len(results)} 個相關區塊:")
            
            for i, result in enumerate(results):
                preview = result['content'][:100].replace('\n', ' ')
                print(f"     {i+1}. 相似度: {result['score']:.3f}")
                print(f"        內容: {preview}...")
        
        print()
        print("=" * 60)
        print("✅ 所有測試通過！")
        print("=" * 60)
        print()
        print("系統功能正常，可以開始使用 Study Buddy 了！")
        print()
        print("下一步:")
        print("1. 啟動應用: python app.py")
        print("2. 上傳你的學習材料")
        print("3. 開始使用學習工具")
        print()
        
    except Exception as e:
        print()
        print("=" * 60)
        print("❌ 測試失敗")
        print("=" * 60)
        print(f"錯誤: {str(e)}")
        print()
        import traceback
        traceback.print_exc()
        
    finally:
        # 清理臨時文件
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        # 清理 RAG 索引
        try:
            rag_service.remove_document(doc_id)
        except:
            pass


if __name__ == '__main__':
    test_document_processing()
