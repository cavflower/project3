import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getUserOrders } from '../../api/orderApi';
import { getOrderNotifications, markAllNotificationsAsRead, deleteNotification, deleteAllNotifications } from '../../api/orderApi';
import { FaTrash, FaTimes, FaSync } from 'react-icons/fa';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import styles from './CustomerOrdersPage.module.css';

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
      pending: styles['status-pending'],
      accepted: styles['status-accepted'],
      confirmed: styles['status-accepted'],
      ready_for_pickup: styles['status-ready'],
      ready: styles['status-ready'],
      completed: styles['status-completed'],
      rejected: styles['status-rejected'],
      cancelled: styles['status-rejected'],
    };
    return statusMap[status] || '';
  };

  if (loading) {
    return (
      <div className={styles['customer-orders-page']}>
        <div className="loading-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">載入中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['customer-orders-page']}>
      <div className={styles['page-header']}>
        <h1>我的訂單與通知</h1>
        <div className={`${styles['realtime-status']} ${realtimeStatus === '即時更新中' ? styles.connected : ''}`}>
          <span className={styles['status-dot']}></span>
          {realtimeStatus}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles['tab-button']} ${activeTab === 'orders' ? styles.active : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          訂單紀錄 ({orders.length})
        </button>
        <button
          className={`${styles['tab-button']} ${activeTab === 'notifications' ? styles.active : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          通知中心 ({notifications.filter(n => !n.is_read).length})
        </button>
      </div>

      {activeTab === 'orders' && (
        <div className="orders-section">
          {orders.length > 0 ? (
            <>
              <div className={styles['orders-list']}>
                {orders
                  .slice((currentPage - 1) * 9, currentPage * 9)
                  .map((order) => {
                    // 判斷是否為惜福品訂單（訂單號碼以 SFO 開頭）
                    const isSurplus = order.order_number?.startsWith('SFO') || order.order_type === 'surplus';
                    return (
                      <div key={order.id} className={styles['order-card']}>
                        <div className={styles['order-header']}>
                          <div className={styles['order-info']}>
                            <h3>{order.store_name}</h3>
                            {/* 惜福品顯示取餐號碼，一般訂單顯示訂單號碼 */}
                            {isSurplus ? (
                              <span className={`${styles['order-number']} ${styles['pickup-number']}`}>訂單號碼: {order.pickup_number || 'N/A'}</span>
                            ) : (
                              <span className={styles['order-number']}>訂單號碼: {order.order_number}</span>
                            )}
                            <span className={styles['order-type-badge']}>{order.order_type_display}</span>
                          </div>
                          <div className={`${styles['status-badge']} ${getStatusBadgeClass(order.status)}`}>
                            {order.status_display}
                          </div>
                        </div>

                        <div className="order-details">
                          <div className={styles['detail-row']}>
                            <span className={styles.label}>顧客姓名:</span>
                            <span className={styles.value}>{order.customer_name}</span>
                          </div>
                          <div className={styles['detail-row']}>
                            <span className={styles.label}>聯絡電話:</span>
                            <span className={styles.value}>{order.customer_phone}</span>
                          </div>
                          <div className={styles['detail-row']}>
                            <span className={styles.label}>付款方式:</span>
                            <span className={styles.value}>{order.payment_method}</span>
                          </div>
                          {order.pickup_at && (
                            <div className={styles['detail-row']}>
                              <span className={styles.label}>取餐時間:</span>
                              <span className={styles.value}>
                                {new Date(order.pickup_at).toLocaleString('zh-TW')}
                              </span>
                            </div>
                          )}
                          {order.table_label && (
                            <div className={styles['detail-row']}>
                              <span className={styles.label}>桌號:</span>
                              <span className={styles.value}>{order.table_label}</span>
                            </div>
                          )}
                          <div className={styles['detail-row']}>
                            <span className={styles.label}>訂單時間:</span>
                            <span className={styles.value}>
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
                <div className={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={styles['page-btn']}
                  >
                    上一頁
                  </button>
                  <span className={styles['page-info']}>
                    第 {currentPage} 頁 / 共 {Math.ceil(orders.length / 9)} 頁
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(orders.length / 9), p + 1))}
                    disabled={currentPage >= Math.ceil(orders.length / 9)}
                    className={styles['page-btn']}
                  >
                    下一頁
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles['no-data']}>
              <p>尚無訂單紀錄</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="notifications-section">
          {notifications.length > 0 && (
            <div className={styles['notifications-header']}>
              <button onClick={handleMarkAllRead} className={styles['mark-all-read-btn']}>
                全部標記為已讀
              </button>
              <button onClick={handleDeleteAllNotifications} className={styles['delete-all-btn']}>
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
                  className={`${styles['notification-card']} ${!notification.is_read ? styles.unread : ''}`}
                >
                  <div className="notification-icon">
                    {!notification.is_read && <span className="unread-dot"></span>}
                  </div>
                  <div className={styles['notification-content']}>
                    <div className={styles['notification-type']}>
                      {notification.notification_type_display}
                    </div>
                    <div className={styles['notification-message']}>
                      {notification.message}
                    </div>
                    <div className={styles['notification-meta']}>
                      <span className={styles['order-number']}>訂單: {notification.order_number}</span>
                      <span className={styles['notification-time']}>
                        {new Date(notification.created_at).toLocaleString('zh-TW')}
                      </span>
                    </div>
                  </div>
                  <button
                    className={styles['delete-notification-btn']}
                    onClick={() => handleDeleteNotification(notification.id)}
                    title="刪除通知"
                  >
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles['no-data']}>
              <p>暫無通知</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerOrdersPage;
