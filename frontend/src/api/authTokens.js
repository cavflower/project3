export const AUTH_ROLES = {
  CUSTOMER: 'customer',
  MERCHANT: 'merchant',
  PUBLIC: 'public',
};

const TOKEN_KEYS = ['accessToken', 'refreshToken'];
const ROLE_TOKEN_KEYS = [
  'customer_accessToken',
  'customer_refreshToken',
  'merchant_accessToken',
  'merchant_refreshToken',
];

export const isAuthRole = (role) => role === AUTH_ROLES.CUSTOMER || role === AUTH_ROLES.MERCHANT;

export const getAccessToken = (role) => {
  if (!isAuthRole(role)) return null;
  return localStorage.getItem(`${role}_accessToken`) || localStorage.getItem('accessToken');
};

export const getRefreshToken = (role) => {
  if (!isAuthRole(role)) return null;
  return localStorage.getItem(`${role}_refreshToken`) || localStorage.getItem('refreshToken');
};

export const saveTokens = (role, access, refresh) => {
  if (!isAuthRole(role)) return;

  TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));

  if (access) {
    localStorage.setItem(`${role}_accessToken`, access);
  }
  if (refresh) {
    localStorage.setItem(`${role}_refreshToken`, refresh);
  }
};

export const clearTokens = (role = null) => {
  if (isAuthRole(role)) {
    localStorage.removeItem(`${role}_accessToken`);
    localStorage.removeItem(`${role}_refreshToken`);
    TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
    return;
  }

  [...TOKEN_KEYS, ...ROLE_TOKEN_KEYS].forEach((key) => localStorage.removeItem(key));
};
