import api from './api';

/**
 * 獲取個人化推薦商品
 * @param {number} storeId - 指定店家ID（可選）
 * @param {number} limit - 返回數量（預設10）
 */
export const getRecommendedProducts = async (storeId = null, limit = 10) => {
  const params = { limit };
  if (storeId) {
    params.store_id = storeId;
  }
  return api.get('/intelligence/recommendations/products/', { params });
};

/**
 * 獲取推薦店家
 * @param {number} limit - 返回數量（預設5）
 * @param {Array} tags - 可選，用戶選擇的標籤陣列
 */
export const getRecommendedStores = async (limit = 5, tags = null) => {
  const params = { limit };
  if (tags && tags.length > 0) {
    params.tags = tags.join(',');
  }
  return api.get('/intelligence/recommendations/stores/', { params });
};

/**
 * 獲取用戶的食物偏好分析
 */
export const getUserPreferences = async () => {
  return api.get('/intelligence/recommendations/preferences/');
};

/**
 * 獲取相似商品
 * @param {number} productId - 商品ID
 */
export const getSimilarProducts = async (productId) => {
  return api.get(`/intelligence/recommendations/${productId}/similar/`);
};
