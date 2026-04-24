import api from './api';

// 顧客會員帳戶相關 API
export const getLoyaltyAccounts = () => api.get('/loyalty/customer/accounts/');

export const getLoyaltyAccount = (accountId) => api.get(`/loyalty/customer/accounts/${accountId}/`);

export const getAccountTransactions = (accountId) => 
  api.get(`/loyalty/customer/accounts/${accountId}/transactions/`);

// 點數交易記錄相關 API
export const getPointTransactions = () => api.get('/loyalty/customer/transactions/');

// 兌換商品相關 API
export const getRedemptionProducts = (storeId = null) => {
  const params = storeId ? { store: storeId } : {};
  return api.get('/loyalty/redemptions/', { params });
};

export const getRedemptionProduct = (productId) => 
  api.get(`/loyalty/redemptions/${productId}/`);

// 我的兌換記錄相關 API
export const getMyRedemptions = () => api.get('/loyalty/customer/my-redemptions/');

export const createRedemption = (productId) => 
  api.post('/loyalty/customer/my-redemptions/', { product: productId });

export const cancelRedemption = (redemptionId) => 
  api.post(`/loyalty/customer/my-redemptions/${redemptionId}/cancel/`);

export const getMyPlatformCoupons = () =>
  api.get('/loyalty/customer/platform-coupons/');

export const claimPlatformCoupon = (token) =>
  api.post('/loyalty/customer/platform-coupons/claim/', { token });

export const getMerchantMembershipLevels = () =>
  api.get('/loyalty/merchant/membership-levels/');

export const createMerchantMembershipLevel = (data) =>
  api.post('/loyalty/merchant/membership-levels/', data);

export const updateMerchantMembershipLevel = (id, data) =>
  api.patch(`/loyalty/merchant/membership-levels/${id}/`, data);

export const deleteMerchantMembershipLevel = (id) =>
  api.delete(`/loyalty/merchant/membership-levels/${id}/`);

// 會員等級相關 API（公開）
export const getMembershipLevels = (storeId) => 
  api.get(`/stores/${storeId}/membership-levels/`);
