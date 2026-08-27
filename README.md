# Study Buddy Generator

Study Buddy 是一個以 React、Flask、Groq 與 Neon Postgres 組成的 AI 學習工具。上傳 PDF、DOCX 或 TXT 後，系統會擷取文字、切分內容、建立向量嵌入，並提供文件預覽、語意搜尋、問答、測驗、閃卡與摘要。

## 技術架構

- 前端：React 18、Vite、Tailwind CSS
- 後端：Flask、Python
- AI：Groq Chat Completions
- 嵌入：Sentence Transformers
- 向量快取：FAISS
- 持久化：Neon Postgres + pgvector
- 文件解析：pypdf、python-docx、tiktoken

## 先備需求

- Git
- Python 3.11 或 3.12
- Node.js 20 以上與 npm
- 一個 [Neon](https://neon.com/) 專案
- 一組 [Groq API key](https://console.groq.com/keys)
- `psql`，或可使用 Neon Console 的 SQL Editor

## 快速開始

### 1. Clone repository

```bash
git clone https://github.com/patrickstar652/StudyBuddy_Generator.git
cd StudyBuddy_Generator
```

### 2. 建立 Neon schema

在 Neon Console 的 **Connect** 視窗取得兩種連線字串：

- Pooled connection：主機名稱包含 `-pooler`，供 Flask 執行期間使用。
- Direct connection：主機名稱不含 `-pooler`，供 schema migration 使用。

應用程式的 `DATABASE_URL` 應使用 pooled connection。`database/schema.sql` 包含 pgvector extension 與所需資料表；migration 建議使用 direct connection，因為它涉及 session-dependent 的 schema 操作。

PowerShell：

```powershell
$env:DIRECT_DATABASE_URL = "postgresql://YOUR_ROLE:YOUR_PASSWORD@YOUR_DIRECT_ENDPOINT/YOUR_DATABASE?sslmode=require"
psql $env:DIRECT_DATABASE_URL -v ON_ERROR_STOP=1 -f database/schema.sql
```

macOS / Linux：

```bash
export DIRECT_DATABASE_URL='postgresql://YOUR_ROLE:YOUR_PASSWORD@YOUR_DIRECT_ENDPOINT/YOUR_DATABASE?sslmode=require'
psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
```

也可以把 [database/schema.sql](database/schema.sql) 的內容貼到 Neon SQL Editor 執行。完成後應至少存在 `documents`、`document_embeddings`、`quizzes`、`flashcards`、`summaries` 五個資料表。

### 3. 設定並安裝後端

PowerShell：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

macOS / Linux：

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
```

編輯 `backend/.env`，至少填入：

```dotenv
DATABASE_URL=postgresql://YOUR_ROLE:YOUR_PASSWORD@YOUR_ENDPOINT-pooler.YOUR_REGION.aws.neon.tech/YOUR_DATABASE?sslmode=require
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
EMBEDDING_MODEL=shibing624/text2vec-base-chinese
```

不要提交 `.env`。完整範例與註解請參考 [backend/.env.example](backend/.env.example)。

### 4. 安裝前端

在 repository 根目錄開另一個終端機：

```bash
cd frontend
npm ci
```

### 5. 啟動應用程式

後端：

```bash
cd backend
python app.py
```

Flask API 會在 `http://localhost:5001` 啟動。

前端：

```bash
cd frontend
npm run dev
```

Vite 會在 `http://localhost:3000` 啟動，並將 `/api` proxy 到 Flask 的 `5001` port。

確認後端可連線：

```bash
curl http://localhost:5001/api/health
```

第一次處理文件時，Sentence Transformers 可能需要下載嵌入模型，因此會比後續請求久。

## 環境變數

| 變數 | 必要 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 建議 | Flask 使用的 Neon pooled connection。設定後會持久化文件資料、文字區塊、向量與生成歷史。 |
| `DIRECT_DATABASE_URL` | 僅 migration | Neon direct connection。應只用於 `psql` 或 migration，不是 Flask 執行所需。 |
| `GROQ_API_KEY` | 是 | Groq API 認證。 |
| `GROQ_MODEL` | 是 | 預設為 `openai/gpt-oss-120b`；若更換，請先確認該 model 仍在 Groq supported models 清單中。 |
| `EMBEDDING_MODEL` | 是 | Sentence Transformers model，預設為 `shibing624/text2vec-base-chinese`。 |

若變更 `EMBEDDING_MODEL`，既有文件應重新建立嵌入，避免用不同模型查詢舊向量。

## 資料持久化行為

設定 `DATABASE_URL` 後，系統會把下列資料存入 Neon：

- 文件 metadata 與擷取後的完整文字
- 文件切片與向量嵌入
- 測驗、閃卡與摘要歷史

FAISS 是程序內的查詢快取；後端重啟後會由 Neon 保存的切片與向量重新載入，而不是把 FAISS index 當成唯一資料來源。

原始上傳檔案仍存放在 `backend/uploads/`，不會存進 Neon。部署在 ephemeral filesystem 時，原始檔可能在重啟或重新部署後消失，但已成功寫入 Neon 的擷取文字、向量與生成歷史仍可保留。若未設定 `DATABASE_URL`，只能視為暫時性的本機模式，程序重啟後資料可能遺失。

## 支援格式與限制

- PDF (`.pdf`)
- Word Open XML (`.docx`)
- 純文字 (`.txt`)
- 單檔上限 50 MB

舊版 Word `.doc` 不屬於目前可靠支援範圍，請先轉為 `.docx`。

## 驗證與測試

後端：

```bash
cd backend
python -m pytest -q
```

前端：

```bash
cd frontend
npm ci
npm test
npm run lint
npm run build
npm audit
```

建議的完整 smoke test：

1. 上傳一份不含敏感資訊的小型 TXT。
2. 確認預覽、搜尋與問答可用。
3. 生成測驗、閃卡及摘要，確認歷史記錄可重新載入。
4. 重新啟動 Flask，再次確認文件與所有功能仍可使用。
5. 刪除文件，確認 Neon 中的切片與生成歷史一併被 cascade delete。

## API

### 文件

- `POST /api/documents/upload`
- `GET /api/documents/`
- `GET /api/documents/:id`
- `GET /api/documents/:id/preview`
- `DELETE /api/documents/:id`

### 學習工具

- `POST /api/study/search/:docId`
- `POST /api/study/ask/:docId`
- `POST /api/study/quiz/:docId`
- `GET /api/study/quizzes/:docId`
- `POST /api/study/flashcards/:docId`
- `GET /api/study/flashcards/:docId`
- `POST /api/study/summary/:docId`
- `GET /api/study/summaries/:docId`

## 安全注意事項

- 目前應用程式沒有完整的使用者登入、租戶隔離與公開網路用 rate limiting，請勿直接公開部署。
- 文件內容會送往 Groq 產生答案與學習材料；上傳前請確認你有權處理該內容。
- 不要把 Neon connection string、Groq API key、`.env` 或使用者上傳檔案提交到 Git。
- 若憑證曾進入 Git 歷史，僅刪除目前檔案並不足夠；必須先撤銷並輪替憑證，再清理歷史。

憑證事故處理與 Git 歷史清理流程請見 [SECURITY.md](SECURITY.md)。

## 專案結構

```text
StudyBuddy_Generator/
├── backend/
│   ├── app.py
│   ├── .env.example
│   ├── requirements.txt
│   ├── config/
│   │   └── database.py
│   ├── routes/
│   ├── services/
│   └── tests/
├── database/
│   └── schema.sql
├── frontend/
│   ├── package.json
│   └── src/
├── README.md
└── SECURITY.md
```

## 疑難排解

- `DATABASE_URL` 連線失敗：確認使用 pooled endpoint、帳密未過期，且 URL 包含 `sslmode=require`。
- Migration 失敗：改用不含 `-pooler` 的 direct connection，並加上 `psql -v ON_ERROR_STOP=1` 取得第一個錯誤。
- 找不到資料表：重新執行 `database/schema.sql`，並確認連到正確的 Neon project、branch 與 database。
- Groq 回報 model 不存在：查看 [Groq supported models](https://console.groq.com/docs/models)，更新 `GROQ_MODEL` 後重新啟動 Flask。
- 第一次上傳很慢：通常是本機正在下載並初始化嵌入模型。
