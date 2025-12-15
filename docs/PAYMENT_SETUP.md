# 信用卡付款功能設置指南

## 1. 安裝依賴

```bash
cd backend
pip install -r requirements/base.txt
```

## 2. 創建資料庫遷移

```bash
python manage.py makemigrations users
python manage.py migrate users
```

## 3. 設置環境變數

在 `.env` 檔案中添加加密金鑰（用於加密信用卡資訊）：

```
ENCRYPTION_KEY=your_fernet_encryption_key_here
```

生成加密金鑰的 Python 代碼：
```python
from cryptography.fernet import Fernet
key = Fernet.generate_key()
print(key.decode())
```

## 4. API 端點

### 取得所有信用卡
```
GET /api/users/payment-cards/
```

### 新增信用卡
```
POST /api/users/payment-cards/
Content-Type: application/json

{
  "card_holder_name": "王小明",
  "card_number": "4111111111111111",
  "expiry_month": "12",
  "expiry_year": "2025",
  "cvv": "123",
  "is_default": false
}
```

### 更新信用卡
```
PUT /api/users/payment-cards/{id}/
Content-Type: application/json

{
  "card_holder_name": "王小明",
  "expiry_month": "12",
  "expiry_year": "2026"
}
```

### 設定為預設卡片
```
POST /api/users/payment-cards/{id}/set_default/
```

### 刪除信用卡
```
DELETE /api/users/payment-cards/{id}/
```

## 5. 安全性說明

1. **加密儲存**：卡號和 CVV 使用 Fernet 對稱加密儲存在資料庫中
2. **只顯示後四碼**：前端只會看到卡號後四碼，完整卡號永不返回
3. **HTTPS 傳輸**：生產環境必須使用 HTTPS
4. **權限驗證**：所有 API 都需要用戶登入認證

## 6. 前端使用

信用卡管理功能已整合到個人資料頁面 (`/profile`)，包含：

- 查看所有信用卡（僅顯示後四碼）
- 新增信用卡
- 編輯信用卡資訊
- 設定預設卡片
- 刪除信用卡

## 7. 注意事項

⚠️ **重要安全提醒**：

1. 這個實作是基礎的信用卡儲存功能，適用於開發和測試
2. 在生產環境中，建議使用專業的支付服務（如 Stripe, PayPal）
3. 不建議直接儲存完整的信用卡資訊，應該使用 Token 化
4. 務必遵守 PCI DSS 等金融資料安全標準
5. 定期更新加密金鑰和安全政策
