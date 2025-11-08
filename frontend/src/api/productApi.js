import api from './api';

export const getProducts = () => {
  return api.get('/products/products/');
};

export const createProduct = (productData) => {
  // 修正：確保新增商品的請求發送到集合端點，不帶任何 ID
  return api.post('/products/products/', productData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const updateProduct = (id, productData) => {
  // 使用 PATCH 方法進行部分更新是正確的
  return api.patch(`/products/products/${id}/`, productData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteProduct = (id) => {
  return api.delete(`/products/products/${id}/`);
};