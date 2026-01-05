import api from './api';
import axios from 'axios';

const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

/**
 * 管理員 API
 * 用於平台管理員功能
 */

/**
 * 取得平台 AI 設定
 */
export const getAISettings = async () => {
    const response = await axios.get(`${baseURL}/intelligence/platform/ai/`, {
        headers: {
            'X-Admin-Auth': 'true'
        }
    });
    return response.data;
};

/**
 * 更新平台 AI 設定
 * @param {Object} data - AI 設定資料
 */
export const updateAISettings = async (data) => {
    const response = await axios.post(`${baseURL}/intelligence/platform/ai/`, data, {
        headers: {
            'X-Admin-Auth': 'true'
        }
    });
    return response.data;
};

/**
 * 取得平台 LINE 設定
 */
export const getLineSettings = async () => {
    const response = await axios.get(`${baseURL}/intelligence/platform/line/`, {
        headers: {
            'X-Admin-Auth': 'true'
        }
    });
    return response.data;
};

/**
 * 更新平台 LINE 設定
 * @param {Object} data - LINE 設定資料
 */
export const updateLineSettings = async (data) => {
    const response = await axios.post(`${baseURL}/intelligence/platform/line/`, data, {
        headers: {
            'X-Admin-Auth': 'true'
        }
    });
    return response.data;
};

/**
 * 取得平台推播列表
 */
export const getPlatformBroadcasts = async () => {
    const response = await axios.get(`${baseURL}/line-bot/platform-broadcasts/`, {
        headers: { 'X-Admin-Auth': 'true' }
    });
    return response.data;
};

/**
 * 建立平台推播
 */
export const createPlatformBroadcast = async (data) => {
    const response = await axios.post(`${baseURL}/line-bot/platform-broadcasts/`, data, {
        headers: { 'X-Admin-Auth': 'true' }
    });
    return response.data;
};

/**
 * 發送平台推播
 */
export const sendPlatformBroadcast = async (id) => {
    const response = await axios.post(`${baseURL}/line-bot/platform-broadcasts/${id}/send/`, {}, {
        headers: { 'X-Admin-Auth': 'true' }
    });
    return response.data;
};

/**
 * 取得可推薦的店家列表
 */
export const getAvailableStores = async () => {
    const response = await axios.get(`${baseURL}/line-bot/platform-broadcasts/available_stores/`, {
        headers: { 'X-Admin-Auth': 'true' }
    });
    return response.data;
};

/**
 * 預覽推播目標用戶
 */
export const getTargetPreview = async () => {
    const response = await axios.get(`${baseURL}/line-bot/platform-broadcasts/target_preview/`, {
        headers: { 'X-Admin-Auth': 'true' }
    });
    return response.data;
};

export default {
    getAISettings,
    updateAISettings,
    getLineSettings,
    updateLineSettings,
    getPlatformBroadcasts,
    createPlatformBroadcast,
    sendPlatformBroadcast,
    getAvailableStores,
    getTargetPreview,
};
