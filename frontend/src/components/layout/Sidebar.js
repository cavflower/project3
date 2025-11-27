import React from 'react';
import { useAuth } from '../../store/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isOpen }) => {
  const { user } = useAuth();

  // 訪客點擊「我的訂位」導向查詢頁面，會員導向訂位清單
  const handleReservationClick = (e) => {
    if (!user) {
      e.preventDefault();
      window.location.href = '/guest-lookup';
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>功能選單</h3>
      </div>
      <ul className="sidebar-links">
        <li><a href="/search">🔍 搜尋店家</a></li>
        <li>
          <a 
            href="/my-reservations" 
            onClick={handleReservationClick}
          >
            📅 我的訂位
          </a>
        </li>
        <li><a href="/orders">🛒 線上點餐</a></li>
        <li><a href="/leaderboard">🏆 熱銷排行</a></li>
        <hr />
        <p className="sidebar-section-title">會員中心</p>
        <li><a href="/profile">👤 個人資料</a></li>
        <li><a href="/reviews">🌟 我的評論</a></li>
        <hr />
        <p className="sidebar-section-title">店家管理</p>
        <li><a href="/merchant/dashboard">📊 儀表板</a></li>
        <li><a href="/merchant/products">📦 商品管理</a></li>
        <li><a href="/merchant/schedule">👨‍🍳 排班管理</a></li>
      </ul>
    </aside>
  );
};

export default Sidebar;
