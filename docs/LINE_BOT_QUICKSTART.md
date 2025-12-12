# LINE BOT 快速開始指南

## ⚡ 5 分鐘快速部署

### 步驟 1: 安裝依賴 (1 分鐘)

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install openai requests
```

### 步驟 2: 配置環境變數 (2 分鐘)

編輯 `backend/.env` 檔案，添加：

```env
# LINE Messaging API（從 LINE Developers Console 取得）
LINE_CHANNEL_ACCESS_TOKEN=請填入你的_token
LINE_CHANNEL_SECRET=請填入你的_secret

# OpenAI API（從 OpenAI Platform 取得）
OPENAI_API_KEY=請填入你的_api_key
OPENAI_MODEL=gpt-4o-mini
```

### 步驟 3: 資料庫遷移 (1 分鐘)

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py makemigrations line_bot
.\.venv\Scripts\python.exe manage.py migrate
```

### 步驟 4: 啟動服務 (1 分鐘)

**終端機 1 - 後端**：
```powershell
cd backend
.\.venv\Scripts\python.exe manage.py runserver
```

**終端機 2 - 前端**：
```powershell
cd frontend
npm start
```

**終端機 3 - ngrok（本地開發用）**：
```powershell
ngrok http 8000
```

### 步驟 5: 設定 LINE Webhook

1. 複製 ngrok 提供的 URL（例如：`https://xxxx.ngrok.io`）
2. 前往 [LINE Developers Console](https://developers.line.biz/)
3. 選擇你的 Messaging API Channel
4. 前往「Messaging API」標籤
5. 在「Webhook URL」填入：
   ```
   https://你的ngrok網址/api/line-bot/webhook/
   ```
6. 點擊「Update」然後「Verify」

---

## 🎯 如何取得必要的 API Keys

### LINE Channel Access Token 與 Secret

1. 前往 https://developers.line.biz/
2. 建立 Provider（如果還沒有）
3. 建立 Messaging API Channel
4. 在「Basic settings」找到 **Channel Secret**
5. 在「Messaging API」點擊「Issue」取得 **Channel Access Token**

### OpenAI API Key

1. 前往 https://platform.openai.com/
2. 註冊/登入帳號
3. 前往「API Keys」
4. 點擊「Create new secret key」
5. 複製並安全保存 API Key

---

## ✅ 驗證安裝

### 1. 測試後端 API

訪問：http://localhost:8000/admin
- 應該能看到 Django Admin 登入頁面
- 登入後應該看到「LINE BOT 餐廳助手」相關模型

### 2. 測試前端介面

訪問：http://localhost:3000/merchant/line-bot/faq
- 應該能看到 FAQ 管理介面
- 可以新增測試 FAQ

### 3. 測試 LINE BOT

1. 使用手機 LINE 掃描你的 Bot QR Code 加入好友
2. 發送訊息測試
3. 檢查是否收到自動回覆

---

## 📝 建立第一個 FAQ

1. 訪問 http://localhost:3000/merchant/line-bot/faq
2. 點擊「+ 新增 FAQ」
3. 填寫：
   - **問題**：你們的營業時間是？
   - **答案**：我們的營業時間是週一至週五 11:00-21:00
   - **關鍵字**：營業時間、幾點開、幾點關
   - **優先順序**：10
4. 點擊「建立」
5. 在 LINE 發送「營業時間」測試

---

## 🔧 疑難排解

### 問題：pip install 失敗
```powershell
# 升級 pip
python -m pip install --upgrade pip
# 重新安裝
pip install openai requests
```

### 問題：Webhook 驗證失敗
- 檢查 ngrok 是否正常運行
- 確認 Django 後端已啟動
- 檢查 `.env` 中的 LINE_CHANNEL_SECRET 是否正確

### 問題：AI 回覆沒反應
- 確認 OPENAI_API_KEY 正確
- 檢查 OpenAI 帳戶是否有餘額
- 查看 Django console 錯誤訊息

### 問題：前端無法連接後端
- 確認後端運行在 http://localhost:8000
- 檢查 CORS 設定（已在 settings.py 中配置）

---

## 📚 下一步

✅ 問題回覆功能已完成
🔜 實作推播功能
🔜 設計 Rich Menu
🔜 建立 Flex Message 模板

詳細文檔請參考：`docs/LINE_BOT_SETUP.md`

---

## 🎉 完成！

你的 LINE BOT 已經可以運作了！

有任何問題請查看完整文檔或聯繫開發團隊。
