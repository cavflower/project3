export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export const buildMediaUrl = (path) => {
  if (!path || path.startsWith('http')) {
    return path;
  }
  return `${API_ORIGIN}${path}`;
};
