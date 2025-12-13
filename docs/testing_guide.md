# 點數累積系統測試指南

## 系統狀態

✅ **後端服務**: http://127.0.0.1:8000/
✅ **前端服務**: http://localhost:3001/
✅ **測試店家**: 櫻花日式料理 (whisper@gmail.com)
✅ **會員功能**: 已啟用
✅ **點數規則**: 已設定（每消費100元得1點）

## 完整測試流程

### 第一步：商家登入並查看點數規則

1. 訪問 http://localhost:3001/login
2. 使用商家帳號登入：
   - 帳號：`whisper@gmail.com`
   - 密碼：`whisper1234`（或您設定的密碼）

3. 進入「商家後台」
4. 點擊「會員制度管理」
5. 切換到「點數規則」標籤
6. 您應該可以看到已創建的規則：
   - 規則名稱：基本點數規則
   - 點數累積方式：每消費 $100 元累積 1 點
   - 最低消費金額：無限制

### 第二步：新增或修改點數規則（可選）

在「點數規則」頁面：

1. 點擊「新增規則」按鈕
2. 填寫表單：
   - **規則名稱**：例如「週末雙倍優惠」
   - **每消費多少元可以累積 1 點**：例如輸入 `50`（表示每消費50元得1點）
   - **最低消費金額**：例如輸入 `200`（表示至少消費200元才能獲得點數）
3. 點擊「新增」儲存

**說明**：
- 輸入 `100` = 每消費100元得1點（標準）
- 輸入 `50` = 每消費50元得1點（優惠 2倍）
- 輸入 `200` = 每消費200元得1點（較嚴格）

### 第三步：顧客下單測試

1. 登出商家帳號
2. 登入或註冊一個顧客帳號
3. 訪問櫻花日式料理店家頁面
4. 選擇商品並下單（建議選擇總金額超過100元的商品）
5. 完成訂單

**範例計算**：
- 假設訂單金額為 $350 元
- 使用規則：每消費100元得1點
- 獲得點數：350 ÷ 100 = 3 點（系統會自動計算）

### 第四步：查看獲得的點數

#### 方法一：從店家頁面進入
1. 在櫻花日式料理店家頁面
2. 點擊「會員中心」按鈕
3. 查看您在該店家的點數

#### 方法二：查看所有店家會員資訊
1. 在導航列找到「會員中心」
2. 查看所有您有會員資格的店家
3. 每張卡片會顯示：
   - 可用點數（綠色大數字）
   - 累計點數（下方小字）

### 第五步：驗證點數交易記錄（開發者檢查）

使用 Django shell 查詢點數交易記錄：

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py shell
```

然後執行：

```python
from apps.loyalty.models import CustomerLoyaltyAccount, PointTransaction
from django.contrib.auth import get_user_model

User = get_user_model()

# 查看某個用戶的會員帳戶
user = User.objects.get(email='顧客的email')  # 替換為實際的顧客email
accounts = CustomerLoyaltyAccount.objects.filter(user=user)

for account in accounts:
    print(f"\n店家：{account.store.name}")
    print(f"可用點數：{account.available_points}")
    print(f"累計點數：{account.total_points}")
    
    # 查看點數交易記錄
    transactions = PointTransaction.objects.filter(account=account)
    print(f"\n交易記錄（共 {transactions.count()} 筆）：")
    for t in transactions:
        print(f"  - {t.created_at.strftime('%Y-%m-%d %H:%M')}: {t.points:+d} 點 - {t.description}")
```

## 預期結果

### ✅ 商家端
- 可以新增、查看、刪除點數規則
- 表單說明清楚易懂
- 規則列表顯示「每消費 $X 元累積 1 點」

### ✅ 系統自動計算
- 顧客下單後，系統自動：
  1. 檢查是否已登入
  2. 檢查店家是否啟用會員功能
  3. 查找店家的活躍點數規則
  4. 檢查訂單金額是否達到最低門檻
  5. 計算獲得的點數
  6. 更新會員帳戶點數
  7. 創建點數交易記錄

### ✅ 顧客端
- 在會員中心可以看到各店家的點數
- 顯示可用點數和累計點數
- 點數會即時更新

## 常見問題排查

### 問題：下單後沒有獲得點數

檢查清單：
1. ✓ 是否已登入顧客帳號？
2. ✓ 店家是否啟用會員功能？
   ```python
   # Django shell
   from apps.stores.models import Store
   s = Store.objects.get(name='櫻花日式料理')
   print(s.enable_loyalty)  # 應該是 True
   ```
3. ✓ 是否有活躍的點數規則？
   ```python
   from apps.loyalty.models import PointRule
   rules = PointRule.objects.filter(store=s, active=True)
   print(rules.count())  # 應該 > 0
   ```
4. ✓ 訂單金額是否達到最低門檻？
5. ✓ 檢查後端日誌是否有錯誤訊息

### 問題：前端顯示點數為 0

1. 檢查 API 回應：
   - 打開瀏覽器開發者工具（F12）
   - Network 標籤
   - 查看 `/loyalty/customer/accounts/` 的回應
   - 確認 `available_points` 和 `total_points` 的值

2. 檢查資料庫：
   ```python
   from apps.loyalty.models import CustomerLoyaltyAccount
   accounts = CustomerLoyaltyAccount.objects.all()
   for a in accounts:
       print(f"{a.user.email} @ {a.store.name}: {a.available_points} 點")
   ```

## 測試資料範例

### 範例 1：標準點數規則
- 規則：每消費 100 元得 1 點
- 消費 350 元 → 獲得 3 點
- 消費 99 元 → 獲得 0 點
- 消費 1000 元 → 獲得 10 點

### 範例 2：優惠點數規則
- 規則：每消費 50 元得 1 點（雙倍優惠）
- 消費 350 元 → 獲得 7 點
- 消費 125 元 → 獲得 2 點

### 範例 3：有最低消費門檻
- 規則：每消費 100 元得 1 點，最低消費 200 元
- 消費 350 元 → 獲得 3 點 ✓
- 消費 150 元 → 獲得 0 點 ✗（未達最低門檻）
- 消費 250 元 → 獲得 2 點 ✓

## API 測試（使用 Postman 或 curl）

### 1. 查看點數規則
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://127.0.0.1:8000/api/loyalty/merchant/point-rules/
```

### 2. 新增點數規則
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "測試規則",
       "points_per_currency": 0.01,
       "min_spend": 0,
       "active": true
     }' \
     http://127.0.0.1:8000/api/loyalty/merchant/point-rules/
```

### 3. 查看顧客會員帳戶
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://127.0.0.1:8000/api/loyalty/customer/accounts/
```

## 成功指標

✅ 商家可以輕鬆設定點數規則（直覺的表單）
✅ 顧客下單後自動獲得點數（無需手動操作）
✅ 點數正確顯示在會員中心（即時更新）
✅ 點數計算準確無誤（符合規則設定）
✅ 系統穩定運行（無錯誤日誌）
