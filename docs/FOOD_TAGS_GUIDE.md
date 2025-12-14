# 食物標籤功能 - API 使用指南

## 🎯 功能概述
已成功在商品系統中新增食物標籤功能，用於個人化推薦系統。

## 📊 資料庫結構

### FoodTag 模型
- `name`: 標籤名稱（唯一）
- `description`: 標籤描述
- `color`: 標籤顏色（十六進位色碼）
- `is_active`: 啟用狀態

### Product 模型
- 新增 `food_tags`: ManyToMany 關聯到 FoodTag

## 🔌 API 端點

### 1. 食物標籤管理 API

#### 獲取所有標籤
```http
GET /api/products/food-tags/
Authorization: Bearer {access_token}
```

**回應範例：**
```json
[
  {
    "id": 1,
    "name": "辣",
    "description": "辛辣口味",
    "color": "#EF4444",
    "is_active": true,
    "created_at": "2025-12-14T10:00:00Z"
  },
  {
    "id": 2,
    "name": "素食",
    "description": "素食選項",
    "color": "#16A34A",
    "is_active": true,
    "created_at": "2025-12-14T10:00:00Z"
  }
]
```

#### 獲取熱門標籤
```http
GET /api/products/food-tags/popular/
Authorization: Bearer {access_token}
```

返回最常使用的前 20 個標籤。

#### 建立新標籤（管理員）
```http
POST /api/products/food-tags/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "新標籤",
  "description": "標籤描述",
  "color": "#3B82F6"
}
```

### 2. 商品管理 API（已更新）

#### 建立商品（含標籤）
```http
POST /api/products/products/
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

name: 麻辣雞排
price: 120.00
description: 香辣可口的雞排
category: 1
service_type: both
food_tag_ids: [1, 7, 24]  # 辣、雞肉、油炸
image: [file]
```

#### 更新商品標籤
```http
PATCH /api/products/products/{id}/
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "food_tag_ids": [1, 2, 14]
}
```

#### 查詢商品（含標籤資訊）
```http
GET /api/products/public/products/?store={store_id}
```

**回應範例：**
```json
[
  {
    "id": 1,
    "name": "麻辣雞排",
    "price": "120.00",
    "description": "香辣可口的雞排",
    "food_tags": [
      {
        "id": 1,
        "name": "辣",
        "color": "#EF4444"
      },
      {
        "id": 7,
        "name": "雞肉",
        "color": "#C2410C"
      }
    ],
    ...
  }
]
```

#### 按標籤篩選商品
```http
GET /api/products/public/products/?store={store_id}&food_tag={tag_id}
```

## 🎨 前端使用

### 在商品表單中使用
```javascript
import { FoodTags } from '../../components/common/FoodTags';

// 顯示商品標籤
<FoodTags tags={product.food_tags} maxDisplay={5} />
```

### 商品卡片中顯示標籤
```javascript
{product.food_tags && product.food_tags.length > 0 && (
  <FoodTags tags={product.food_tags} maxDisplay={3} />
)}
```

## 📝 預設標籤清單

已建立 44 個預設標籤，包括：

**口味特性：** 辣、甜、鹹、酸、微辣、重辣

**肉類：** 牛肉、豬肉、雞肉、羊肉、海鮮、魚、蝦

**飲食偏好：** 素食、全素、蛋奶素、健康、低卡、高蛋白

**過敏原：** 含堅果、含乳製品、含麩質、無麩質

**烹飪方式：** 油炸、清蒸、燒烤、炒、燉

**溫度：** 冰涼、溫熱、熱騰騰

**餐點類型：** 主食、小菜、湯品、飲料、甜點、點心

**份量：** 大份、適中、小份

**特色：** 招牌、新品、季節限定、人氣

## 🔧 管理命令

### 建立預設標籤
```bash
python manage.py create_default_food_tags
```

## 🚀 下一步：個人化推薦

有了食物標籤後，可以實作以下推薦功能：

1. **基於標籤的推薦**
   - 找出用戶常點的標籤
   - 推薦相似標籤的商品

2. **協同過濾**
   - 分析同時被點擊的標籤組合
   - "喜歡『辣』的人也喜歡『雞肉』"

3. **用戶畫像**
   - 建立用戶偏好標籤檔案
   - 自動推薦符合偏好的新商品

## 📱 前端整合示例

完整的商品管理表單已更新，包括：
- ✅ 標籤選擇介面
- ✅ 視覺化標籤顯示
- ✅ 顏色客製化
- ✅ 響應式設計

## 🎯 使用場景

1. **商家上架商品時**：選擇適合的標籤
2. **顧客瀏覽商品時**：透過標籤快速了解特性
3. **推薦系統**：分析用戶標籤偏好
4. **搜尋篩選**：按標籤篩選商品
