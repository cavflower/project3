import api from './api'; // 確保這是您配置了攔截器的 axios 實例
import axios from 'axios';

export const authApi = {
  /**
   * 透過使用者 UID 從後端獲取使用者資料
   * @param {string} uid - Firebase 使用者 UID
   * @returns {Promise<object>} 使用者資料
   */
  getUserProfile: async (uid) => {
    try {
      const response = await api.get(`/users/${uid}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error.response || error);
      throw error;
    }
  },

  /**
   * 向後端註冊新使用者
   * @param {object} userData - 使用者註冊資料
   * @returns {Promise<object>} 後端返回的使用者資料
   */
  register: async (userData) => {
    try {
      const response = await api.post('/users/register/', userData);
      return response.data;
    } catch (error) {
      console.error('Error registering user:', error.response || error);
      throw error;
    }
  },

  /**
   * 使用 Firebase ID Token 換取後端 JWT
   * @param {string} idToken - Firebase 使用者 ID Token
   * @returns {Promise<object>} 包含 access、refresh token 和 user 物件
   */
  getBackendTokens: async (idToken, userType = null) => {
    try {
      // 使用不帶攔截器的 axios 實例來避免循環依賴
      const axiosInstance = axios.create({
        baseURL: 'http://127.0.0.1:8000/api',
      });
      
      const response = await axiosInstance.post('/users/token/', { id_token: idToken });
      // 後端現在會回傳 { access, refresh, user }
      const { access, refresh, user } = response.data;

      // 根據用戶類型決定 token key
      // 如果沒有提供 userType，從 user 物件中獲取
      const finalUserType = userType || user?.user_type || 'customer';
      const accessTokenKey = `${finalUserType}_accessToken`;
      const refreshTokenKey = `${finalUserType}_refreshToken`;

      // 將 token 存入 localStorage（使用用戶類型作為前綴）
      if (access && refresh) {
        // 清除舊格式的 token（如果有）
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        
        // 儲存新格式的 token
        localStorage.setItem(accessTokenKey, access);
        localStorage.setItem(refreshTokenKey, refresh);
      }
      
      // 回傳整個 response.data，讓呼叫它的地方可以取得 user 物件
      return response.data;
    } catch (error) {
      console.error('Error exchanging token:', error.response || error);
      throw error;
    }
  },

  /**
   * 獲取商家資料
   * @param {string} uid - Firebase 使用者 UID
   * @returns {Promise<object>} 商家資料
   */
  getMerchantProfile: async (uid) => {
    try {
      const response = await api.get(`/users/${uid}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching my profile:', error.response || error);
      throw error;
    }
  },

  /**
   * 透過 session token 從後端獲取當前使用者資料
   * @param {string} userType - 用戶類型 ('customer' 或 'merchant')
   * @returns {Promise<object>} 使用者資料
   */
  getMe: async (userType = null) => {
    try {
      // 如果沒有提供 userType，嘗試從 URL 判斷
      if (!userType) {
        const path = window.location.pathname;
        if (path.includes('/merchant/') || path.includes('/dashboard') || path.includes('/select-plan')) {
          userType = 'merchant';
        } else {
          userType = 'customer';
        }
      }
      
      // 使用對應用戶類型的 token
      const tokenKey = `${userType}_accessToken`;
      const token = localStorage.getItem(tokenKey);
      
      if (!token) {
        throw new Error(`No ${userType} token found`);
      }
      
      // 創建一個臨時的 axios 實例來避免使用 api 攔截器
      const axiosInstance = axios.create({
        baseURL: 'http://127.0.0.1:8000/api',
      });
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      const response = await axiosInstance.get('/users/me/');
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error.response || error);
      throw error;
    }
  }
};

/**
 * 更新商家的付費方案
 * @param {string} uid - 使用者的 Firebase UID
 * @param {string} plan - 選擇的方案 ('basic', 'premium', 'enterprise')
 * @returns {Promise<object>} 後端返回的已更新的使用者資料
 */
export const updateMerchantPlan = async (uid, plan) => {
  try {
    const data = {
      merchant_profile: {
        plan: plan,
      },
    };
    const response = await api.put(`/users/${uid}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating merchant plan:', error.response || error);
    throw error;
  }
};

/**
 * 更新使用者資料
 * @param {string} uid - 使用者的 Firebase UID
 * @param {object} data - 包含要更新資料的純 JavaScript 物件
 * @returns {Promise<object>} 後端返回的已更新的使用者資料
 */
export const updateUser = async (uid, data) => {
  try {
    // 現在我們傳送的是 JSON，所以不需要特殊的 headers
    const response = await api.put(`/users/${uid}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating user profile:', error.response || error);
    throw error;
  }
};
