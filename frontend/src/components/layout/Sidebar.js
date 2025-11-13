import React from 'react';
import './Sidebar.css';

const Sidebar = ({ isOpen }) => {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>功能選單</h3>
      </div>
      <ul className="sidebar-links">
        <li><a href="/search">🔍 搜尋店家</a></li>
        <li><a href="/reservations">📅 線上訂位</a></li>
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
        <li><a href="/merchant/staffing">👨‍🍳 智慧排班</a></li>
      </ul>
    </aside>
  );
};

export default Sidebar;
