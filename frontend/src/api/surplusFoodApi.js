import api from './api';

/**
 * 惜福食品 API
 */
export const surplusFoodApi = {
  // ============ 惜福類別管理 ============

  /**
   * 獲取所有惜福類別
   */
  getCategories: async () => {
    const response = await api.get('/merchant/surplus/categories/');
    return response.data;
  },

  /**
   * 創建惜福類別
   */
  createCategory: async (data) => {
    const response = await api.post('/merchant/surplus/categories/', data);
    return response.data;
  },

  /**
   * 更新惜福類別
   */
  updateCategory: async (id, data) => {
    const response = await api.put(`/merchant/surplus/categories/${id}/`, data);
    return response.data;
  },

  /**
   * 刪除惜福類別
   */
  deleteCategory: async (id) => {
    const response = await api.delete(`/merchant/surplus/categories/${id}/`);
    return response.data;
  },

  // ============ 惜福時段管理 ============

  /**
   * 獲取所有惜福時段
   */
  getTimeSlots: async () => {
    const response = await api.get('/merchant/surplus/time-slots/');
    return response.data;
  },

  /**
   * 創建惜福時段
   */
  createTimeSlot: async (data) => {
    const response = await api.post('/merchant/surplus/time-slots/', data);
    return response.data;
  },

  /**
   * 更新惜福時段
   */
  updateTimeSlot: async (id, data) => {
    const response = await api.put(`/merchant/surplus/time-slots/${id}/`, data);
    return response.data;
  },

  /**
   * 刪除惜福時段
   */
  deleteTimeSlot: async (id) => {
    const response = await api.delete(`/merchant/surplus/time-slots/${id}/`);
    return response.data;
  },

  // ============ 惜福食品管理 ============

  /**
   * 獲取惜福食品列表
   */
  getSurplusFoods: async (params = {}) => {
    const response = await api.get('/merchant/surplus/foods/', { params });
    return response.data;
  },

  /**
   * 獲取單個惜福食品詳情
   */
  getSurplusFood: async (id) => {
    const response = await api.get(`/merchant/surplus/foods/${id}/`);
    return response.data;
  },

  /**
   * 創建惜福食品
   */
  createSurplusFood: async (formData) => {
    const response = await api.post('/merchant/surplus/foods/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * 更新惜福食品
   */
  updateSurplusFood: async (id, formData) => {
    const response = await api.put(`/merchant/surplus/foods/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * 刪除惜福食品
   */
  deleteSurplusFood: async (id) => {
    const response = await api.delete(`/merchant/surplus/foods/${id}/`);
    return response.data;
  },

  /**
   * 上架惜福食品
   */
  publishSurplusFood: async (id) => {
    const response = await api.post(`/merchant/surplus/foods/${id}/publish/`);
    return response.data;
  },

  /**
   * 下架惜福食品
   */
  unpublishSurplusFood: async (id) => {
    const response = await api.post(`/merchant/surplus/foods/${id}/unpublish/`);
    return response.data;
  },

  /**
   * 獲取統計資料
   */
  getStatistics: async () => {
    const response = await api.get('/merchant/surplus/foods/statistics/');
    return response.data;
  },

  // ============ 訂單管理 ============

  /**
   * 獲取惜福食品訂單列表
   */
  getOrders: async (params = {}) => {
    const response = await api.get('/merchant/surplus/orders/', { params });
    return response.data;
  },

  /**
   * 確認訂單
   */
  confirmOrder: async (id) => {
    const response = await api.post(`/merchant/surplus/orders/${id}/confirm/`);
    return response.data;
  },

  /**
   * 標記為可取餐
   */
  readyOrder: async (id) => {
    const response = await api.post(`/merchant/surplus/orders/${id}/ready/`);
    return response.data;
  },

  /**
   * 完成訂單
   */
  completeOrder: async (id) => {
    const response = await api.post(`/merchant/surplus/orders/${id}/complete/`);
    return response.data;
  },

  /**
   * 取消訂單
   */
  cancelOrder: async (id) => {
    const response = await api.post(`/merchant/surplus/orders/${id}/cancel/`);
    return response.data;
  },

  /**
   * 拒絕訂單
   */
  rejectOrder: async (id) => {
    const response = await api.post(`/merchant/surplus/orders/${id}/reject/`);
    return response.data;
  },

  /**
   * 刪除訂單（已完成或已取消的訂單）
   */
  deleteOrder: async (id) => {
    const response = await api.delete(`/merchant/surplus/orders/${id}/delete_order/`);
    return response.data;
  },

  // ============ 顧客端公開 API ============

  /**
   * 顧客瀏覽惜福食品列表
   */
  getPublicSurplusFoods: async (params = {}) => {
    const response = await api.get('/surplus/foods/', { params });
    return response.data;
  },

  /**
   * 顧客查看惜福食品詳情
   */
  getPublicSurplusFood: async (id) => {
    const response = await api.get(`/surplus/foods/${id}/`);
    return response.data;
  },

  // ============ 綠色點數規則管理 ============

  /**
   * 獲取所有綠色點數規則
   */
  getGreenPointRules: async (params = {}) => {
    const response = await api.get('/merchant/surplus/green-point-rules/', { params });
    return response.data;
  },

  /**
   * 獲取單個綠色點數規則
   */
  getGreenPointRule: async (id) => {
    const response = await api.get(`/merchant/surplus/green-point-rules/${id}/`);
    return response.data;
  },

  /**
   * 創建綠色點數規則
   */
  createGreenPointRule: async (data) => {
    const response = await api.post('/merchant/surplus/green-point-rules/', data);
    return response.data;
  },

  /**
   * 更新綠色點數規則
   */
  updateGreenPointRule: async (id, data) => {
    const response = await api.put(`/merchant/surplus/green-point-rules/${id}/`, data);
    return response.data;
  },

  /**
   * 刪除綠色點數規則
   */
  deleteGreenPointRule: async (id) => {
    const response = await api.delete(`/merchant/surplus/green-point-rules/${id}/`);
    return response.data;
  },

  /**
   * 切換規則啟用狀態
   */
  toggleGreenPointRuleActive: async (id) => {
    const response = await api.post(`/merchant/surplus/green-point-rules/${id}/toggle_active/`);
    return response.data;
  },

  /**
   * 獲取綠色點數規則統計
   */
  getGreenPointRulesStatistics: async () => {
    const response = await api.get('/merchant/surplus/green-point-rules/statistics/');
    return response.data;
  },

  // ============ 點數兌換規則管理 ============

  /**
   * 獲取所有點數兌換規則
   */
  getRedemptionRules: async () => {
    const response = await api.get('/merchant/surplus/redemption-rules/');
    return response.data;
  },

  /**
   * 創建點數兌換規則
   */
  createRedemptionRule: async (data) => {
    const response = await api.post('/merchant/surplus/redemption-rules/', data);
    return response.data;
  },

  /**
   * 更新點數兌換規則
   */
  updateRedemptionRule: async (id, data) => {
    const response = await api.put(`/merchant/surplus/redemption-rules/${id}/`, data);
    return response.data;
  },

  /**
   * 刪除點數兌換規則
   */
  deleteRedemptionRule: async (id) => {
    const response = await api.delete(`/merchant/surplus/redemption-rules/${id}/`);
    return response.data;
  },

  /**
   * 切換兌換規則啟用狀態
   */
  toggleRedemptionRuleActive: async (id) => {
    const response = await api.post(`/merchant/surplus/redemption-rules/${id}/toggle_active/`);
    return response.data;
  },

  // ============ 用戶綠色點數餘額 ============

  /**
   * 獲取用戶在指定店家的綠色點數餘額
   */
  getUserGreenPoints: async (storeId) => {
    const response = await api.get(`/green-points/store/${storeId}/`);
    return response.data;
  },

  /**
   * 公開獲取店家的兌換規則（不需登入）
   */
  getPublicRedemptionRules: async (storeId) => {
    const response = await api.get(`/redemption-rules/store/${storeId}/`);
    return response.data;
  },

  /**
   * 扣除用戶綠色點數（兌換使用）
   * @param {number} storeId - 店家 ID
   * @param {number} amount - 扣除點數
   * @param {string} reason - 扣除原因
   */
  useGreenPoints: async (storeId, amount, reason = '兌換使用') => {
    const response = await api.post(`/green-points/store/${storeId}/`, {
      amount,
      reason
    });
    return response.data;
  },
};

export default surplusFoodApi;




