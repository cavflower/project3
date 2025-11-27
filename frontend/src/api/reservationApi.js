import api from './api';

/**
 * 訂位相關 API
 */

// ==================== 顧客端 API ====================

/**
 * 建立訂位（會員/訪客）
 * @param {Object} reservationData - 訂位資料
 * @returns {Promise}
 */
export const createReservation = (reservationData) => {
  return api.post('/reservations/', reservationData);
};

/**
 * 訪客驗證 - 透過手機號碼查詢訂位
 * @param {string} phoneNumber - 手機號碼
 * @returns {Promise}
 */
export const verifyGuestReservation = (phoneNumber) => {
  return api.post('/reservations/verify-guest/', { phone_number: phoneNumber });
};

/**
 * 會員查看自己的訂位列表
 * @returns {Promise}
 */
export const getMyReservations = () => {
  return api.get('/reservations/');
};

/**
 * 取得單筆訂位詳情
 * @param {number} id - 訂位 ID
 * @returns {Promise}
 */
export const getReservationDetail = (id) => {
  return api.get(`/reservations/${id}/`);
};

/**
 * 編輯訂位
 * @param {number} id - 訂位 ID
 * @param {Object} updateData - 更新資料
 * @param {string} phoneNumber - 訪客驗證用手機號碼（訪客必填）
 * @returns {Promise}
 */
export const updateReservation = (id, updateData, phoneNumber = null) => {
  const data = phoneNumber ? { ...updateData, phone_number: phoneNumber } : updateData;
  return api.patch(`/reservations/${id}/`, data);
};

/**
 * 取消訂位
 * @param {number} id - 訂位 ID
 * @param {string} cancelReason - 取消原因
 * @param {string} phoneNumber - 訪客驗證用手機號碼（訪客必填）
 * @returns {Promise}
 */
export const cancelReservation = (id, cancelReason, phoneNumber = null) => {
  const data = { cancel_reason: cancelReason };
  if (phoneNumber) {
    data.phone_number = phoneNumber;
  }
  return api.post(`/reservations/${id}/cancel/`, data);
};

/**
 * 查看訂位變更記錄
 * @param {number} id - 訂位 ID
 * @returns {Promise}
 */
export const getReservationChangeLogs = (id) => {
  return api.get(`/reservations/${id}/change-logs/`);
};

/**
 * 查詢店家的可用訂位時段（公開 API，無需登入）
 * @param {number} storeId - 店家 ID
 * @returns {Promise}
 */
export const getPublicTimeSlots = (storeId, date = null) => {
  const params = new URLSearchParams({ store_id: storeId });
  if (date) {
    params.append('date', date);
  }
  return api.get(`/time-slots/?${params.toString()}`);
};

// ==================== 商家端 API ====================

/**
 * 商家查看店家訂位列表
 * @param {Object} filters - 篩選條件 {status, reservation_date, customer_name}
 * @returns {Promise}
 */
export const getMerchantReservations = (filters = {}) => {
  return api.get('/merchant/reservations/', { params: filters });
};

/**
 * 商家更新訂位狀態
 * @param {number} id - 訂位 ID
 * @param {string} status - 新狀態 (pending/confirmed/completed/no_show)
 * @returns {Promise}
 */
export const updateReservationStatus = (id, status) => {
  return api.post(`/merchant/reservations/${id}/update-status/`, { status });
};

/**
 * 商家取消訂位
 * @param {number} id - 訂位 ID
 * @param {string} cancelReason - 取消原因
 * @returns {Promise}
 */
export const merchantCancelReservation = (id, cancelReason) => {
  return api.post(`/merchant/reservations/${id}/cancel/`, {
    cancel_reason: cancelReason,
  });
};

/**
 * 商家刪除訂位
 * @param {number} id - 訂位 ID
 * @returns {Promise}
 */
export const deleteReservation = (id) => {
  return api.delete(`/merchant/reservations/${id}/`);
};

/**
 * 取得訂位統計資訊
 * @returns {Promise}
 */
export const getReservationStats = () => {
  return api.get('/merchant/reservations/stats/');
};

/**
 * 取得店家訂位設定
 * @returns {Promise}
 */
export const getReservationSettings = () => {
  return api.get('/merchant/reservation-settings/');
};

/**
 * 更新店家訂位設定
 * @param {number} id - 設定 ID
 * @param {Object} settingsData - 設定資料
 * @returns {Promise}
 */
export const updateReservationSettings = (id, settingsData) => {
  return api.patch(`/merchant/reservation-settings/${id}/`, settingsData);
};

// ==================== 時段管理 API ====================

/**
 * 取得店家時段列表
 * @returns {Promise}
 */
export const getTimeSlots = () => {
  return api.get('/merchant/time-slots/');
};

/**
 * 新增時段
 * @param {Object} slotData - 時段資料
 * @returns {Promise}
 */
export const createTimeSlot = (slotData) => {
  return api.post('/merchant/time-slots/', slotData);
};

/**
 * 更新時段
 * @param {number} id - 時段 ID
 * @param {Object} slotData - 時段資料
 * @returns {Promise}
 */
export const updateTimeSlot = (id, slotData) => {
  return api.patch(`/merchant/time-slots/${id}/`, slotData);
};

/**
 * 刪除時段
 * @param {number} id - 時段 ID
 * @returns {Promise}
 */
export const deleteTimeSlot = (id) => {
  return api.delete(`/merchant/time-slots/${id}/`);
};

export default {
  // 顧客端
  createReservation,
  verifyGuestReservation,
  getMyReservations,
  getReservationDetail,
  updateReservation,
  cancelReservation,
  getReservationChangeLogs,
  getPublicTimeSlots,
  
  // 商家端
  getMerchantReservations,
  updateReservationStatus,
  merchantCancelReservation,
  deleteReservation,
  getReservationStats,
  getReservationSettings,
  updateReservationSettings,
  
  // 時段管理
  getTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
};
