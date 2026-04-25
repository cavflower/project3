import api from './api';
import { cachedGet } from './requestCache';

export const getMyStore = (params = {}) => {
  return api.get('/stores/my_store/', { params });
};

export const createStore = (storeData) => {
  return api.post('/stores/', storeData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const updateStore = (id, storeData) => {
  return api.patch(`/stores/${id}/`, storeData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const getStore = (id) => {
  return cachedGet(api, `/stores/${id}/`);
};

export const uploadStoreImages = (storeId, images) => {
  const formData = new FormData();
  images.forEach((image) => {
    formData.append('images', image);
  });
  return api.post(`/stores/${storeId}/upload_images/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteStoreImage = (storeId, imageId) => {
  return api.delete(`/stores/${storeId}/images/${imageId}/`);
};

export const publishStore = (storeId) => {
  return api.post(`/stores/${storeId}/publish/`);
};

export const unpublishStore = (storeId) => {
  return api.post(`/stores/${storeId}/unpublish/`);
};

export const getPublishedStores = (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.cuisine_type && filters.cuisine_type !== 'all') {
    params.append('cuisine_type', filters.cuisine_type);
  }
  if (filters.region) {
    params.append('region', filters.region);
  }
  if (filters.has_reservation) {
    params.append('has_reservation', 'true');
  }
  if (filters.has_loyalty) {
    params.append('has_loyalty', 'true');
  }
  if (filters.has_surplus_food) {
    params.append('has_surplus_food', 'true');
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.sort_by) {
    params.append('sort_by', filters.sort_by);
  }
  
  const queryString = params.toString();
  return cachedGet(api, `/stores/published/${queryString ? `?${queryString}` : ''}`);
};

export const uploadMenuImages = (storeId, images) => {
  const formData = new FormData();
  images.forEach((image) => {
    formData.append('images', image);
  });
  return api.post(`/stores/${storeId}/upload_menu_images/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const deleteMenuImage = (storeId, imageId) => {
  return api.delete(`/stores/${storeId}/menu_images/${imageId}/`);
};

export const getDineInLayout = (storeId) => {
  return api.get(`/stores/${storeId}/dine_in_layout/`);
};

export const saveDineInLayout = (storeId, layout) => {
  return api.post(`/stores/${storeId}/dine_in_layout/`, { layout });
};
