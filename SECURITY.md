# Security Policy

## Reporting a vulnerability

請勿在公開 issue 中張貼 API key、database URL、token、使用者文件或可重現的敏感資料。若 repository 已啟用 GitHub Security Advisories，請使用私人回報；否則請透過 maintainer 的私人管道聯絡，並只提供重現問題所需的最少資訊。

## Secret handling

- 真實憑證只能放在未追蹤的 `backend/.env` 或部署平台的 secret manager。
- `backend/.env.example` 只能包含明確的 placeholder。
- 不要在 log、錯誤 response、截圖、測試 fixture 或 CI artifact 中輸出完整 connection string 或 API key。
- Neon 應用程式流量使用 pooled connection；direct connection 只供 migration 與管理工作。
- 對外部署前必須補上 authentication、每位使用者的資料隔離與 rate limiting。

## 憑證曾提交到 Git 時

從目前 branch 刪除檔案不會清除 Git 歷史。處理順序必須是：

1. 立即在供應商後台撤銷並輪替受影響憑證，包括 Groq、舊 Supabase 專案與任何可能暴露的 Neon role password。
2. 更新本機與部署環境使用的新憑證；不要把新值放入 commit、聊天記錄或 issue。
3. 檢查 Groq、Supabase、Neon 與部署平台的存取紀錄，確認是否有異常活動。
4. 暫停其他人 push，建立 repository 備份，並在乾淨的 mirror clone 中清理歷史。
5. 驗證敏感路徑已無法從任何 branch 或 tag 取回，再協調 force-push 與所有協作者重新 clone。

憑證輪替永遠優先於歷史清理，因為 fork、cache、舊 clone 或 artifact 可能仍保留原始內容。

### 本 repository 的已知歷史事件

2026-08 的整理過程確認 `backend/.env` 曾存在於可到達的 Git 歷史（包含 commit `e16409d`），其中有舊 Groq 與 Supabase 憑證。請把這些舊值一律視為已洩漏並在供應商後台撤銷；不要嘗試重新使用。這次新建立的 Neon connection string 只寫入被 `.gitignore` 排除的本機 `backend/.env`，未加入目前 working tree 的追蹤內容。

## Git 歷史清理範例

先安裝 [`git-filter-repo`](https://github.com/newren/git-filter-repo)，再於專門建立的乾淨 mirror clone 中執行。以下命令只列出已知不應進入歷史的路徑，不包含任何憑證值：

```bash
git filter-repo \
  --path backend/.env \
  --path frontend/node_modules \
  --path backend/uploads \
  --path-glob '**/__pycache__/**' \
  --path-glob '*.pyc' \
  --invert-paths
```

清理後先做本機驗證：

```bash
git log --all -- backend/.env frontend/node_modules backend/uploads
git rev-list --objects --all
```

接著由 repository owner 依協作狀況決定是否使用 `--force-with-lease` 更新所有 branches 與 tags。歷史重寫會改變 commit SHA；不要在未通知協作者、未備份或仍有進行中工作時執行。

## 預防再次發生

- 啟用 GitHub secret scanning 與 push protection。
- 在 pre-commit 或 CI 加入 Gitleaks、TruffleHog 等 secret scanner。
- CI 同時掃描目前 working tree 與完整 Git history。
- 測試只能使用無權限或短效的專用測試憑證。
- 定期輪替 API key 與 database role password，並遵守最小權限原則。
