import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { updateUser as updateUserApi, authApi } from '../api/authApi'; // 引入 API 函數

// 1. 建立 Context
const AuthContext = createContext(null);

// localStorage 快取 key
const USER_CACHE_KEY = 'cached_user_data';

// 從 localStorage 讀取快取的用戶資料
const getCachedUser = () => {
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Error parsing cached user:', e);
    localStorage.removeItem(USER_CACHE_KEY);
  }
  return null;
};

// 儲存用戶資料到 localStorage
const setCachedUser = (userData) => {
  if (userData) {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
  } else {
    localStorage.removeItem(USER_CACHE_KEY);
  }
};

// 2. 建立 Provider (提供者) 元件
export const AuthProvider = ({ children }) => {
  // 優先使用快取的用戶資料，實現即時顯示
  const [user, setUser] = useState(() => getCachedUser());
  const [loading, setLoading] = useState(() => {
    // 如果有快取的用戶資料，不需要顯示載入狀態
    return !getCachedUser();
  });
  const navigate = useNavigate();
  const isVerifyingRef = useRef(false);

  // 在應用程式載入時驗證 session（背景驗證）
  useEffect(() => {
    const verifyUserSession = async () => {
      // 避免重複驗證
      if (isVerifyingRef.current) return;
      isVerifyingRef.current = true;

      let userData = null;
      let tokenType = null;

      // 嘗試 customer token
      const customerToken = localStorage.getItem('customer_accessToken');
      if (customerToken) {
        try {
          userData = await authApi.getMe('customer');
          tokenType = 'customer';
        } catch (error) {
          console.log("Customer token 驗證失敗，嘗試 merchant token");
          localStorage.removeItem('customer_accessToken');
          localStorage.removeItem('customer_refreshToken');
        }
      }

      // 嘗試 merchant token（如果 customer token 失敗或不存在）
      if (!userData) {
        const merchantToken = localStorage.getItem('merchant_accessToken');
        if (merchantToken) {
          try {
            userData = await authApi.getMe('merchant');
            tokenType = 'merchant';
          } catch (error) {
            console.log("Merchant token 驗證失敗");
            localStorage.removeItem('merchant_accessToken');
            localStorage.removeItem('merchant_refreshToken');
          }
        }
      }

      // 更新用戶狀態和快取
      if (userData) {
        setUser(userData);
        setCachedUser(userData);
      } else {
        // Token 驗證失敗，清除快取
        setUser(null);
        setCachedUser(null);
      }

      setLoading(false);
      isVerifyingRef.current = false;
    };

    verifyUserSession();
  }, []); // 空依賴陣列表示只在掛載時執行一次

  // 登入功能
  const login = (userData, redirectPath = null) => {
    console.log("登入成功，使用者資料:", userData);
    console.log("Redirect path received in login:", redirectPath);
    setUser(userData); // 設定全域使用者狀態
    setCachedUser(userData); // 快取用戶資料以供頁面刷新時使用

    // 檢查 user_type 是否存在
    if (!userData.user_type) {
      console.error("使用者資料缺少 user_type，無法判斷使用者類型");
      setUser(null);
      // 清除所有可能的 token
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('customer_accessToken');
      localStorage.removeItem('customer_refreshToken');
      localStorage.removeItem('merchant_accessToken');
      localStorage.removeItem('merchant_refreshToken');
      navigate('/login/customer');
      return;
    }

    // 如果有指定的 redirect 路徑，優先使用（檢查非空字串）
    if (redirectPath && redirectPath.trim() !== '') {
      console.log("導向至指定路徑:", redirectPath);
      navigate(redirectPath);
      return;
    }

    // 根據使用者類型和方案狀態導航到不同頁面
    if (userData.user_type === 'merchant') {
      // 如果是商家，檢查是否有選擇方案
      if (!userData.merchant_profile?.plan) {
        // 如果 plan 是 null 或 undefined，導向到方案選擇頁
        console.log("商家尚未選擇方案，導向至方案選擇頁。");
        navigate('/select-plan');
      } else {
        // 如果已選擇方案，導向到儀表板
        console.log("商家已選擇方案，導向至儀表板。");
        navigate('/dashboard');
      }
    } else if (userData.user_type === 'customer') {
      // 如果是顧客，導向到顧客首頁
      console.log("顧客登入，導向至顧客首頁。");
      navigate('/customer-home');
    } else {
      // 未知的使用者類型
      console.error("未知的使用者類型:", userData.user_type);
      setUser(null);
      // 清除所有可能的 token
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('customer_accessToken');
      localStorage.removeItem('customer_refreshToken');
      localStorage.removeItem('merchant_accessToken');
      localStorage.removeItem('merchant_refreshToken');
      navigate('/login/customer');
    }
  };

  // 登出功能
  const logout = (redirectPath = null) => {
    console.log("登出");
    const currentUserType = user?.user_type || 'customer';
    setUser(null);
    setCachedUser(null); // 清除快取的用戶資料

    // 清除對應用戶類型的 token
    localStorage.removeItem(`${currentUserType}_accessToken`);
    localStorage.removeItem(`${currentUserType}_refreshToken`);

    // 如果有指定的 redirect 路徑，導向該路徑
    if (redirectPath) {
      navigate(redirectPath);
    } else {
      // 根據用戶類型導向對應的登入頁
      const loginPath = currentUserType === 'merchant' ? '/login/merchant' : '/login/customer';
      navigate(loginPath);
    }
  };

  // 更新使用者資料功能
  const updateUser = useCallback(async (formData) => {
    if (!user) throw new Error("使用者未登入");

    try {
      const updatedUserData = await updateUserApi(user.firebase_uid, formData);
      setUser(prevUser => ({ ...prevUser, ...updatedUserData })); // 更新本地使用者狀態
      return updatedUserData;
    } catch (error) {
      console.error("在 AuthContext 中更新失敗:", error);
      throw error; // 將錯誤向上拋出，讓呼叫它的元件可以處理
    }
  }, [user]);

  const value = {
    user,
    login,
    logout,
    updateUser, // 提供 updateUser 函數
    loading,    // 提供 loading 狀態
    isLoggedIn: !!user
  };

  // 渲染子元件，讓 ProtectedRoute 自己處理 loading 狀態
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. 建立一個 hook 讓其他元件方便使用
export const useAuth = () => {
  return useContext(AuthContext);
};