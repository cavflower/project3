import api from './api';

export const getMyStore = () => {
  return api.get('/stores/my_store/');
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
  return api.get(`/stores/${id}/`);
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

export const getPublishedStores = () => {
  return api.get('/stores/published/');
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
