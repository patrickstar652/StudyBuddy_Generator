# Study Buddy - 文件上傳與處理流程說明

## 📤 完整的文件上傳流程

當使用者上傳文件後，系統會自動執行以下步驟：

### 1️⃣ 文件驗證與保存
```
使用者上傳文件
    ↓
驗證文件類型 (PDF, DOCX, TXT)
    ↓
生成唯一 ID
    ↓
安全儲存到 uploads/ 資料夾
```

### 2️⃣ 文字提取
```python
# 使用 DocumentProcessor 提取文字
- PDF: 使用 PyPDF2
- DOCX: 使用 python-docx
- TXT: 直接讀取

結果: 純文字內容
```

### 3️⃣ 智慧切片 (Chunking)
```python
# 使用 tiktoken 進行智慧切片
chunk_size = 1000 tokens        # 每個區塊大小
chunk_overlap = 200 tokens      # 重疊部分避免資訊斷裂

結果: 多個文字區塊 (chunks)
```

**切片範例：**
```
原始文件 (5000 tokens)
    ↓
區塊 1: tokens 0-1000
區塊 2: tokens 800-1800    ← 與區塊 1 重疊 200 tokens
區塊 3: tokens 1600-2600   ← 與區塊 2 重疊 200 tokens
...
```

### 4️⃣ 向量嵌入 (Vector Embeddings)
```python
# 使用 Sentence Transformers 生成向量
model: all-MiniLM-L6-v2
dimension: 384

每個區塊 → 384 維向量
```

**範例：**
```
文字區塊: "機器學習是人工智慧的分支..."
    ↓
向量: [0.123, -0.456, 0.789, ..., 0.234]  # 384 個數字
```

### 5️⃣ 建立向量索引
```python
# 使用 FAISS 建立高效搜索索引
IndexFlatIP (內積相似度)
    ↓
快速語義搜索能力
```

### 6️⃣ 保存到資料庫
```
Supabase (如果已配置):
├── documents 表: 文件元數據
│   ├── id, filename, file_size
│   ├── total_tokens, total_chunks
│   └── status: 'ready'
│
└── document_embeddings 表: 向量數據
    ├── document_id
    ├── chunk_index
    ├── content (文字內容)
    └── embedding (384維向量)

內存備份:
└── documents_store (字典)
```

## 🔍 核心功能如何使用這些切片

### 🎯 生成隨堂考
```
1. RAG Service 讀取所有文字區塊
2. 合併成完整文件內容
3. 發送給 Groq LLM
4. AI 分析內容生成題目
```

### 📚 生成閃卡
```
1. RAG Service 提取關鍵區塊
2. Groq LLM 識別術語和定義
3. 生成正面/背面配對
```

### 📝 TL;DR 摘要
```
1. RAG Service 提供完整內容
2. Groq LLM 分析重要性
3. 提取核心要點和關鍵詞
```

### 💬 智慧問答 (RAG)
```
使用者問題
    ↓
將問題轉換為向量
    ↓
在 FAISS 索引中搜索相似區塊
    ↓
提取 Top-K 最相關區塊
    ↓
作為上下文發送給 LLM
    ↓
生成基於文件的回答
```

## 📊 處理範例

**輸入文件:** `機器學習導論.pdf` (50 頁)

**處理結果:**
```json
{
  "total_characters": 125000,
  "total_tokens": 25000,
  "total_chunks": 28,
  "chunk_size": 1000,
  "overlap": 200,
  "embedding_dimension": 384,
  "index_type": "FAISS IndexFlatIP",
  "status": "ready"
}
```

**切片分布:**
```
第 1 頁  → 區塊 1-2
第 2-5 頁 → 區塊 3-10
第 6-10 頁 → 區塊 11-20
...
第 50 頁 → 區塊 27-28
```

## 🚀 前端上傳操作

### 使用拖放上傳
```jsx
<FileUpload onFileSelect={handleFileSelect} />
    ↓
選擇文件
    ↓
點擊「開始處理」
    ↓
顯示進度條
    ↓
完成！導航到文件頁面
```

### API 請求流程
```javascript
// 1. 準備表單數據
const formData = new FormData();
formData.append('file', selectedFile);

// 2. 發送請求
POST /api/documents/upload
Content-Type: multipart/form-data

// 3. 接收回應
{
  "message": "Document uploaded, chunked, and indexed successfully",
  "document": {
    "id": "uuid",
    "original_filename": "機器學習.pdf",
    "total_chunks": 28,
    "status": "ready"
  },
  "processing_details": {
    "chunks_created": 28,
    "total_tokens": 25000,
    "embedding_model": "all-MiniLM-L6-v2"
  }
}
```

## 🔧 技術細節

### 為什麼要切片？
1. **LLM Token 限制**: 大多數 LLM 有輸入長度限制
2. **提高搜索精度**: 小區塊更精確匹配問題
3. **降低成本**: 只發送相關部分給 LLM
4. **提升速度**: 向量搜索更快

### 為什麼要重疊？
```
無重疊:
[區塊1: "...機器學習是"] [區塊2: "一種人工智慧..."]
                ↑ 斷句！

有重疊:
[區塊1: "...機器學習是一種"] [區塊2: "機器學習是一種人工智慧..."]
              ↑ 完整語境保留
```

## 📈 性能優化

- **FAISS 索引**: 毫秒級向量搜索
- **內存緩存**: 避免重複讀取文件
- **非同步處理**: 上傳與處理並行
- **錯誤恢復**: 失敗自動清理

## 🎓 使用建議

1. **小型文件** (< 10 頁): 快速處理，立即可用
2. **中型文件** (10-50 頁): 最佳體驗
3. **大型文件** (50+ 頁): 建議分章節上傳

---

**現在就開始使用吧！** 🚀
```bash
# Windows PowerShell
.\start.ps1
```
