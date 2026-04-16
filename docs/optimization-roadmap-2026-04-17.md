# DineVerse 專案掃描與優化路線（2026-04-17）

## 1. 掃描範圍摘要
- 已掃描前後端核心架構與主要設定：Django settings、主路由、前端 API 攔截器與 features 模組。
- 已盤點 Django 資料模型：backend/apps 下共 51 個 models.Model。
- 專案總檔案數約 143,848（含相依與建置產物）；排除 node_modules/build/media 等後約 8,936。

## 2. 技術架構現況
- Frontend: React
- Backend: Django + DRF
- Authentication: Firebase + JWT
- Database: PostgreSQL
- Integration: LINE Bot

## 3. 資料庫模型盤點（依 app）
- users: User, Company, Merchant, PaymentCard
- stores: Store, StoreImage, MenuImage
- products: ProductCategory, Product, ProductIngredient, SpecificationGroup, ProductSpecification
- orders: TakeoutOrder, TakeoutOrderItem, DineInOrder, DineInOrderItem, Notification
- reviews: StoreReview, ProductReview, StoreReviewImage, ProductReviewImage
- reservations: Reservation, ReservationChangeLog, TimeSlot
- loyalty: PointRule, MembershipLevel, RedemptionProduct, CustomerLoyaltyAccount, PointTransaction, Redemption
- schedules: Staff, JobRole, Shift, EmployeeScheduleRequest
- inventory: Ingredient
- intelligence: PlatformSettings
- surplus_food: SurplusFoodCategory, SurplusTimeSlot, SurplusFood, SurplusFoodOrder, SurplusFoodOrderItem, GreenPointRule, PointRedemptionRule, UserGreenPoints, GreenPointTransaction
- line_bot: StoreLineBotConfig, LineUserBinding, StoreFAQ, ConversationLog, BroadcastMessage, MerchantLineBinding, PlatformBroadcast

## 4. 本次已完成優化
- 後端設定改為可由環境變數控制（DEBUG / ALLOWED_HOSTS / CORS）。
- Firebase Admin 初始化錯誤改以 logger 記錄，不再直接 print。
- 補齊 production.py 安全設定骨架。
- 修正 PaymentCard 加密金鑰行為：
  - 正式環境要求 ENCRYPTION_KEY。
  - 開發環境提供可重啟仍穩定解密的固定推導 key（由 SECRET_KEY 推導）。
- 新增 backend/.env.example 與 frontend/.env.example。

## 5. 下一步優化建議（建議順序）
1) 安全與部署
- 建立正式環境部署設定流程（production settings + secrets 管理）。
- 導入錯誤監控與結構化日誌。

2) API 與授權一致性
- 重構 frontend/src/api/api.js 的 userType 判斷邏輯，建立路由規則映射。
- 將權限判斷集中於後端 permissions 模組。

3) 效能
- 盤點訂單、店家、商品的 select_related / prefetch_related。
- 為高頻查詢加索引並補上 queryset profile。

4) 品質與可維護性
- 補齊 API 文件（OpenAPI/Swagger）。
- 補後端整合測試與前端核心流程測試。

## 6. 建議我下一個直接執行的任務
- 任務 A：重構 frontend/src/api/api.js token 與 userType 決策（低風險、立即提升穩定性）。
- 任務 B：補後端 production-ready 日誌與錯誤告警配置。
- 任務 C：針對訂單與店家 API 做第一輪資料查詢效能優化。
