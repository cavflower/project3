import api from './api';

export const getTakeoutProducts = (storeId) =>
  api.get('/products/public/products/', {
    params: { store: storeId, service_type: 'takeaway' },
  });

export const getDineInProducts = (storeId) =>
  api.get('/products/public/products/', {
    params: { store: storeId },
  });

export const createTakeoutOrder = (payload) =>
  api.post('/orders/takeout/', payload);

export const createDineInOrder = (payload) =>
  api.post('/orders/dinein/', payload);

export const getUserOrders = () =>
  api.get('/orders/customer-orders/', {
    backgroundRequest: true,
    skipAuthRetry: true,
    skipAuthRedirect: true,
  });

export const getOrderNotifications = () =>
  api.get('/orders/notifications/', {
    backgroundRequest: true,
    skipAuthRetry: true,
    skipAuthRedirect: true,
  });

export const deleteCustomerOrder = (orderType, orderId) =>
  api.delete(`/orders/customer-orders/${orderType}/${orderId}/`);

export const markAllNotificationsAsRead = () => api.post('/orders/notifications/mark_all_read/');

export const deleteNotification = (id) => api.delete(`/orders/notifications/${id}/`);

export const deleteAllNotifications = () => api.delete('/orders/notifications/delete_all/');

// 獲取商家待確認訂單（外帶、內用、惜福品）
export const getMerchantPendingOrders = () =>
  api.get('/orders/merchant/pending/', {
    backgroundRequest: true,
    skipAuthRedirect: true,
  });

// 訪客透過電話號碼查詢訂單
export const lookupGuestOrders = (phoneNumber) =>
  api.post('/orders/guest/lookup/', { phone_number: phoneNumber });
