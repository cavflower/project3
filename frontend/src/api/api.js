import axios from 'axios';
import firebase from '../lib/firebase';
import { API_BASE_URL } from './apiConfig';
import {
  AUTH_ROLES,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAuthRole,
  saveTokens,
} from './authTokens';

const api = axios.create({
  baseURL: API_BASE_URL,
});

let isRefreshing = false;
let failedQueue = [];

const AUTH_REFRESH_COOLDOWN_MS = 30000;
const refreshBlockedUntil = {
  [AUTH_ROLES.CUSTOMER]: 0,
  [AUTH_ROLES.MERCHANT]: 0,
};

const publicEndpointRules = [
  /^\/users\/token\/?$/,
  /^\/users\/token\/refresh\/?$/,
  /^\/users\/register\/?$/,
  /^\/stores\/all\/?$/,
  /^\/stores\/published\/?/,
  /^\/products\/public\//,
  /^\/surplus\/foods\/?/,
  /^\/surplus\/orders\/?(?:$|\d+\/?$)/,
  /^\/time-slots\/?/,
  /^\/line-bot\/webhook\/?/,
  /^\/orders\/takeout\/?$/,
  /^\/orders\/dinein\/?$/,
  /^\/orders\/status\//,
  /^\/orders\/guest\/lookup\/?$/,
  /^\/reservations\/?/,
];

const merchantEndpointRules = [
  /^\/merchant\//,
  /^\/inventory\//,
  /^\/line-bot\/(?!webhook)/,
  /^\/products\/(?!public\/)/,
  /^\/categories\/?/,
  /^\/specification-groups\/?/,
  /^\/specifications\/?/,
  /^\/product-ingredients\/?/,
  /^\/schedules\/(?!employee-requests\/(?:my_requests|company_stores))/,
  /^\/intelligence\/financial\//,
  /^\/loyalty\/merchant\//,
  /^\/merchant\/surplus\//,
  /^\/orders\/merchant\//,
  /^\/stores\/(?!published\/|all\/?$)/,
];

const customerEndpointRules = [
  /^\/users\/payment-cards\/?/,
  /^\/loyalty\/customer\//,
  /^\/green-points\//,
  /^\/redemption-rules\//,
  /^\/orders\/customer-orders\/?/,
  /^\/orders\/notifications\/?/,
  /^\/reviews\/?/,
  /^\/intelligence\/recommendations\//,
];

const normalizePath = (url = '') => {
  try {
    const parsed = new URL(url, API_BASE_URL);
    return parsed.pathname.replace(/^\/api/, '') || '/';
  } catch (error) {
    return String(url).split('?')[0].replace(/^\/api/, '') || '/';
  }
};

const pathLooksMerchant = () => {
  const path = window.location.pathname;
  return (
    path.includes('/merchant/') ||
    path.includes('/dashboard') ||
    path.includes('/select-plan') ||
    path.includes('/store-settings')
  );
};

const matchesAny = (path, rules) => rules.some((rule) => rule.test(path));

export const resolveAuthRole = (config = {}) => {
  if (config.authRole) {
    return config.authRole === AUTH_ROLES.PUBLIC ? null : config.authRole;
  }

  const path = normalizePath(config.url);
  const method = (config.method || 'get').toLowerCase();

  if (matchesAny(path, publicEndpointRules)) {
    return null;
  }

  if (/^\/stores\/\d+\/?$/.test(path) && method === 'get') {
    return null;
  }

  if (path === '/users/me/') {
    return pathLooksMerchant() ? AUTH_ROLES.MERCHANT : AUTH_ROLES.CUSTOMER;
  }

  if (path.startsWith('/intelligence/line-login/')) {
    return pathLooksMerchant() || localStorage.getItem('merchant_accessToken')
      ? AUTH_ROLES.MERCHANT
      : AUTH_ROLES.CUSTOMER;
  }

  if (path.startsWith('/schedules/employee-requests/')) {
    if (path.includes('/my_requests/') || path.includes('/company_stores/')) {
      return AUTH_ROLES.CUSTOMER;
    }
    return method === 'post' || !pathLooksMerchant() ? AUTH_ROLES.CUSTOMER : AUTH_ROLES.MERCHANT;
  }

  if (matchesAny(path, merchantEndpointRules)) {
    return AUTH_ROLES.MERCHANT;
  }

  if (matchesAny(path, customerEndpointRules)) {
    return AUTH_ROLES.CUSTOMER;
  }

  return pathLooksMerchant() ? AUTH_ROLES.MERCHANT : AUTH_ROLES.CUSTOMER;
};

