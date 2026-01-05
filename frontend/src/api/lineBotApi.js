import api from './api';

/**
 * LINE BOT FAQ 管理 API
 */

// 取得所有 FAQ
export const getAllFAQs = async () => {
  const response = await api.get('/line-bot/faqs/');
  return response.data;
};

// 取得單一 FAQ
export const getFAQ = async (id) => {
  const response = await api.get(`/line-bot/faqs/${id}/`);
  return response.data;
};

// 建立 FAQ
export const createFAQ = async (data) => {
  const response = await api.post('/line-bot/faqs/', data);
  return response.data;
};

// 更新 FAQ
export const updateFAQ = async (id, data) => {
  const response = await api.put(`/line-bot/faqs/${id}/`, data);
  return response.data;
};

// 部分更新 FAQ
export const patchFAQ = async (id, data) => {
  const response = await api.patch(`/line-bot/faqs/${id}/`, data);
  return response.data;
};

// 刪除 FAQ
export const deleteFAQ = async (id) => {
  const response = await api.delete(`/line-bot/faqs/${id}/`);
  return response.data;
};

// 取得熱門 FAQ
export const getPopularFAQs = async () => {
  const response = await api.get('/line-bot/faqs/popular/');
  return response.data;
};

// 取得對話記錄
export const getConversationLogs = async () => {
  const response = await api.get('/line-bot/conversations/');
  return response.data;
};

// 取得最近對話
export const getRecentConversations = async () => {
  const response = await api.get('/line-bot/conversations/recent/');
  return response.data;
};

// 根據 LINE User ID 查詢對話
export const getConversationsByUser = async (lineUserId) => {
  const response = await api.get(`/line-bot/conversations/by_user/?line_user_id=${lineUserId}`);
  return response.data;
};

// 取得推播訊息列表
export const getBroadcastMessages = async () => {
  const response = await api.get('/line-bot/broadcasts/');
  return response.data;
};

// 建立推播訊息
export const createBroadcastMessage = async (data) => {
  const response = await api.post('/line-bot/broadcasts/', data);
  return response.data;
};

// 發送推播訊息
export const sendBroadcastMessage = async (id) => {
  const response = await api.post(`/line-bot/broadcasts/${id}/send/`);
  return response.data;
};

// 取得個人化推播目標用戶
export const getPersonalizedTargets = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.food_tags && filters.food_tags.length > 0) {
    params.append('food_tags', filters.food_tags.join(','));
  }
  if (filters.days_inactive) {
    params.append('days_inactive', filters.days_inactive);
  }
  const response = await api.get(`/line-bot/broadcasts/get_personalized_targets/?${params.toString()}`);
  return response.data;
};

// 取得店家可用的食物標籤
export const getAvailableFoodTags = async () => {
  const response = await api.get('/line-bot/broadcasts/available_food_tags/');
  return response.data;
};

// 綁定 LINE 帳號
export const bindLineAccount = async (lineUserId) => {
  const response = await api.post('/line-bot/bind/', { line_user_id: lineUserId });
  return response.data;
};

// 取得 LINE 綁定資訊
export const getLineBinding = async () => {
  const response = await api.get('/line-bot/binding/');
  return response.data;
};

// 取得店家 LINE BOT 設定
export const getLineBotConfig = async (storeId) => {
  const response = await api.get('/line-bot/config/', {
    params: { store: storeId }
  });
  return response.data.length > 0 ? response.data[0] : null;
};

// 建立店家 LINE BOT 設定
export const createLineBotConfig = async (data) => {
  const response = await api.post('/line-bot/config/', data);
  return response.data;
};

// 更新店家 LINE BOT 設定
export const updateLineBotConfig = async (id, data) => {
  const response = await api.patch(`/line-bot/config/${id}/`, data);
  return response.data;
};

// 刪除店家 LINE BOT 設定
export const deleteLineBotConfig = async (id) => {
  const response = await api.delete(`/line-bot/config/${id}/`);
  return response.data;
};

export default {
  getAllFAQs,
  getFAQ,
  createFAQ,
  updateFAQ,
  patchFAQ,
  deleteFAQ,
  getPopularFAQs,
  getConversationLogs,
  getRecentConversations,
  getConversationsByUser,
  getBroadcastMessages,
  createBroadcastMessage,
  sendBroadcastMessage,
  getPersonalizedTargets,
  getAvailableFoodTags,
  bindLineAccount,
  getLineBinding,
  getLineBotConfig,
  createLineBotConfig,
  updateLineBotConfig,
  deleteLineBotConfig,
};
