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

  // 商家端 API 路徑 (/api/merchant/...)，使用 merchant token
  if (url.includes('/merchant/')) {
    return 'merchant';
  }


  // LINE BOT 相關 API，使用 merchant token
  if (url.includes('/line-bot/')) {
    return 'merchant';
  }

  // 推薦系統相關 API，使用 customer token
  // 財務分析相關 API，使用 merchant token
  if (url.includes('/intelligence/')) {
    if (url.includes('/financial/')) {
      return 'merchant';
    }
    return 'customer';
  }


  // /users/me/ 需要根據當前頁面路徑判斷
  if (url.includes('/users/me/')) {
    const path = window.location.pathname;
    if (path.includes('/merchant/') || path.includes('/dashboard') || path.includes('/select-plan')) {
      return 'merchant';
    }
    return 'customer';
  }

  // 信用卡管理相關 API，使用 customer token（僅顧客端使用）
  if (url.includes('/users/payment-cards')) {
    return 'customer';
  }

  // 評論相關 API，根據當前頁面路徑判斷
  if (url.includes('/reviews/')) {
    const path = window.location.pathname;
    if (path.includes('/merchant/')) {
      return 'merchant';
    }
    return 'customer';
  }

  if (url.includes('/products/') && !url.includes('/public/products/')) {
    return 'merchant';
  }

  // 原物料管理相關的 API，使用 merchant token
  if (url.includes('/inventory/')) {
    return 'merchant';
  }

  // 排班管理相關的 API
  if (url.includes('/schedules/')) {
    // 員工排班申請相關 API
    if (url.includes('/employee-requests/')) {
      // 員工專用的 API（my_requests, company_stores）使用 customer token
      if (url.includes('/my_requests/') || url.includes('/company_stores/')) {
        return 'customer';
      }
      // 其他 employee-requests API：
      // - GET /employee-requests/：店家查看所有員工申請，使用 merchant token
      // - POST /employee-requests/：員工提交申請，使用 customer token
      // - GET /employee-requests/{id}/：根據當前頁面判斷
      // 為了簡化，我們根據當前頁面路徑判斷：
      const path = window.location.pathname;
      if (path.includes('/merchant/')) {
        // 如果是店家頁面，使用 merchant token
        return 'merchant';
      }
      // 默認使用 customer token（員工使用）
      return 'customer';
    }
    // 其他排班管理 API 使用 merchant token（店家管理用）
    return 'merchant';
  }

  // 如果是店家相關的 API，使用 merchant token（除了 published 和 retrieve API）
  // retrieve API 是 GET /stores/{id}/，用於查看已上架店家的詳細資訊，不需要 token
  if (url.includes('/stores/') && !url.includes('/stores/published/')) {
    // 管理員相關的 API 不需要 token
    if (url.includes('/stores/all') || url.includes('/set_discount/')) {
      return null;
    }
    const isRetrieve = /\/stores\/\d+\/?$/.test(url) &&
      method.toLowerCase() === 'get' &&
      !url.includes('/my_store/') &&
      !url.includes('/upload_images/') &&
      !url.includes('/images/') &&
      !url.includes('/publish/') &&
      !url.includes('/unpublish/');
    if (isRetrieve) {
      return null;
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
      // 根據 URL 判斷應該使用哪個用戶類型的 token
      const userType = getUserTypeFromUrl(config.url, config.method);
      let token = null;

      // 如果這個 API 不需要 token，跳過
      if (userType !== null) {
        // 根據用戶類型選擇對應的 token
        const tokenKey = `${userType}_accessToken`;
        token = localStorage.getItem(tokenKey);

        // 如果沒有對應類型的 token，嘗試舊格式的 token
        if (!token) {
          token = localStorage.getItem('accessToken');
        }

        // 如果還是沒有後端 token，嘗試從 firebase currentUser 取得 idToken
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
      }

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
        // 開發時可開 debug log
        console.log('[api] attach Authorization to', config.url, 'with userType:', userType);
      } else {
        console.log('[api] no token attached for', config.url);
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

      console.log('[api] 401 error, attempting token refresh for userType:', userType);
      console.log('[api] Original request URL:', originalRequest.url);

      // 如果這個 API 不需要 token，直接返回錯誤
      if (userType === null) {
        console.log('[api] This API does not require token, rejecting');
        isRefreshing = false;
        return Promise.reject(error);
      }

      const finalUserType = userType || 'customer';
      const refreshTokenKey = `${finalUserType}_refreshToken`;
      const accessTokenKey = `${finalUserType}_accessToken`;
      const refreshToken = localStorage.getItem(refreshTokenKey);

      console.log('[api] Refresh token key:', refreshTokenKey);
      console.log('[api] Refresh token exists:', !!refreshToken);

      if (!refreshToken) {
        // 沒有 refresh token，清除該用戶類型的 token 並導向登入
        console.error('[api] No refresh token found, redirecting to login');
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