const isRefreshBlocked = (role) => Date.now() < (refreshBlockedUntil[role] || 0);

const blockRefreshTemporarily = (role) => {
  if (isAuthRole(role)) {
    refreshBlockedUntil[role] = Date.now() + AUTH_REFRESH_COOLDOWN_MS;
  }
};

const dispatchAuthErrorEvent = (role, reason) => {
  try {
    window.dispatchEvent(new CustomEvent('dineverse:auth-error', {
      detail: { userType: role, reason },
    }));
  } catch (error) {
    console.debug('[api] failed to dispatch auth error event', error?.message);
  }
};

const processQueue = (error, token = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

const getFirebaseToken = async () => {
  const user =
    (firebase && firebase.auth && firebase.auth().currentUser) ||
    (firebase && firebase.getAuth && firebase.getAuth().currentUser);

  if (!user || !user.getIdToken) {
    return null;
  }
  return user.getIdToken();
};

api.interceptors.request.use(
  async (config) => {
    const role = resolveAuthRole(config);
    config._authRole = role;

    if (!role) {
      return config;
    }

    let token = getAccessToken(role);

    if (!token) {
      try {
        token = await getFirebaseToken();
      } catch (error) {
        console.debug('[api] no firebase token', error?.message);
      }
    }

    if (!token && config.backgroundRequest && isRefreshBlocked(role)) {
      const cooldownError = new Error('Auth refresh cooldown active');
      cooldownError.code = 'AUTH_COOLDOWN';
      cooldownError.isAuthCooldown = true;
      return Promise.reject(cooldownError);
    }

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const role = originalRequest._authRole || resolveAuthRole(originalRequest);
    const shouldSkipRetry = originalRequest.skipAuthRetry === true;
    const shouldRedirectOnAuthFail = !(originalRequest.backgroundRequest || originalRequest.skipAuthRedirect);

    if (!role || shouldSkipRetry) {
      return Promise.reject(error);
    }

    if (isRefreshBlocked(role)) {
      const blockedError = new Error('Auth refresh blocked by cooldown');
      blockedError.code = 'AUTH_COOLDOWN';
      blockedError.isAuthCooldown = true;
      return Promise.reject(blockedError);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = getRefreshToken(role);

    if (!refreshToken) {
      clearTokens(role);
      blockRefreshTemporarily(role);
      dispatchAuthErrorEvent(role, 'missing_refresh_token');
      processQueue(new Error('No refresh token'), null);
      isRefreshing = false;

      if (shouldRedirectOnAuthFail) {
        window.location.href = role === AUTH_ROLES.MERCHANT ? '/login/merchant' : '/login/customer';
      }
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/users/token/refresh/`, {
        refresh: refreshToken,
      });
      const { access } = response.data;

      if (!access) {
        throw new Error('No access token in refresh response');
      }

      saveTokens(role, access, null);
      originalRequest.headers.Authorization = `Bearer ${access}`;
      processQueue(null, access);
      isRefreshing = false;

      return api(originalRequest);
    } catch (refreshError) {
      clearTokens(role);
      blockRefreshTemporarily(role);
      dispatchAuthErrorEvent(role, 'refresh_failed');
      processQueue(refreshError, null);
      isRefreshing = false;

      if (shouldRedirectOnAuthFail) {
        window.location.href = role === AUTH_ROLES.MERCHANT ? '/login/merchant' : '/login/customer';
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
