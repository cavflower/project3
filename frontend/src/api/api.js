import axios from 'axios';
import firebase from '../lib/firebase'; // 若你使用 modular firebase，這個檔案應該有匯出或可取 getAuth()

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api'
});

// 是否正在刷新 token 的標記
let isRefreshing = false;
// 等待刷新完成的請求隊列
let failedQueue = [];

// 處理等待隊列中的請求
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 根據 URL 路徑和 HTTP 方法判斷使用哪個用戶類型的 token
const getUserTypeFromUrl = (url, method = 'get') => {
  if (!url) return null;
  
  // 登入和註冊相關的 API 不需要 token
  if (url.includes('/users/token/') || url.includes('/users/register/')) {
    return null; // 返回 null 表示不需要 token
  }
  
  // /users/me/ 需要根據當前頁面路徑判斷
  if (url.includes('/users/me/')) {
    const path = window.location.pathname;
    if (path.includes('/merchant/') || path.includes('/dashboard') || path.includes('/select-plan')) {
      return 'merchant';
    }
    return 'customer';
  }
  
  // 如果是店家相關的 API，使用 merchant token（除了 published 和 retrieve API）
  // retrieve API 是 GET /stores/{id}/，用於查看已上架店家的詳細資訊，不需要 token
  if (url.includes('/stores/') && !url.includes('/stores/published/')) {
    // 檢查是否是 retrieve 操作（GET /stores/{id}/，且不是 my_store 或其他需要認證的操作）
    // 排除 my_store, upload_images, delete_image, publish, unpublish 等需要認證的操作
    // 只有 GET 方法且符合特定格式的才是公開的 retrieve 操作
    const isRetrieve = /\/stores\/\d+\/?$/.test(url) && 
                       method.toLowerCase() === 'get' &&
                       !url.includes('/my_store/') &&
                       !url.includes('/upload_images/') &&
                       !url.includes('/images/') &&
                       !url.includes('/publish/') &&
                       !url.includes('/unpublish/');
    if (isRetrieve) {
      return null; // retrieve 操作不需要 token
    }
    return 'merchant';
  }
  
  // 其他情況使用 customer token
  return 'customer';
};

// 攔截器，在每個請求中附加 token
api.interceptors.request.use(
  async (config) => {
    try {
      // 優先從 localStorage 取得後端 access token（merchant/customer）
      const tokenKeys = ['merchant_accessToken', 'customer_accessToken', 'accessToken'];
      let token = tokenKeys.map(k => localStorage.getItem(k)).find(Boolean);

      // 如果沒有後端 token，嘗試從 firebase currentUser 取得 idToken
      if (!token) {
        try {
          const user =
            (firebase && firebase.auth && firebase.auth().currentUser) ||
            (firebase && firebase.getAuth && firebase.getAuth().currentUser);
          if (user) {
            // 支援不同 firebase api：currentUser.getIdToken()
            token = await (user.getIdToken ? user.getIdToken() : user.getIdToken(true));
          }
        } catch (e) {
          // 忽略，繼續沒有 token 的情況（會由後端回 401）
          console.debug('[api] no firebase token', e?.message);
        }
      }

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        // 開發時可開 debug log
        // console.log('[api] attach Authorization to', config.url);
      } else {
        // console.log('[api] no token attached for', config.url);
      }
    } catch (err) {
      console.warn('[api] interceptor error', err);
    }

    return config;
  }, (error) => Promise.reject(error));

// 響應攔截器，處理 token 過期
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 如果是 401 錯誤且不是刷新 token 的請求，且尚未重試過
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 如果正在刷新，將請求加入隊列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      // 根據請求 URL 和 HTTP 方法判斷使用哪個用戶類型的 token
      const userType = getUserTypeFromUrl(originalRequest.url, originalRequest.method);
      
      // 如果這個 API 不需要 token，直接返回錯誤
      if (userType === null) {
        isRefreshing = false;
        return Promise.reject(error);
      }
      
      const finalUserType = userType || 'customer';
      const refreshTokenKey = `${finalUserType}_refreshToken`;
      const accessTokenKey = `${finalUserType}_accessToken`;
      const refreshToken = localStorage.getItem(refreshTokenKey);
      
      if (!refreshToken) {
        // 沒有 refresh token，清除該用戶類型的 token 並導向登入
        localStorage.removeItem(accessTokenKey);
        localStorage.removeItem(refreshTokenKey);
        processQueue(new Error('No refresh token'), null);
        isRefreshing = false;
        const loginPath = finalUserType === 'merchant' ? '/login/merchant' : '/login/customer';
        window.location.href = loginPath;
        return Promise.reject(error);
      }

      try {
        // 嘗試刷新 token
        // 注意：這裡需要使用不帶攔截器的 axios 實例，避免無限循環
        const refreshAxios = axios.create({
          baseURL: 'http://127.0.0.1:8000/api',
        });
        
        const response = await refreshAxios.post('/users/token/refresh/', {
          refresh: refreshToken
        });

        const { access } = response.data;
        
        if (!access) {
          throw new Error('No access token in refresh response');
        }
        
        // 更新對應用戶類型的 localStorage
        localStorage.setItem(accessTokenKey, access);
        
        // 更新原始請求的 header
        originalRequest.headers['Authorization'] = `Bearer ${access}`;
        
        // 處理等待隊列
        processQueue(null, access);
        isRefreshing = false;
        
        // 重新發送原始請求
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // 刷新失敗，清除該用戶類型的 token 並導向登入
        localStorage.removeItem(accessTokenKey);
        localStorage.removeItem(refreshTokenKey);
        // 也清除舊格式的 token
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        processQueue(refreshError, null);
        isRefreshing = false;
        const loginPath = finalUserType === 'merchant' ? '/login/merchant' : '/login/customer';
        window.location.href = loginPath;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
