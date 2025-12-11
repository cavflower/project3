import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { updateUser as updateUserApi, authApi } from '../api/authApi'; // 引入 API 函數

// 1. 建立 Context
const AuthContext = createContext(null);

// 2. 建立 Provider (提供者) 元件
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // 初始 loading 狀態為 true
  const navigate = useNavigate();

  // 在應用程式載入時檢查現有 session
  useEffect(() => {
    const checkUserSession = async () => {
      // 檢查當前路徑，判斷應該使用哪個用戶類型的 token
      const path = window.location.pathname;
      let userType = 'customer';
      
      if (path.includes('/merchant/') || path.includes('/dashboard') || path.includes('/select-plan')) {
        userType = 'merchant';
      }
      
      const tokenKey = `${userType}_accessToken`;
      const token = localStorage.getItem(tokenKey);
      
      if (token) {
        try {
          // 使用 authApi.getMe 來獲取用戶資料
          const userData = await authApi.getMe(userType);
          setUser(userData); // 恢復使用者 session
        } catch (error) {
          // Token 無效或過期
          console.error("Session 檢查失敗:", error);
          localStorage.removeItem(`${userType}_accessToken`);
          localStorage.removeItem(`${userType}_refreshToken`);
          setUser(null);
        }
      }
      setLoading(false); // 檢查完成，設定 loading 為 false
    };

    checkUserSession();
  }, []); // 空依賴陣列表示只在掛載時執行一次

  // 登入功能
  const login = (userData, redirectPath = null) => {
    console.log("登入成功，使用者資料:", userData);
    console.log("Redirect path received in login:", redirectPath);
    setUser(userData); // 設定全域使用者狀態

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

  // 在 loading 期間不渲染子元件，以防止畫面閃爍
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 3. 建立一個 hook 讓其他元件方便使用
export const useAuth = () => {
  return useContext(AuthContext);
};