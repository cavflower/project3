# 食物標籤功能 - 店家自訂標籤

## 🎯 功能概述
商品系統支援店家自訂食物標籤，用於個人化推薦系統。店家可以為每個商品輸入多個標籤。

## 📊 資料庫結構

### Product 模型
- `food_tags`: JSONField - 儲存標籤陣列
  - 例如：`["辣", "素食", "健康", "低卡"]`
  - 店家可自由輸入標籤名稱
  - 不限數量

## 🔌 API 使用

### 建立商品（含標籤）
```http
POST /api/products/products/
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

name: 麻辣雞排
price: 120.00
food_tags: ["辣", "雞肉", "油炸", "人氣"]
```

### 更新商品標籤
```json
{
  "food_tags": ["辣", "素食", "健康"]
}
```

## 🎨 前端使用

### 商品表單
店家可以：
1. 輸入標籤名稱
2. 按 Enter 或點擊「新增」
3. 點擊 × 移除標籤

### 顯示標籤
```javascript
<FoodTags tags={product.food_tags} maxDisplay={5} />
```

## 💡 推薦標籤

- **口味**: 辣、甜、鹹、酸
- **飲食**: 素食、健康、低卡
- **食材**: 牛肉、豬肉、雞肉、海鮮
- **特色**: 招牌、人氣、新品、限量
