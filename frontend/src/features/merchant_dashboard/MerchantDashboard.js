import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import FeatureCard from './components/FeatureCard';
import { getMyStore } from '../../api/storeApi';
import { getIngredients } from '../../api/inventoryApi';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
  FaChair,
  FaLeaf,
  FaRobot,
} from 'react-icons/fa';

const MerchantDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [storeSettings, setStoreSettings] = useState({
    enable_reservation: true,
    enable_loyalty: true,
    enable_surplus_food: true,
  });
  const [loading, setLoading] = useState(true);
  const [inventoryStats, setInventoryStats] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [storeResponse, ingredientsData] = await Promise.all([
            getMyStore(),
            getIngredients()
        ]);
        
        const store = storeResponse.data;
        setStoreSettings({
          enable_reservation: store.enable_reservation !== undefined ? store.enable_reservation : true,
          enable_loyalty: store.enable_loyalty !== undefined ? store.enable_loyalty : true,
          enable_surplus_food: store.enable_surplus_food !== undefined ? store.enable_surplus_food : true,
        });

        // Process inventory data
        const lowStock = ingredientsData.filter(i => i.is_low_stock);
        const normalStock = ingredientsData.filter(i => !i.is_low_stock);
        
        setInventoryStats([
            { name: '庫存充足', value: normalStock.length },
            { name: '庫存不足', value: lowStock.length }
        ]);
        setLowStockItems(lowStock);

      } catch (error) {
        console.error('載入儀表板資料失敗:', error);
        // 如果載入失敗，保持預設值（全部啟用）
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const handleCardClick = (path, isDisabled) => {
    if (isDisabled) {
      return; // 如果功能被禁用，不執行導航
    }
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
      id: 'dine-in-settings',
      name: '內用設定',
      description: '調整內用菜單與座位配置',
      icon: FaChair,
      path: '/merchant/dine-in',
    },

    {
      id: 'store-settings',
      name: '餐廳設定',
      description: '設定您的餐廳資訊與營業狀態',
      icon: FaUtensils,
      path: '/merchant/settings',
    },

    {
      id: 'schedule-management',
      name: '排班管理',
      description: '建立班表、追蹤缺口與智慧排班',
      icon: FaCalendarCheck,
      path: '/merchant/schedule',
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
      id: 'order-management',
      name: '訂單管理',
      description: '查看即時訂單並管理出餐狀態',
      icon: FaClipboardList,
      path: '/merchant/orders',
    },

    {
      id: 'promotions',
      name: '行銷活動',
      description: '建立與管理您的行銷活動',
      icon: FaBullhorn,
      path: '/merchant/promotions',
    },


    
    {
      id: 'line-bot-settings',
      name: '餐廳助手 (LINE BOT)',
      description: '設定 LINE BOT 自動回覆與通知功能',
      icon: FaRobot,
      path: '/merchant/line-bot',
    },

    {
      id: 'reservation-management',
      name: '訂位管理',
      description: '管理顧客的訂位請求與狀態',
      icon: FaUsers,
      path: '/merchant/reservations',
      requiresFeature: 'enable_reservation',
    },

    {
      id: 'loyalty',
      name: '會員制度',
      description: '設定點數規則、會員等級與兌換商品',
      icon: FaGift,
      path: '/merchant/loyalty',
      requiresFeature: 'enable_loyalty',
    },

    {
      id: 'surplus-food',
      name: '惜福品',
      description: '設定即期或剩餘食材的優惠方案',
      icon: FaLeaf,
      path: '/merchant/surplus-food',
      requiresFeature: 'enable_surplus_food',
    },


  ];

  if (loading) {
    return (
      <div className="merchant-dashboard">
        <div className="loading-container">
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="merchant-dashboard">
      <header className="dashboard-header">
        <h1>歡迎，{user?.username || '店家老闆'}！</h1>
        <p>這裡是您的管理後台，請選擇一項功能開始。</p>
      </header>

      <div className="dashboard-stats-container">
        <div className="stats-card chart-card">
            <h3>庫存狀態概覽</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={inventoryStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            <Cell fill="#4caf50" />
                            <Cell fill="#f44336" />
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
        
        <div className="stats-card alert-card">
            <h3>⚠️ 庫存不足提醒 ({lowStockItems.length})</h3>
            {lowStockItems.length > 0 ? (
                <div className="low-stock-list">
                    {lowStockItems.slice(0, 5).map(item => (
                        <div key={item.id} className="low-stock-item">
                            <span className="item-name">{item.name}</span>
                            <span className="item-qty">剩餘: {item.quantity} {item.unit_display}</span>
                        </div>
                    ))}
                    {lowStockItems.length > 5 && <div className="more-items">還有 {lowStockItems.length - 5} 項...</div>}
                    <button className="restock-btn" onClick={() => navigate('/merchant/inventory')}>
                        前往補貨
                    </button>
                </div>
            ) : (
                <div className="all-good">
                    <p>目前庫存狀況良好！</p>
                </div>
            )}
        </div>
      </div>

      <main className="features-grid">
        {features.map((feature) => {
          // 檢查此功能是否需要特定的功能開關
          const isDisabled = feature.requiresFeature && !storeSettings[feature.requiresFeature];
          
          return (
            <FeatureCard
              key={feature.id}
              icon={feature.icon}
              name={feature.name}
              description={feature.description}
              path={feature.path}
              onClick={handleCardClick}
              isDisabled={isDisabled}
              disabledMessage={isDisabled ? '此功能已在餐廳設定中關閉' : ''}
            />
          );
        })}
      </main>
    </div>
  );
};

export default MerchantDashboard;