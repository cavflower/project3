import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getUserOrders } from '../../api/orderApi';
import { getOrderNotifications, markAllNotificationsAsRead, deleteNotification, deleteAllNotifications } from '../../api/orderApi';
import { FaTrash, FaTimes, FaSync } from 'react-icons/fa';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import './CustomerOrdersPage.css';

const CustomerOrdersPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'orders');
  const [currentPage, setCurrentPage] = useState(1);
  const [realtimeStatus, setRealtimeStatus] = useState('連線中...');

  const fetchData = useCallback(async () => {
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
  }, []);

  // 初始載入資料
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Firestore 即時監聽訂單狀態變更
  useEffect(() => {
    if (!user) return;

    // 監聽一般訂單 (orders collection)
    const ordersRef = collection(db, 'orders');
    const surplusOrdersRef = collection(db, 'surplus_orders');

    // 監聽 orders 集合中的變更
    const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const updatedOrder = change.doc.data();
          console.log('訂單狀態變更:', updatedOrder);

          // 更新本地訂單狀態
          setOrders(prevOrders =>
            prevOrders.map(order => {
              // 匹配訂單（用 order_number 或 pickup_number）
              if (order.order_number === updatedOrder.order_number ||
                order.pickup_number === updatedOrder.pickup_number) {
                return {
                  ...order,
                  status: updatedOrder.status,
                  status_display: getStatusDisplayText(updatedOrder.status)
                };
              }
              return order;
            })
          );

          // 重新獲取通知
          getOrderNotifications().then(res => setNotifications(res.data));
        }
      });
      setRealtimeStatus('即時更新中');
    }, (error) => {
      console.error('Firestore 監聽錯誤:', error);
      setRealtimeStatus('連線失敗');
    });

    // 監聽惜福品訂單
    const unsubscribeSurplus = onSnapshot(surplusOrdersRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const updatedOrder = change.doc.data();
          console.log('惜福品訂單狀態變更:', updatedOrder);

          // 更新本地惜福品訂單狀態
          setOrders(prevOrders =>
            prevOrders.map(order => {
              if (order.order_number === updatedOrder.order_number ||
                order.pickup_number === updatedOrder.pickup_number) {
                return {
                  ...order,
                  status: updatedOrder.status,
                  status_display: getStatusDisplayText(updatedOrder.status)
                };
              }
              return order;
            })
          );

          // 重新獲取通知
          getOrderNotifications().then(res => setNotifications(res.data));
        }
      });
    });

    return () => {
      unsubscribeOrders();
      unsubscribeSurplus();
    };
  }, [user]);

  // 狀態碼轉換為顯示文字
  const getStatusDisplayText = (status) => {
    const statusMap = {
      pending: '待處理',
      accepted: '已接受',
      confirmed: '已確認',
      preparing: '準備中',
      ready_for_pickup: '可取餐',
      ready: '可取餐',
      completed: '已完成',
      cancelled: '已取消',
      rejected: '已拒絕'
    };
    return statusMap[status] || status;
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      fetchData();
    } catch (error) {
      console.error('標記全部已讀失敗:', error);
    }
  };

  const handleDeleteNotification = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('刪除通知失敗:', error);
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (window.confirm('確定要刪除所有通知嗎？')) {
      try {
        await deleteAllNotifications();
        setNotifications([]);
      } catch (error) {
        console.error('刪除全部通知失敗:', error);
      }
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      confirmed: 'status-accepted',
      ready_for_pickup: 'status-ready',
      ready: 'status-ready',
      completed: 'status-completed',
      rejected: 'status-rejected',
      cancelled: 'status-rejected',
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
        <div className={`realtime-status ${realtimeStatus === '即時更新中' ? 'connected' : ''}`}>
          <span className="status-dot"></span>
          {realtimeStatus}
        </div>
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
            <>
              <div className="orders-list">
                {orders
                  .slice((currentPage - 1) * 9, currentPage * 9)
                  .map((order) => {
                    // 判斷是否為惜福品訂單（訂單號碼以 SFO 開頭）
                    const isSurplus = order.order_number?.startsWith('SFO') || order.order_type === 'surplus';
                    return (
                      <div key={order.id} className="order-card">
                        <div className="order-header">
                          <div className="order-info">
                            <h3>{order.store_name}</h3>
                            {/* 惜福品顯示取餐號碼，一般訂單顯示訂單號碼 */}
                            {isSurplus ? (
                              <span className="order-number pickup-number">訂單號碼: {order.pickup_number || 'N/A'}</span>
                            ) : (
                              <span className="order-number">訂單號碼: {order.order_number}</span>
                            )}
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
                          <div className="detail-row">
                            <span className="label">訂單時間:</span>
                            <span className="value">
                              {new Date(order.created_at).toLocaleString('zh-TW')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* 分頁 */}
              {orders.length > 9 && (
                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="page-btn"
                  >
                    上一頁
                  </button>
                  <span className="page-info">
                    第 {currentPage} 頁 / 共 {Math.ceil(orders.length / 9)} 頁
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(orders.length / 9), p + 1))}
                    disabled={currentPage >= Math.ceil(orders.length / 9)}
                    className="page-btn"
                  >
                    下一頁
                  </button>
                </div>
              )}
            </>
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
              <button onClick={handleDeleteAllNotifications} className="delete-all-btn">
                <FaTrash className="me-1" />
                刪除全部
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
                  <button
                    className="delete-notification-btn"
                    onClick={() => handleDeleteNotification(notification.id)}
                    title="刪除通知"
                  >
                    <FaTimes />
                  </button>
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
