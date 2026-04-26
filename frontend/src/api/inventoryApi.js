import api from './api';
import { cachedGet, clearRequestCache } from './requestCache';

// 取得所有原物料
export const getIngredients = async () => {
  const response = await cachedGet(api, '/inventory/ingredients/', {}, 15 * 1000);
  return response.data;
};

// 取得單一原物料
export const getIngredient = async (id) => {
  const response = await api.get(`/inventory/ingredients/${id}/`);
  return response.data;
};

// 新增原物料
export const createIngredient = async (ingredientData) => {
  const response = await api.post('/inventory/ingredients/', ingredientData);
  clearRequestCache();
  return response.data;
};

// 更新原物料
export const updateIngredient = async (id, ingredientData) => {
  const response = await api.put(`/inventory/ingredients/${id}/`, ingredientData);
  clearRequestCache();
  return response.data;
};

// 刪除原物料
export const deleteIngredient = async (id) => {
  const response = await api.delete(`/inventory/ingredients/${id}/`);
  clearRequestCache();
  return response.data;
};

// 取得低庫存原物料
export const getLowStockIngredients = async () => {
  const response = await cachedGet(api, '/inventory/ingredients/low_stock/', {}, 15 * 1000);
  return response.data;
};

// 依類別取得原物料
export const getIngredientsByCategory = async (category) => {
  const params = category ? { category } : {};
  const response = await api.get('/inventory/ingredients/by_category/', { params });
  return response.data;
};

// 調整庫存數量
export const adjustIngredientQuantity = async (id, adjustment) => {
  const response = await api.post(`/inventory/ingredients/${id}/adjust_quantity/`, {
    adjustment
  });
  return response.data;
};

// 匯出當日原物料清單
export const exportTodayIngredients = async () => {
  const response = await api.get('/inventory/ingredients/export_today/', {
    responseType: 'blob'
  });
  return response.data;
};
