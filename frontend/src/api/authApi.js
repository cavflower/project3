import api from './api';
import { AUTH_ROLES, getAccessToken, saveTokens } from './authTokens';

const resolveUserType = (userType) => {
  if (userType) return userType;

  const path = window.location.pathname;
  if (path.includes('/merchant/') || path.includes('/dashboard') || path.includes('/select-plan')) {
    return AUTH_ROLES.MERCHANT;
  }
  return AUTH_ROLES.CUSTOMER;
};

export const authApi = {
  getUserProfile: async (uid) => {
    try {
      const response = await api.get(`/users/${uid}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error.response || error);
      throw error;
    }
  },

  register: async (userData) => {
    try {
      const response = await api.post('/users/register/', userData, {
        authRole: AUTH_ROLES.PUBLIC,
        skipAuthRetry: true,
      });
      return response.data;
    } catch (error) {
      console.error('Error registering user:', error.response || error);
      throw error;
    }
  },

  getBackendTokens: async (idToken, userType = null) => {
    try {
      const response = await api.post(
        '/users/token/',
        { id_token: idToken },
        { authRole: AUTH_ROLES.PUBLIC, skipAuthRetry: true }
      );
      const { access, refresh, user } = response.data;
      const finalUserType = userType || user?.user_type || AUTH_ROLES.CUSTOMER;

      if (access && refresh) {
        saveTokens(finalUserType, access, refresh);
      }

      return response.data;
    } catch (error) {
      console.error('Error exchanging token:', error.response || error);
      throw error;
    }
  },

  getMerchantProfile: async (uid) => {
    try {
      const response = await api.get(`/users/${uid}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching my profile:', error.response || error);
      throw error;
    }
  },

  getMe: async (userType = null) => {
    try {
      const finalUserType = resolveUserType(userType);
      const token = getAccessToken(finalUserType);

      if (!token) {
        throw new Error(`No ${finalUserType} token found`);
      }

      const response = await api.get('/users/me/', {
        authRole: finalUserType,
        skipAuthRedirect: true,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching current user:', error.response || error);
      throw error;
    }
  },
};

export const updateMerchantPlan = async (uid, plan) => {
  try {
    const data = {
      merchant_profile: {
        plan,
      },
    };
    const response = await api.put(`/users/${uid}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating merchant plan:', error.response || error);
    throw error;
  }
};

export const updateUser = async (uid, data) => {
  try {
    const response = await api.put(`/users/${uid}/`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating user profile:', error.response || error);
    throw error;
  }
};
