import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import FeatureCard from './components/FeatureCard';
import { getMyStore } from '../../api/storeApi';
import { getIngredients } from '../../api/inventoryApi';
import { getMerchantPendingOrders } from '../../api/orderApi';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
  const [lowStockItems, setLowStockItems] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [storeId, setStoreId] = useState(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // 初始載入資料
  useEffect(() => {
    const loadDashboardData = async () => {
      if (hasLoadedOnce) {
        setLoading(false);
        return;
      }

      try {
        const [storeResponse, ingredientsData, pendingOrdersResponse] = await Promise.all([
          getMyStore(),
          getIngredients(),
          getMerchantPendingOrders()
        ]);

        const store = storeResponse.data;
        setStoreId(store.id);
        setStoreSettings({
          enable_reservation: store.enable_reservation !== undefined ? store.enable_reservation : true,
          enable_loyalty: store.enable_loyalty !== undefined ? store.enable_loyalty : true,
          enable_surplus_food: store.enable_surplus_food !== undefined ? store.enable_surplus_food : true,
        });

        // Process inventory data
        const lowStock = ingredientsData.filter(i => i.is_low_stock);
        setLowStockItems(lowStock);

        // Process pending orders data
        if (pendingOrdersResponse?.data?.pending_orders) {
          setPendingOrders(pendingOrdersResponse.data.pending_orders);
        }

        setHasLoadedOnce(true);

      } catch (error) {

        // 404 錯誤表示商家尚未建立店家資料，這是正常情況
        if (error.response?.status === 404) {
          console.log('[Dashboard] Store not found - merchant needs to create store settings first');
          // 保持預設值（全部啟用）
        } else {
          console.error('[Dashboard] Error loading dashboard data:', error);
        }

      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoadedOnce]);

  // Firestore 即時監聽訂單變更（包含一般訂單和惜福品訂單）
  useEffect(() => {
    if (!storeId) return;

    let isInitialLoad = true;

    // 刷新待確認訂單
    const refreshPendingOrders = async () => {
      try {
        const pendingOrdersResponse = await getMerchantPendingOrders();
        if (pendingOrdersResponse?.data?.pending_orders) {
          setPendingOrders(pendingOrdersResponse.data.pending_orders);
        }
      } catch (error) {
        console.error('[Dashboard] Error refreshing pending orders:', error);
      }
    };

    // 監聽一般訂單（外帶、內用）
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, where('store_id', '==', storeId));

    const unsubscribeOrders = onSnapshot(ordersQuery, () => {
      if (isInitialLoad) return;
      refreshPendingOrders();
    }, (error) => {
      console.error('[Dashboard] Orders Firestore listener error:', error);
    });

    // 監聽惜福品訂單
    const surplusOrdersRef = collection(db, 'surplus_orders');
    const surplusQuery = query(surplusOrdersRef, where('store_id', '==', String(storeId)));

    const unsubscribeSurplus = onSnapshot(surplusQuery, () => {
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }
      refreshPendingOrders();
    }, (error) => {
      console.error('[Dashboard] Surplus orders Firestore listener error:', error);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeSurplus();
    };
  }, [storeId]);

  const handleCardClick = (path, isDisabled) => {
    if (isDisabled) {
      return; // 如果功能被禁用，不執行導航
    }
    navigate(path);
  };

  const getOrderTypeBadgeClass = (orderType) => {
    switch (orderType) {
      case 'takeout':
        return 'badge-takeout';
      case 'dine_in':
        return 'badge-dinein';
      case 'surplus':
        return 'badge-surplus';
      default:
        return '';
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
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
      id: 'reviews',
      name: '顧客回饋',
      description: '查看餐廳和食物評論並回覆顧客',
      icon: FaBullhorn,
      path: '/merchant/reviews',
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
          <h3>🔔 待確認訂單 ({pendingOrders.length})</h3>
          {pendingOrders.length > 0 ? (
            <div className="pending-orders-list">
              <div className="pending-orders-scroll">
                {pendingOrders.map((order, index) => (
                  <div key={`${order.order_type}-${order.id}-${index}`} className="pending-order-item">
                    <div className="order-info">
                      <span className={`order-type-badge ${getOrderTypeBadgeClass(order.order_type)}`}>
                        {order.order_type_display}
                      </span>
                      <span className="order-number">#{order.order_number}</span>
                      {order.table_label && <span className="table-label">桌號: {order.table_label}</span>}
                    </div>
                    <span className="order-time">{formatTime(order.created_at)}</span>
                  </div>
                ))}
              </div>
              <button className="view-orders-btn" onClick={() => navigate('/merchant/orders')}>
                前往訂單管理
              </button>
            </div>
          ) : (
            <div className="all-good">
              <p>目前沒有待確認訂單！</p>
            </div>
          )}
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
