import api from './api';

/**
 * 財務分析 API
 */

/**
 * 取得銷售摘要
 * @param {Object} params - 查詢參數
 * @param {string} params.period - 統計週期 ('day', 'week', 'month')
 * @param {string} params.start_date - 開始日期 (ISO 格式)
 * @param {string} params.end_date - 結束日期 (ISO 格式)
 */
export const getSalesSummary = async (params = {}) => {
    const response = await api.get('/intelligence/financial/sales-summary/', { params });
    return response.data;
};

/**
 * 取得 AI 分析報告
 * @param {Object} params - 查詢參數
 * @param {string} params.period - 統計週期 ('day', 'week', 'month')
 */
export const getAIReport = async (params = {}) => {
    const response = await api.get('/intelligence/financial/ai-report/', { params });
    return response.data;
};

export default {
    getSalesSummary,
    getAIReport,
};
