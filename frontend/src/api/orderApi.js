import api from './api';

export const getTakeoutProducts = (storeId) =>
  api.get('/products/public/products/', {
    params: { store: storeId, service_type: 'takeaway' },
  });

export const createTakeoutOrder = (payload) =>
  api.post('/orders/takeout/', payload);
