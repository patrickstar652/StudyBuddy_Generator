# Study Buddy - AI 學習夥伴 🎓

一個強大的 AI 學習助手，幫助學生主動學習！上傳你的學習材料，**自動切片並建立向量索引**，然後生成測驗、閃卡和摘要。

## ✨ 功能特色

### 📤 智慧文件處理
- **自動切片**: 上傳後自動將文件切分成最佳大小的區塊 (1000 tokens/區塊)
- **向量嵌入**: 使用 Sentence Transformers 生成 384 維向量
- **語義搜索**: FAISS 向量索引實現毫秒級搜索
- **支援格式**: PDF、DOCX、TXT

### 🎯 生成隨堂考
- AI 自動根據文件內容生成 5-10 道測驗題目
- 支援選擇題和簡答題
- 詳細的答案解釋和評分

### 📚 生成閃卡
- 自動提取關鍵術語和定義
- 漂亮的翻轉動畫效果
- 支援鍵盤快捷鍵操作
- 可打亂順序複習

### 📝 畫重點 TL;DR
- 為長篇文件生成核心摘要
- 按重要性標記要點
- 提取關鍵詞標籤

### 💬 智慧問答 (RAG)
- 基於文件內容回答問題
- 使用向量搜索找到最相關的內容
- 顯示答案來源引用

## 🛠️ 技術架構

- **前端**: React + Vite + TailwindCSS
- **後端**: Flask + Python
- **AI/LLM**: Groq (Llama 3.1 70B)
- **向量搜索**: FAISS + Sentence Transformers (all-MiniLM-L6-v2)
- **文件處理**: PyPDF2, python-docx, tiktoken
- **資料庫**: Supabase (PostgreSQL + pgvector)

## 📤 文件上傳與切片流程

系統會自動執行完整的處理流程：

```
1. 上傳文件 (PDF/DOCX/TXT)
      ↓
2. 提取純文字內容
      ↓
3. 智慧切片 (1000 tokens/區塊，200 tokens 重疊)
      ↓
4. 生成向量嵌入 (384 維)
      ↓
5. 建立 FAISS 搜索索引
      ↓
6. 保存到 Supabase (可選)
      ↓
7. 準備就緒！可使用所有學習工具
```

**為什麼要切片？**
- ✅ 克服 LLM token 限制
- ✅ 提高語義搜索精度
- ✅ 降低 API 成本
- ✅ 加快處理速度

詳細說明請參考 [UPLOAD_FLOW.md](UPLOAD_FLOW.md)

## 📦 安裝步驟

### 方法 1: 自動安裝（推薦）⚡

使用我們提供的啟動腳本，一鍵完成所有設定：

```powershell
# 在專案根目錄執行
.\start.ps1
```

這個腳本會自動：
- ✅ 檢查 Python 和 Node.js
- ✅ 建立虛擬環境
- ✅ 安裝所有依賴
- ✅ 設定 API Key
- ✅ 啟動前後端服務
- ✅ 打開瀏覽器

### 方法 2: 手動安裝

#### 1. 克隆專案

```bash
git clone <your-repo-url>
cd study_buddy
```

### 2. 設定後端

```bash
cd backend

# 建立虛擬環境
python -m venv venv

# 啟動虛擬環境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安裝依賴
pip install -r requirements.txt
```

### 3. 設定環境變數

複製 `.env.example` 到 `.env` 並填入你的 API 金鑰：

```bash
cp .env.example .env
```

編輯 `.env` 文件：

```env
# Gr快速啟動（推薦）

使用自動化腳本一鍵啟動：

```powershell
# Windows PowerShell
.\start.ps1
```

腳本會自動：
- ✅ 檢查環境依賴
- ✅ 創建虛擬環境
- ✅ 安裝所有套件
- ✅ 配置 API Key
- ✅ 同時啟動前後端
- ✅ 自動打開瀏覽器

### 手動啟動

#### oq API Configuration
GROQ_API_KEY=your_groq_api_key_here

# Supabase Configuration (可選)
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# Model Configuration
GROQ_MODEL=llama-3.1-70b-versatile
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

### 4. 設定前端

```bash
cd frontend

