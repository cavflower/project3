import api from './api';

/**
 * 店家 LINE 綁定 API
 */

/**
 * 取得店家 LINE 綁定狀態
 */
export const getMerchantLineStatus = async () => {
    const response = await api.get('/line-bot/merchant-binding/status/');
    return response.data;
};

/**
 * 綁定店家 LINE 帳號
 * @param {Object} data - LINE 用戶資料
 * @param {string} data.line_user_id - LINE User ID
 * @param {string} data.display_name - LINE 顯示名稱
 * @param {string} data.picture_url - LINE 頭像 URL
 */
export const bindMerchantLine = async (data) => {
    const response = await api.post('/line-bot/merchant-binding/bind/', data);
    return response.data;
};

/**
 * 解除店家 LINE 綁定
 */
export const unbindMerchantLine = async () => {
    const response = await api.post('/line-bot/merchant-binding/unbind/');
    return response.data;
};

/**
 * 更新店家 LINE 通知偏好
 * @param {Object} preferences - 通知偏好設定
 * @param {boolean} preferences.notify_schedule - 排班通知
 * @param {boolean} preferences.notify_analytics - 營運分析
 * @param {boolean} preferences.notify_inventory - 原物料不足
 * @param {boolean} preferences.notify_order_alert - 訂單異常
 */
export const updateMerchantLinePreferences = async (preferences) => {
    const response = await api.patch('/line-bot/merchant-binding/preferences/', preferences);
    return response.data;
};

export default {
    getMerchantLineStatus,
    bindMerchantLine,
    unbindMerchantLine,
    updateMerchantLinePreferences,
};
