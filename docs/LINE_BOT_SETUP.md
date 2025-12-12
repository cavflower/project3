# LINE BOT 餐廳助手 - 設定說明

## 📋 目錄
1. [功能概述](#功能概述)
2. [架構說明](#架構說明)
3. [安裝步驟](#安裝步驟)
4. [LINE Messaging API 設定](#line-messaging-api-設定)
5. [AI 設定（Google Gemini / OpenAI）](#ai-設定)
6. [資料庫遷移](#資料庫遷移)
7. [使用說明](#使用說明)
8. [API 文檔](#api-文檔)

---

## 🎯 功能概述

本 LINE BOT 提供以下功能：

### 1. ✅ 問題回覆系統（已實作）
- **FAQ 自動匹配**：店家可自訂常見問題與答案
- **關鍵字智能匹配**：支援多組關鍵字匹配用戶問題
- **AI 智能回覆**：當 FAQ 無法匹配時，使用 Google Gemini 或 OpenAI 生成回覆
- **對話記錄**：完整記錄所有對話內容供分析使用
- **個別店家設定**：每個店家可獨立設定 LINE Channel 和 AI 服務

### 2. 🔜 店家個人化推播（待實作）
- 根據用戶偏好發送個人化訊息
- 基於消費記錄的精準推薦

### 3. 🔜 餐品/惜福品推播（待實作）
- 新品上架通知
- 惜福食品特價推播
- 每日優惠提醒

### 4. 🔜 會員優惠推播（待實作）
- 點數到期提醒
- 會員等級升級通知
- 專屬優惠券發送

---

## 🏗️ 架構說明

```
backend/apps/line_bot/
├── models.py                      # 資料庫模型
│   ├── LineUserBinding           # LINE 用戶綁定
│   ├── StoreFAQ                  # 店家 FAQ
│   ├── ConversationLog           # 對話記錄
│   ├── BroadcastMessage          # 推播訊息
│   └── StoreLineBotConfig        # 🆕 店家 LINE BOT 設定（個別配置）
├── views.py                       # API 視圖
├── serializers.py                 # 序列化器
├── urls.py                        # URL 路由
├── admin.py                       # Django Admin 配置
└── services/
    ├── line_api.py               # LINE Messaging API 服務
    └── message_handler.py        # 訊息處理器（FAQ + AI - 支援 Gemini/OpenAI）
```

---

## 📦 安裝步驟

### 1. 安裝後端依賴

```bash
cd backend
.\.venv\Scripts\Activate.ps1
pip install requests google-generativeai  # Gemini 必要套件
pip install openai  # 若使用 OpenAI（選用）
```

或者使用 requirements 文件（已更新）：

```bash
pip install -r requirements/base.txt
```

### 2. 環境變數配置（測試用，非必要）

**重要**：本專案採用個別店家設定，建議透過前端管理介面或 Django Admin 設定每個店家的 LINE BOT 配置。

如需測試或作為後備設定，可在 `backend/.env` 檔案中添加：

```env
# LINE Messaging API（測試用）
LINE_CHANNEL_ACCESS_TOKEN=你的_LINE_Channel_Access_Token
LINE_CHANNEL_SECRET=你的_LINE_Channel_Secret

# AI API（測試用）
GEMINI_API_KEY=你的_Google_Gemini_API_Key
# 或
OPENAI_API_KEY=你的_OpenAI_API_Key
```

### 3. 資料庫遷移

```bash
cd backend
python manage.py makemigrations line_bot
python manage.py migrate line_bot
```

---

## 🔧 LINE Messaging API 設定

### Step 1: 建立 LINE Messaging API Channel

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 登入或註冊帳號
3. 建立新的 Provider（如果還沒有）
4. 在 Provider 下建立新的 Messaging API channel

### Step 2: 取得必要資訊

在 Channel 的設定頁面中：

1. **Channel Access Token**
   - 前往「Messaging API」標籤
   - 找到「Channel access token」
   - 點擊「Issue」生成 token
   - 複製 token 並填入 `.env` 的 `LINE_CHANNEL_ACCESS_TOKEN`

2. **Channel Secret**
   - 前往「Basic settings」標籤
   - 找到「Channel secret」
   - 複製 secret 並填入 `.env` 的 `LINE_CHANNEL_SECRET`

### Step 3: 設定 Webhook

1. 在「Messaging API」標籤中找到「Webhook settings」
2. 設定 Webhook URL：
   ```
   https://你的網域/api/line-bot/webhook/
   ```
   
   **本地開發時使用 ngrok：**
   ```bash
   ngrok http 8000
   ```
   然後使用 ngrok 提供的 URL：
   ```
   https://xxxx-xxx-xxx-xxx.ngrok.io/api/line-bot/webhook/
   ```

3. 啟用「Use webhook」
4. 點擊「Verify」測試 webhook 連線

### Step 4: 其他設定

1. **關閉自動回覆訊息**
   - 前往「Messaging API」標籤
   - 找到「Auto-reply messages」
   - 設定為「Disabled」

2. **關閉歡迎訊息**（可選）
   - 找到「Greeting messages」
   - 設定為「Disabled」（如果要自訂歡迎訊息）

---

## 🤖 OpenAI API 設定

### Step 1: 取得 API Key

1. 前往 [OpenAI Platform](https://platform.openai.com/)
2. 登入或註冊帳號
3. 前往「API Keys」頁面
4. 點擊「Create new secret key」
5. 複製 API Key 並填入 `.env` 的 `OPENAI_API_KEY`

### Step 2: 選擇模型

推薦使用的模型：
- `gpt-4o-mini`：性價比最高，回覆速度快（推薦）
- `gpt-4o`：最強大但較貴
- `gpt-3.5-turbo`：經濟實惠

在 `.env` 中設定：
```env
OPENAI_MODEL=gpt-4o-mini
```

### Step 3: 設定用量限制（建議）

1. 在 OpenAI Platform 設定用量上限
2. 監控 API 使用量
3. 考慮實作快取機制以降低成本

---

## 💾 資料庫遷移

執行以下命令建立資料表：

```bash
cd backend
.\.venv\Scripts\python.exe manage.py makemigrations line_bot
.\.venv\Scripts\python.exe manage.py migrate
```

建立的資料表：
- `line_user_bindings` - LINE 用戶綁定
- `store_faqs` - 店家 FAQ
- `conversation_logs` - 對話記錄
- `broadcast_messages` - 推播訊息

---

## 📖 使用說明

### 1. 店家 FAQ 管理

#### 前端介面

訪問：`http://localhost:3000/merchant/line-bot/faq`

功能：
- ✅ 新增/編輯/刪除 FAQ
- ✅ 設定問題、答案、關鍵字
- ✅ 調整 FAQ 優先順序
- ✅ 查看 FAQ 使用統計
- ✅ 啟用/停用 FAQ

#### API 使用

```javascript
import { createFAQ, getAllFAQs } from '../../api/lineBotApi';

// 建立 FAQ
const newFaq = {
  question: "營業時間是幾點到幾點？",
  answer: "我們的營業時間是週一至週五 11:00-21:00，週六日 10:00-22:00",
  keywords: ["營業時間", "幾點開", "幾點關", "開店時間"],
  priority: 10,
  is_active: true
};

await createFAQ(newFaq);
```

### 2. LINE BOT 對話流程

1. **用戶發送訊息**
2. **系統處理流程**：
   ```
   接收訊息
   ↓
   檢查用戶綁定狀態
   ↓
   嘗試 FAQ 匹配（關鍵字比對）
   ↓
   如果匹配成功 → 回傳 FAQ 答案
   ↓
   如果匹配失敗 → 呼叫 OpenAI API 生成回覆
   ↓
   記錄對話內容
   ↓
   發送回覆給用戶
   ```

### 3. 用戶綁定流程

用戶需要先綁定 LINE 帳號才能使用完整功能：

1. 用戶加入 LINE 好友
2. 登入 DineVerse 網站
3. 前往「個人設定」
4. 輸入 LINE User ID 進行綁定

---

## 📡 API 文檔

### FAQ 管理 API

#### 取得所有 FAQ
```
GET /api/line-bot/faqs/
```

#### 建立 FAQ
```
POST /api/line-bot/faqs/
Content-Type: application/json

{
  "question": "問題內容",
  "answer": "答案內容",
  "keywords": ["關鍵字1", "關鍵字2"],
  "priority": 10,
  "is_active": true
}
```

#### 更新 FAQ
```
PUT /api/line-bot/faqs/{id}/
PATCH /api/line-bot/faqs/{id}/
```

#### 刪除 FAQ
```
DELETE /api/line-bot/faqs/{id}/
```

#### 取得熱門 FAQ
```
GET /api/line-bot/faqs/popular/
```

### 對話記錄 API

#### 取得對話記錄
```
GET /api/line-bot/conversations/
```

#### 取得最近對話
```
GET /api/line-bot/conversations/recent/
```

#### 根據 LINE User ID 查詢
```
GET /api/line-bot/conversations/by_user/?line_user_id={line_user_id}
```

### Webhook

```
POST /api/line-bot/webhook/
```
接收來自 LINE 平台的事件（由 LINE 自動呼叫）

---

## 🚀 啟動服務

### 開發環境

1. 啟動後端：
```bash
cd backend
.\.venv\Scripts\python.exe manage.py runserver
```

2. 啟動前端：
```bash
cd frontend
npm start
```

3. 使用 ngrok 暴露 webhook（本地開發）：
```bash
ngrok http 8000
```

### 生產環境

1. 設定 HTTPS（LINE Webhook 必須使用 HTTPS）
2. 配置網域名稱
3. 在 LINE Developer Console 更新 Webhook URL
4. 確保環境變數正確設定

---

## 📊 監控與分析

### 查看對話記錄

在 Django Admin 後台：
1. 前往 `http://localhost:8000/admin`
2. 登入管理員帳號
3. 選擇「Conversation logs」查看所有對話

### FAQ 使用統計

- 在前端介面查看「熱門 FAQ」標籤
- 追蹤各 FAQ 的使用次數
- 根據統計優化 FAQ 內容

---

## 🔒 安全性建議

1. **保護 API Keys**
   - 不要將 `.env` 檔案提交到版本控制
   - 使用環境變數管理敏感資訊

2. **Webhook 簽名驗證**
   - 系統已實作 LINE Webhook 簽名驗證
   - 確保只接受來自 LINE 的請求

3. **速率限制**
   - 考慮實作 API 速率限制
   - 防止惡意濫用

4. **OpenAI 成本控制**
   - 設定 OpenAI 用量上限
   - 優先使用 FAQ 匹配
   - 實作對話快取機制

---

## 🐛 常見問題

### Q: Webhook 無法接收訊息？
A: 
1. 檢查 ngrok 是否正常運行
2. 確認 Webhook URL 設定正確
3. 驗證 LINE Channel Secret 是否正確
4. 查看 Django console 的錯誤訊息

### Q: AI 回覆沒有反應？
A:
1. 檢查 OPENAI_API_KEY 是否正確
2. 確認 OpenAI 帳戶有足夠額度
3. 查看 Django console 的錯誤訊息

### Q: FAQ 無法匹配？
A:
1. 檢查關鍵字設定是否正確
2. 確認 FAQ 狀態為「啟用」
3. 測試關鍵字是否包含在用戶訊息中

---

## 📞 技術支援

如有問題請聯繫開發團隊或查看：
- Django 日誌：`backend/logs/`（如有配置）
- 瀏覽器 Console（前端錯誤）
- Django Admin 後台（資料檢查）

---

## 🎉 完成！

LINE BOT 問題回覆功能已完成部署！

下一步可以實作：
1. 店家個人化推播
2. 餐品/惜福品推播
3. 會員優惠推播
4. Rich Menu 設計
5. Flex Message 模板
