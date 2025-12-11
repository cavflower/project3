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

export const getUserOrders = () => api.get('/orders/customer-orders/');

export const getOrderNotifications = () => api.get('/orders/notifications/');

export const markAllNotificationsAsRead = () => api.post('/orders/notifications/mark_all_read/');
