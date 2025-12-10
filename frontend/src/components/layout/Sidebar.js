import React from 'react';
import { Link } from 'react-router-dom';
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

  // 顧客端 Sidebar
  if (!user || user.user_type === 'customer') {
    // 檢查是否有員工資料
    const isEmployee = user?.has_staff_profile || user?.staff_profile;
    
    return (
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>功能選單</h3>
        </div>
        <ul className="sidebar-links">
          <li><Link to="/customer-home">🔍 搜尋店家</Link></li>
          <li>
            <Link 
              to="/my-reservations" 
              onClick={handleReservationClick}
            >
              📅 我的訂位
            </Link>
          </li>
          <li><Link to="/orders">🛒 我的訂單</Link></li>
          {isEmployee && (
            <>
              <hr />
              <p className="sidebar-section-title">員工功能</p>
              <li><Link to="/employee/schedule">📋 排班申請</Link></li>
            </>
          )}
          <hr />
          <p className="sidebar-section-title">會員中心</p>
          <li><Link to="/profile">👤 個人資料</Link></li>
          <li><Link to="/customer/loyalty">🌟 我的會員</Link></li>
          <li><Link to="/reviews">💬 我的評論</Link></li>
        </ul>
      </aside>
    );
  }

  // 店家端 Sidebar
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
