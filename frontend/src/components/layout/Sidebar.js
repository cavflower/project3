import React, { useState, useEffect } from 'react';
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
          <li><a href="/customer-home">🔍 搜尋店家</a></li>
          <li>
            <a 
              href="/my-reservations" 
              onClick={handleReservationClick}
            >
              📅 我的訂位
            </a>
          </li>
          <li><a href="/orders">🛒 我的訂單</a></li>
          <hr />
          <p className="sidebar-section-title">會員中心</p>
          <li><a href="/profile">👤 個人資料</a></li>
          <li><a href="/customer/loyalty">🌟 我的會員</a></li>
          <li><a href="/reviews">💬 我的評論</a></li>
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
        <li><a href="/merchant/products">📦 商品管理</a></li>
        <li><a href="/merchant/dine-in">🪑 內用設定</a></li>
        <li><a href="/merchant/settings">🏪 餐廳設定</a></li>
        
        <hr />
        
        {/* 營運管理 */}
        <p className="sidebar-section-title">營運管理</p>
        <li><a href="/merchant/schedule">👨‍🍳 排班管理</a></li>
        <li><a href="/merchant/inventory">🧊 原物料管理</a></li>
        <li><a href="/merchant/reports">📊 營運報表</a></li>
        
        <hr />
        
        {/* 行銷管理 */}
        <p className="sidebar-section-title">行銷管理</p>
        <li><a href="/merchant/orders">🛒 訂單管理</a></li>
        <li><a href="/merchant/promotions">📢 行銷活動</a></li>
        <li><a href="/merchant/line-bot">🤖 餐廳助手</a></li>
        
        <hr />
        
        {/* 額外功能 */}
        <p className="sidebar-section-title">額外功能</p>
        <li className={!storeSettings.enable_reservation ? 'disabled' : ''}>
          <a href="/merchant/reservations">📅 訂位管理</a>
        </li>
        <li className={!storeSettings.enable_loyalty ? 'disabled' : ''}>
          <a href="/merchant/loyalty">🎁 會員制度</a>
        </li>
        <li className={!storeSettings.enable_surplus_food ? 'disabled' : ''}>
          <a href="/merchant/surplus-food">♻️ 惜福品</a>
        </li>
      </ul>
    </aside>
  );
};

export default Sidebar;
