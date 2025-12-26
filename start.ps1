# Study Buddy - 快速啟動指南

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Study Buddy AI 學習夥伴" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 Python 是否安裝
Write-Host "1. 檢查 Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "   ✓ Python 已安裝: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Python 未安裝，請先安裝 Python 3.8+" -ForegroundColor Red
    exit 1
}

# 檢查 Node.js 是否安裝
Write-Host "2. 檢查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "   ✓ Node.js 已安裝: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Node.js 未安裝，請先安裝 Node.js" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  後端設定" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 進入後端目錄
Set-Location -Path "$PSScriptRoot\backend"

# 檢查虛擬環境
if (-not (Test-Path "venv")) {
    Write-Host "3. 創建 Python 虛擬環境..." -ForegroundColor Yellow
    python -m venv venv
    Write-Host "   ✓ 虛擬環境已創建" -ForegroundColor Green
}

# 啟動虛擬環境
Write-Host "4. 啟動虛擬環境..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"
Write-Host "   ✓ 虛擬環境已啟動" -ForegroundColor Green

# 安裝依賴
Write-Host "5. 安裝 Python 依賴..." -ForegroundColor Yellow
pip install -q -r requirements.txt
Write-Host "   ✓ Python 依賴已安裝" -ForegroundColor Green

# 檢查 .env 文件
if (-not (Test-Path ".env")) {
    Write-Host "6. 配置環境變數..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "   ⚠ 請編輯 backend\.env 文件，填入你的 GROQ_API_KEY" -ForegroundColor Red
    Write-Host "   ⚠ 前往 https://console.groq.com 獲取免費 API Key" -ForegroundColor Red
    Write-Host ""
    
    # 詢問是否已有 API Key
    $response = Read-Host "是否已經有 Groq API Key？(y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        $apiKey = Read-Host "請輸入 Groq API Key"
        (Get-Content ".env") -replace 'your_groq_api_key_here', $apiKey | Set-Content ".env"
        Write-Host "   ✓ API Key 已設定" -ForegroundColor Green
    } else {
        Write-Host "   請先取得 API Key 後再繼續" -ForegroundColor Yellow
        Start-Process "https://console.groq.com"
        exit 0
    }
} else {
    Write-Host "6. 環境變數已配置 ✓" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  前端設定" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 進入前端目錄
Set-Location -Path "$PSScriptRoot\frontend"

# 檢查 node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "7. 安裝前端依賴..." -ForegroundColor Yellow
    npm install
    Write-Host "   ✓ 前端依賴已安裝" -ForegroundColor Green
} else {
    Write-Host "7. 前端依賴已安裝 ✓" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  啟動應用" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "準備啟動 Study Buddy..." -ForegroundColor Yellow
Write-Host ""
Write-Host "後端將在: http://localhost:5000" -ForegroundColor Cyan
Write-Host "前端將在: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 可以停止服務器" -ForegroundColor Gray
Write-Host ""

# 啟動後端
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; .\venv\Scripts\Activate.ps1; Write-Host '後端服務器啟動中...' -ForegroundColor Green; python app.py"

# 等待 2 秒讓後端啟動
Start-Sleep -Seconds 2

# 啟動前端
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '前端服務器啟動中...' -ForegroundColor Green; npm run dev"

# 等待 3 秒後打開瀏覽器
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Study Buddy 已啟動！" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "✓ 後端 API: http://localhost:5000" -ForegroundColor Green
Write-Host "✓ 前端應用: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "提示：" -ForegroundColor Yellow
Write-Host "1. 上傳 PDF、DOCX 或 TXT 文件" -ForegroundColor White
Write-Host "2. 系統會自動切片並建立向量索引" -ForegroundColor White
Write-Host "3. 使用學習工具生成測驗、閃卡和摘要" -ForegroundColor White
Write-Host ""
