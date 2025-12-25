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

export default {
    getAISettings,
    updateAISettings,
    getLineSettings,
    updateLineSettings,
};

