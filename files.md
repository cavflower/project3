# 根目錄
├── .vscode/                  # VS Code 工作區設定
│   ├── extensions.json       # 推薦團隊安裝的擴充套件
│   ├── launch.json           # 一鍵同時啟動前後端的偵錯設定
│   └── settings.json         # 格式化、Linter、Python 直譯器路徑等設定
│
├── backend/                  # Django 後端專案
│   └── ... (詳細結構見下方)
│
├── frontend/                 # React 前端專案
│   └── ... (詳細結構見下方)
│
├── docs/                     # 專案文件 (重要)
│   ├── api/                  # API 文件 (例如 Swagger/OpenAPI 的 YAML 檔)
│   └── architecture.md       # 系統架構圖與說明
│
├── scripts/                  # 輔助腳本
│   ├── deploy.sh             # 部署腳本
│   └── backup_db.sh          # 資料庫備份腳本
│
├── .gitignore                # Git 忽略清單 (非常重要)
└── README.md                 # 專案主說明文件

# 前端
frontend/
├── node_modules/
├── public/                   # 公開資源 (index.html, favicon.ico)
├── src/                      # React 原始碼
│   ├── api/                  # 統一管理所有對後端 API 的請求
│   │   ├── authApi.js
│   │   ├── orderApi.js
│   │   └── ...
│   │
│   ├── assets/               # 全域靜態資源 (圖片、字體、CSS)
│   │
│   ├── components/           # 【共用元件】
│   │   ├── ui/               # 基礎 UI 元件 (Button, Input, Modal, Card)
│   │   └── layout/           # 頁面佈局元件 (Navbar, Sidebar, Footer)
│   │
│   ├── features/             # 【核心功能模組】(取代傳統的 pages 資料夾)
│   │   ├── authentication/   # 登入、註冊、忘記密碼相關元件
│   │   ├── products/         # 商品搜尋、列表、商品詳情頁元件
│   │   ├── cart/             # 購物車相關元件
│   │   ├── checkout/         # 結帳流程相關元件
│   │   ├── reservations/     # 訂位功能相關元件
│   │   └── merchant_dashboard/ # **店家管理後台的所有元件** (這會是一個大模組)
│   │       ├── components/   # 專屬於後台的共用元件
│   │       ├── reports/      # 報表頁面
│   │       ├── product_management/ # 商品管理頁面
│   │       └── ...
│   │
│   ├── hooks/                # 自定義 React Hooks
│   │
│   ├── lib/                  # 第三方服務的設定 (例如 Firebase, 金流 SDK)
│   │
│   ├── store/                # 全域狀態管理 (Redux Toolkit / Zustand)
│   │
│   ├── styles/               # 全域樣式設定
│   │
│   └── utils/                # 共用工具函式
│
└── package.json

# 後端

backend/
├── .venv/                    # Python 虛擬環境
├── apps/                     # 存放所有 Django App 的核心目錄
│   ├── __init__.py
│   │
│   ├── users/                # 負責使用者與商家帳號、認證、個人資料
│   │   ├── models.py         # (例如：自定義 User 模型，包含顧客和商家角色)
│   │   └── ...
│   │
│   ├── stores/               # 負責店家資訊 (分店資料、營業時間、功能開關)
│   │
│   ├── products/             # 負責商品、菜單、分類、規格
│   │
│   ├── orders/               # 負責訂單、購物車、金流處理
│   │
│   ├── reservations/         # 負責線上訂位邏輯
│   │
│   ├── reviews/              # 負責顧客評分、評論
│   │
│   ├── loyalty/              # 負責會員制度 (點數、等級、兌換商品)
│   │
│   ├── reports/              # 負責處理和產生各種報表 (財務、銷售)
│   │
│   └── intelligence/         # 【AI 功能核心 App】
│       ├── management/
│       │   └── commands/
│       │       └── generate_recommendations.py # (定期執行的推薦演算法腳本)
│       │       └── predict_staffing.py       # (智慧排班預測腳本)
│       ├── services/         # 存放與外部 AI 服務 (如 OpenAI) 溝通的邏輯
│       └── ml_models/        # (可選) 存放訓練好的模型檔案 (例如 .pkl)
│
├── catering_platform_api/    # Django 專案設定檔
│   ├── settings/             # 將 settings 拆分，方便管理不同環境
│   │   ├── __init__.py
│   │   ├── base.py           # 基礎通用設定
│   │   ├── development.py    # 開發環境專用設定
│   │   └── production.py     # 生產環境專用設定
│   ├── urls.py               # 總路由
│   └── ...
│
├── manage.py                 # Django 管理工具
└── requirements/             # 將依賴套件拆分，更清晰
    ├── base.txt              # 基礎通用套件
    ├── development.txt       # 開發環境專用
    └── production.txt        # 生產環境專用