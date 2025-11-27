import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext'; // 1. 引入 useAuth
import './Navbar.css';

const Navbar = ({ toggleSidebar }) => {
  const { isLoggedIn, user, logout } = useAuth(); // 2. 取得認證狀態、使用者資料和登出函式
  const [dropdownOpen, setDropdownOpen] = useState(false); // 3. 管理下拉選單的狀態

  // 根據使用者角色決定主頁路徑
  let homePath = '/';
  if (isLoggedIn && user) {
    homePath = user.user_type === 'merchant' ? '/dashboard' : '/customer-home';
  }

  const handleLogout = () => {
    setDropdownOpen(false); // 關閉選單
    logout();
  };

  const renderUserSection = () => {
    if (isLoggedIn) {
      // 如果使用者已登入，顯示頭像和下拉選單
      return (
        <div className="profile-section">
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
              <li><Link to="/customer/loyalty" onClick={() => setDropdownOpen(false)}>會員中心</Link></li>
              <li><button onClick={handleLogout}>登出</button></li>
            </ul>
          )}
        </div>
      );
    } else {
      // 如果使用者未登入，顯示登入和註冊按鈕
      return (
        <ul className="navbar-links">
          <li><Link to="/login/customer">登入</Link></li>
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
