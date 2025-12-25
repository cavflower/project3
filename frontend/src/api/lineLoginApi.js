import api from './api';

/**
 * LINE Login API
 */

/**
 * 取得 LINE Login 授權 URL
 * @param {string} redirectUri - 授權完成後的回調 URL
 */
export const getLineAuthUrl = async (redirectUri) => {
    const params = redirectUri ? { redirect_uri: redirectUri } : {};
    const response = await api.get('/intelligence/line-login/auth-url/', { params });
    return response.data;
};

/**
 * 處理 LINE Login 回調
 * @param {string} code - LINE 授權碼
 * @param {string} state - CSRF 防護 state
 * @param {string} redirectUri - 回調 URL
 */
export const handleLineCallback = async (code, state, redirectUri) => {
    const response = await api.post('/intelligence/line-login/callback/', {
        code,
        state,
        redirect_uri: redirectUri,
    });
    return response.data;
};

/**
 * 綁定 LINE 帳號
 * @param {Object} data - LINE 用戶資料
 * @param {string} data.line_user_id - LINE User ID
 * @param {string} data.display_name - LINE 顯示名稱
 * @param {string} data.picture_url - LINE 頭像 URL
 */
export const bindLine = async (data) => {
    const response = await api.post('/intelligence/line-login/bind/', data);
    return response.data;
};

/**
 * 解除 LINE 綁定
 */
export const unbindLine = async () => {
    const response = await api.post('/intelligence/line-login/unbind/');
    return response.data;
};

/**
 * 取得 LINE 綁定狀態
 */
export const getLineBindingStatus = async () => {
    const response = await api.get('/intelligence/line-login/status/');
    return response.data;
};

export default {
    getLineAuthUrl,
    handleLineCallback,
    bindLine,
    unbindLine,
    getLineBindingStatus,
};
