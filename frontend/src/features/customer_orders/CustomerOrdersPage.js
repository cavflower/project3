import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserOrders } from '../../api/orderApi';
import { getOrderNotifications, markAllNotificationsAsRead } from '../../api/orderApi';
import './CustomerOrdersPage.css';

const CustomerOrdersPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersResponse, notificationsResponse] = await Promise.all([
        getUserOrders(),
        getOrderNotifications(),
      ]);
      setOrders(ordersResponse.data);
      setNotifications(notificationsResponse.data);
    } catch (error) {
      console.error('獲取資料失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      fetchData();
    } catch (error) {
      console.error('標記全部已讀失敗:', error);
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      ready_for_pickup: 'status-ready',
      completed: 'status-completed',
      rejected: 'status-rejected',
    };
    return statusMap[status] || 'status-default';
  };

  if (loading) {
    return (
      <div className="customer-orders-page">
        <div className="loading-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">載入中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-orders-page">
      <div className="page-header">
        <h1>我的訂單與通知</h1>
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          訂單紀錄 ({orders.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          通知中心 ({notifications.filter(n => !n.is_read).length})
        </button>
      </div>

      {activeTab === 'orders' && (
        <div className="orders-section">
          {orders.length > 0 ? (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <div className="order-info">
                      <h3>{order.store_name}</h3>
                      <span className="order-number">訂單號碼: {order.order_number}</span>
                      <span className="order-type-badge">{order.order_type_display}</span>
                    </div>
                    <div className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                      {order.status_display}
                    </div>
                  </div>
                  
                  <div className="order-details">
                    <div className="detail-row">
                      <span className="label">顧客姓名:</span>
                      <span className="value">{order.customer_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">聯絡電話:</span>
                      <span className="value">{order.customer_phone}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">付款方式:</span>
                      <span className="value">{order.payment_method}</span>
                    </div>
                    {order.pickup_at && (
                      <div className="detail-row">
                        <span className="label">取餐時間:</span>
                        <span className="value">
                          {new Date(order.pickup_at).toLocaleString('zh-TW')}
                        </span>
                      </div>
                    )}
                    {order.table_label && (
                      <div className="detail-row">
                        <span className="label">桌號:</span>
                        <span className="value">{order.table_label}</span>
                      </div>
                    )}
                    {order.notes && (
                      <div className="detail-row">
                        <span className="label">備註:</span>
                        <span className="value">{order.notes}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">訂單時間:</span>
                      <span className="value">
                        {new Date(order.created_at).toLocaleString('zh-TW')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">
              <p>尚無訂單紀錄</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="notifications-section">
          {notifications.length > 0 && (
            <div className="notifications-header">
              <button onClick={handleMarkAllRead} className="mark-all-read-btn">
                全部標記為已讀
              </button>
            </div>
          )}
          
          {notifications.length > 0 ? (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-card ${!notification.is_read ? 'unread' : ''}`}
                >
                  <div className="notification-icon">
                    {!notification.is_read && <span className="unread-dot"></span>}
                  </div>
                  <div className="notification-content">
                    <div className="notification-type">
                      {notification.notification_type_display}
                    </div>
                    <div className="notification-message">
                      {notification.message}
                    </div>
                    <div className="notification-meta">
                      <span className="order-number">訂單: {notification.order_number}</span>
                      <span className="notification-time">
                        {new Date(notification.created_at).toLocaleString('zh-TW')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">
              <p>暫無通知</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerOrdersPage;
