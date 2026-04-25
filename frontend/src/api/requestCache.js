const cache = new Map();

const DEFAULT_TTL_MS = 30 * 1000;

const makeCacheKey = (url, config = {}) => {
  const params = config.params ? new URLSearchParams(config.params).toString() : '';
  return params ? `${url}?${params}` : url;
};

export const cachedGet = (api, url, config = {}, ttlMs = DEFAULT_TTL_MS) => {
  const key = makeCacheKey(url, config);
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const request = api.get(url, config).catch((error) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, {
    promise: request,
    expiresAt: now + ttlMs,
  });

  return request;
};

export const clearRequestCache = () => {
  cache.clear();
};