# 安裝依賴
npm install
```

### 5. 設定 Supabase (可選)

1. 前往 [Supabase](https://supabase.com) 創建專案
2. 在 SQL Editor 中執行 `supabase/schema.sql`
3. 複製 Project URL 和 anon key 到 `.env`

> **注意**: 不配置 Supabase 也能使用！系統會使用內存存儲作為備用方案。

### 6. 測試系統 🧪

在啟動應用前，先測試文件處理功能：

```bash
cd backend
python test_upload.py
```

這會測試：
- ✅ 文字提取
- ✅ 智慧切片
- ✅ 向量嵌入
- ✅ 搜索功能

看到 "✅ 所有測試通過！" 表示系統正常。

## 🚀 啟動應用

### 啟動後端

```bash
cd backend
python app.py
```

後端將在 http://localhost:5000 運行

### 啟動前端

```bash
cd frontend
npm run dev
```

前端將在 http://localhost:3000 運行

## 📁 專案結構

```
study_buddy/
├── backend/
│   ├── app.py                 # Flask 應用入口
│   ├── requirements.txt       # Python 依賴
│   ├── .env.example          # 環境變數範例
│   ├── config/
│   │   └── supabase_client.py # Supabase 配置
│   ├── services/
│   │   ├── groq_service.py    # LLM 服務
│   │   ├── document_processor.py # 文件處理
│   │   └── rag_service.py     # RAG 向量搜索
│   └── routes/
│       ├── documents.py       # 文件 API
│       └── study_tools.py     # 學習工具 API
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── services/
│       │   └── api.js         # API 客戶端
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── FileUpload.jsx
│       │   ├── DocumentCard.jsx
│       │   └── LoadingSpinner.jsx
│       └── pages/
│           ├── HomePage.jsx
│           ├── DocumentPage.jsx
│           ├── QuizPage.jsx
│           ├── FlashcardsPage.jsx
│           └── SummaryPage.jsx
└── supabase/
    └── schema.sql             # 資料庫架構
```

## 🔑 獲取 API 金鑰
### 1. 上傳文件 📤
- 在首頁拖放或選擇學習材料 (PDF、DOCX、TXT)
- 系統自動處理：
  - ✅ 提取文字 (支援 PDF、Word、純文字)
  - ✅ 切片處理 (1000 tokens/區塊)
  - ✅ 向量嵌入 (384 維語義向量)
  - ✅ 建立搜索索引 (FAISS)
  - ✅ 保存到資料庫 (可選)
- 處理完成後自動跳轉到文件頁面

### 2. 選擇學習工具 🎯
   - **生成隨堂考**: 測試理解程度，獲得即時反饋
   - **生成閃卡**: 快速複習關鍵概念，支援翻卡動畫
   - **畫重點**: 獲取文件核心摘要，節省閱讀時間
   - **智慧問答**: 向文件提問，基於 RAG 技術回答

### 3. 互動學習 💡
- 所有功能都基於上傳時建立的向量索引
- 回答來源可追溯到具體文件段落
- 支援多文件管理和切換

### 📊 處理範例

**上傳:** 機器學習導論.pdf (50 頁)

**自動處理結果:**
```json
{
  "total_characters": 125000,
  "total_tokens": 25000,
  "total_chunks": 28,
  "status": "ready",
  "processing_details": {
    "chunks_created": 28,
    "embedding_model": "all-MiniLM-L6-v2",
    "embedding_dimension": 384
  }
}
```

**可用功能:**
- ✅ 生成 5-10 題測驗
- ✅ 生成 10-20 張閃卡
- ✅ 生成 5-10 點摘要
- ✅ 無限次問
### Supabase (可選)
1. 前往 [Supabase](https://supabase.com)
2. 創建新專案
3. 在 Settings > API 中獲取 URL 和 anon key

## 📄 支援的文件格式

- PDF (.pdf)
- Word 文件 (.docx, .doc)
- 純文字 (.txt)

## 🎮 使用方式

1. **上傳文件**: 在首頁拖放或選擇學習材料
2. **選擇工具**: 
   - 點擊「生成隨堂考」測試理解程度
   - 點擊「生成閃卡」快速複習關鍵概念
   - 點擊「畫重點」獲取文件摘要
3. **互動學習**: 向文件提問，獲得 AI 回答

## 📝 API 端點

### 文件管理
- `POST /api/documents/upload` - 上傳文件
- `GET /api/documents/` - 獲取所有文件
- `GET /api/documents/:id` - 獲取單個文件
- `DELETE /api/documents/:id` - 刪除文件
- `GET /api/documents/:id/preview` - 預覽文件內容

### 學習工具
- `POST /api/study/quiz/:docId` - 生成測驗
- `POST /api/study/flashcards/:docId` - 生成閃卡
- `POST /api/study/summary/:docId` - 生成摘要
- `POST /api/study/ask/:docId` - 問答
- `POST /api/study/search/:docId` - 搜索文件內容

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📜 授權

MIT License
