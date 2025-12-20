# DineVerse 系統架構

## 系統架構圖

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web Browser]
        LINE[LINE App]
    end
    
    subgraph "Frontend - React 18"
        Navbar[導覽列]
        Pages[頁面元件]
        API[API 層]
        Store[狀態管理]
    end
    
    subgraph "Backend - Django REST Framework"
        Auth[認證模組]
        Apps[功能應用]
        Webhook[LINE Webhook]
    end
    
    subgraph "Database Layer"
        PG[(PostgreSQL)]
    end
    
    subgraph "External Services"
        Firebase[Firebase Auth]
        LINEAPI[LINE Messaging API]
        AI[AI Services<br/>Gemini/OpenAI/Groq]
    end
    
    Web --> Navbar
    LINE --> Webhook
    Navbar --> Pages
    Pages --> API
    API --> Store
    API --> Auth
    Auth --> Firebase
    Apps --> PG
    Webhook --> LINEAPI
    Webhook --> AI
```

## 技術架構分層

### 1. 前端層 (Frontend)
- **框架**: React 18.3.1
- **路由**: React Router DOM 7.9.4
- **UI 元件**: Material UI 7.3.6
- **狀態管理**: React Context
- **HTTP 客戶端**: Axios

### 2. 後端層 (Backend)
- **框架**: Django 4.x + Django REST Framework
- **認證**: JWT (Simple JWT) + Firebase
- **API 格式**: RESTful JSON

### 3. 資料層 (Database)
- **主資料庫**: PostgreSQL
- **即時驗證**: Firebase Authentication

### 4. 外部服務
- **Firebase**: 使用者身份驗證
- **LINE Messaging API**: 聊天機器人
- **AI APIs**: 智能回覆服務

## 部署架構

```
                    ┌─────────────────────┐
                    │    Load Balancer    │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
    ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
    │  Frontend   │     │   Backend   │     │   Backend   │
    │   (React)   │     │  (Django)   │     │  (Django)   │
    │   :3000     │     │   :8000     │     │   :8000     │
    └─────────────┘     └──────┬──────┘     └──────┬──────┘
                               │                   │
                        ┌──────▼───────────────────▼──────┐
                        │         PostgreSQL              │
                        │          Database               │
                        └─────────────────────────────────┘
```

## 資料流程

### 訂單流程
```mermaid
sequenceDiagram
    participant C as 顧客
    participant F as Frontend
    participant B as Backend
    participant DB as Database
    
    C->>F: 選擇商品加入購物車
    F->>F: 更新本地購物車狀態
    C->>F: 提交訂單
    F->>B: POST /api/orders/
    B->>DB: 儲存訂單
    B->>F: 返回訂單確認
    F->>C: 顯示訂單確認頁
```

### LINE BOT 流程
```mermaid
sequenceDiagram
    participant U as LINE 用戶
    participant L as LINE Platform
    participant W as Webhook Server
    participant AI as AI Service
    participant DB as Database
    
    U->>L: 發送訊息
    L->>W: Webhook Event
    W->>DB: 查詢 FAQ
    alt FAQ 匹配
        W->>L: 回覆 FAQ 答案
    else 使用 AI
        W->>AI: 生成回覆
        AI->>W: AI 回覆
        W->>L: 回覆訊息
    end
    W->>DB: 記錄對話
    L->>U: 顯示回覆
```
