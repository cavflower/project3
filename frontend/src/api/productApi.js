import api from './api';

// ========== 產品類別 API ==========
export const getProductCategories = () => {
  return api.get('/products/categories/');
};

export const getPublicProductCategories = (storeId) => {
  return api.get('/products/public/categories/', {
    params: { store: storeId }
  });
};

export const createProductCategory = (categoryData) => {
  return api.post('/products/categories/', categoryData);
};

export const updateProductCategory = (id, categoryData) => {
  return api.patch(`/products/categories/${id}/`, categoryData);
};

export const deleteProductCategory = (id) => {
  return api.delete(`/products/categories/${id}/`);
};

// ========== 產品 API ==========
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

// ========== 規格類別 API ==========
export const getSpecificationGroups = (productId) => {
  return api.get('/products/specification-groups/', {
    params: { product: productId }
  });
};

export const createSpecificationGroup = (groupData) => {
  return api.post('/products/specification-groups/', groupData);
};

export const updateSpecificationGroup = (id, groupData) => {
  return api.patch(`/products/specification-groups/${id}/`, groupData);
};

export const deleteSpecificationGroup = (id) => {
  return api.delete(`/products/specification-groups/${id}/`);
};

// ========== 規格選項 API ==========
export const getProductSpecifications = (groupId) => {
  return api.get('/products/specifications/', {
    params: { group: groupId }
  });
};

export const createProductSpecification = (specData) => {
  return api.post('/products/specifications/', specData);
};

export const updateProductSpecification = (id, specData) => {
  return api.patch(`/products/specifications/${id}/`, specData);
};

export const deleteProductSpecification = (id) => {
  return api.delete(`/products/specifications/${id}/`);
};

// ========== 公開規格類別 API (顧客端) ==========
export const getPublicSpecificationGroups = (productId) => {
  return api.get('/products/public/specification-groups/', {
    params: { product: productId }
  });
};