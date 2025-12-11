import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext'; // 1. 引入 useAuth
import { FaBell } from 'react-icons/fa';
import './Navbar.css';

const Navbar = ({ toggleSidebar }) => {
  const { isLoggedIn, user, logout } = useAuth(); // 2. 取得認證狀態、使用者資料和登出函式
  const [dropdownOpen, setDropdownOpen] = useState(false); // 3. 管理下拉選單的狀態
  const location = useLocation(); // 取得當前位置

  // 根據使用者角色決定主頁路徑
  let homePath = '/';
  if (isLoggedIn && user) {
    homePath = user.user_type === 'merchant' ? '/dashboard' : '/customer-home';
  }
  
  // 檢查是否在內用菜單頁面
  const isDineInPage = location.pathname.includes('/dine-in/menu') || location.pathname.includes('/dine-in/order');
  
  // 如果在內用菜單頁面，首頁應該是當前的內用菜單
  if (isDineInPage) {
    const pathParts = location.pathname.split('/');
    const storeId = pathParts[2]; // /store/{storeId}/dine-in/...
    const tableParam = location.search; // 保留桌號參數
    homePath = `/store/${storeId}/dine-in/menu${tableParam}`;
  }

  const handleLogout = () => {
    setDropdownOpen(false); // 關閉選單
    
    // 如果在內用菜單頁面，登出後返回內用菜單
    if (isDineInPage) {
      const pathParts = location.pathname.split('/');
      const storeId = pathParts[2];
      const tableParam = location.search;
      const redirectPath = `/store/${storeId}/dine-in/menu${tableParam}`;
      logout(redirectPath);
    } else {
      logout();
    }
  };

  const renderUserSection = () => {
    if (isLoggedIn) {
      // 如果使用者已登入，顯示頭像和下拉選單
      return (
        <div className="profile-section">
          {user?.user_type === 'customer' && (
            <Link 
              to="/customer/orders" 
              state={{ activeTab: 'notifications' }} 
              className="notification-btn"
              title="訂單通知"
            >
              <FaBell />
            </Link>
          )}
          <button className="avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
            {user?.avatar_url && user.avatar_url.startsWith('data:image') ? (
              <img src={user.avatar_url} alt={user.username} className="avatar-img" />
            ) : (
              user?.username?.charAt(0).toUpperCase() || 'U'
            )}
          </button>
          {dropdownOpen && (
            <ul className="profile-dropdown">
              <li><Link to="/profile" onClick={() => setDropdownOpen(false)}>編輯資料</Link></li>
              {user?.user_type === 'customer' && (
                <li><Link to="/customer/loyalty" onClick={() => setDropdownOpen(false)}>會員中心</Link></li>
              )}
              <li><button onClick={handleLogout}>登出</button></li>
            </ul>
          )}
        </div>
      );
    } else {
      // 如果使用者未登入，顯示登入和註冊按鈕
      // 構建登入 URL，如果在特定頁面則帶上 redirect 參數
      const currentPath = location.pathname + location.search;
      const shouldRedirect = location.pathname.includes('/store/') || 
                            location.pathname.includes('/dine-in/') ||
                            location.pathname.includes('/takeout/');
      const loginPath = shouldRedirect 
        ? `/login/customer?redirect=${encodeURIComponent(currentPath)}`
        : '/login/customer';
      
      return (
        <ul className="navbar-links">
          <li><Link to={loginPath}>登入</Link></li>
          <li><Link to="/register/customer" className="register-btn">註冊</Link></li>
        </ul>
      );
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          ☰
        </button>
        <div className="navbar-logo">
          <Link to={homePath}>DineVerse</Link>
        </div>
      </div>
      {renderUserSection()}
    </nav>
  );
};

export default Navbar;
