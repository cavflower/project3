import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getMyStore } from '../../api/storeApi';
import './Sidebar.css';

const Sidebar = ({ isOpen }) => {
  const { user } = useAuth();
  const [storeSettings, setStoreSettings] = useState({
    enable_reservation: true,
    enable_loyalty: true,
    enable_surplus_food: true,
  });

  useEffect(() => {
    // 如果是店家，載入店家設定
    if (user?.user_type === 'merchant') {
      loadStoreSettings();
    }
  }, [user]);

  const loadStoreSettings = async () => {
    try {
      const response = await getMyStore();
      const store = response.data;
      setStoreSettings({
        enable_reservation: store.enable_reservation !== undefined ? store.enable_reservation : true,
        enable_loyalty: store.enable_loyalty !== undefined ? store.enable_loyalty : true,
        enable_surplus_food: store.enable_surplus_food !== undefined ? store.enable_surplus_food : true,
      });
    } catch (error) {
      console.error('載入店家設定失敗:', error);
    }
  };

  // 訪客點擊「我的訂位」導向查詢頁面，會員導向訂位清單
  const handleReservationClick = (e) => {
    if (!user) {
      e.preventDefault();
      window.location.href = '/guest-lookup';
    }
  };

  // 顧客端 Sidebar
  if (!user || user.user_type === 'customer') {
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
        <h3>店家管理</h3>
      </div>
      <ul className="sidebar-links">
        {/* 菜單管理 */}
        <p className="sidebar-section-title">菜單管理</p>
        <li><Link to="/merchant/products">📦 商品管理</Link></li>
        <li><Link to="/merchant/dine-in">🪑 內用設定</Link></li>
        <li><Link to="/merchant/settings">🏪 餐廳設定</Link></li>
        
        <hr />
        
        {/* 營運管理 */}
        <p className="sidebar-section-title">營運管理</p>
        <li><Link to="/merchant/schedule">👨‍🍳 排班管理</Link></li>
        <li><Link to="/merchant/inventory">🧊 原物料管理</Link></li>
        <li><Link to="/merchant/reports">📊 營運報表</Link></li>
        
        <hr />
        
        {/* 行銷管理 */}
        <p className="sidebar-section-title">行銷管理</p>
        <li><Link to="/merchant/orders">🛒 訂單管理</Link></li>
        <li><Link to="/merchant/promotions">📢 行銷活動</Link></li>
        <li><Link to="/merchant/line-bot">🤖 餐廳助手</Link></li>
        
        <hr />
        
        {/* 額外功能 */}
        <p className="sidebar-section-title">額外功能</p>
        <li className={!storeSettings.enable_reservation ? 'disabled' : ''}>
          <Link to="/merchant/reservations">📅 訂位管理</Link>
        </li>
        <li className={!storeSettings.enable_loyalty ? 'disabled' : ''}>
          <Link to="/merchant/loyalty">🎁 會員制度</Link>
        </li>
        <li className={!storeSettings.enable_surplus_food ? 'disabled' : ''}>
          <Link to="/merchant/surplus-food">♻️ 惜福品</Link>
        </li>
      </ul>
    </aside>
  );
};

export default Sidebar;
