import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import FeatureCard from './components/FeatureCard';
import './MerchantDashboard.css';


import { 
  FaStore, 
  FaClipboardList, 
  FaUsers, 
  FaChartLine, 
  FaUtensils, 
  FaBullhorn,
  FaGift,
  FaBoxes,
  FaCalendarCheck,
} from 'react-icons/fa';

const MerchantDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCardClick = (path) => {
    navigate(path);
  };

  const features = [
    {
      id: 'product-management',
      name: '商品管理',
      description: '新增、編輯或下架您的商品',
      icon: FaStore,
      path: '/merchant/products',
    },
    {
      id: 'order-management',
      name: '訂單管理',
      description: '查看即時訂單並管理出餐狀態',
      icon: FaClipboardList,
      path: '/merchant/orders',
    },
    {
      id: 'reservation-management',
      name: '訂位管理',
      description: '管理顧客的訂位請求與狀態',
      icon: FaUsers,
      path: '/merchant/reservations',
    },
    {

      id: 'inventory-management',
      name: '原物料管理',
      description: '管理原料的進出貨記錄',
      icon: FaBoxes,
      path: '/merchant/inventory',
    },

    {
      id: 'reports',
      name: '營運報表',
      description: '查看銷售、顧客與營運相關報表',
      icon: FaChartLine,
      path: '/merchant/reports',
    },
    {
      id: 'store-settings',
      name: '餐廳設定',
      description: '設定您的餐廳資訊與營業狀態',
      icon: FaUtensils,
      path: '/merchant/settings',
    },
    {
      id: 'promotions',
      name: '行銷活動',
      description: '建立與管理您的行銷活動',
      icon: FaBullhorn,
      path: '/merchant/promotions',
    },

    {
      id: 'loyalty',
      name: '會員制度',
      description: '設定點數規則、會員等級與兌換商品',
      icon: FaGift,
      path: '/merchant/loyalty',
    },

    {
      id: 'schedule-management',
      name: '排班管理',
      description: '建立班表、追蹤缺口與智慧排班',
      icon: FaCalendarCheck,
      path: '/merchant/schedule',
    },

  ];

  return (
    <div className="merchant-dashboard">
      <header className="dashboard-header">
        <h1>歡迎，{user?.username || '店家老闆'}！</h1>
        <p>這裡是您的管理後台，請選擇一項功能開始。</p>
      </header>
      <main className="features-grid">
        {features.map((feature) => (
          <FeatureCard
            key={feature.id}
            icon={feature.icon}
            name={feature.name}
            description={feature.description}
            path={feature.path}
            onClick={handleCardClick}
          />
        ))}
      </main>
    </div>
  );
};

export default MerchantDashboard;
