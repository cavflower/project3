import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../../store/AuthContext';

const SurplusOrderList = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all'); // 'all', 'dine_in', 'takeout'
  const [monthFilter, setMonthFilter] = useState('all'); // 月份篩選
  const [realtimeStatus, setRealtimeStatus] = useState('連線中...');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // 產生月份選項（過去12個月）
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: '全部月份' }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }, []);

  // 計算篩選後的訂單
  const filteredOrders = useMemo(() => {
    if (monthFilter === 'all') return orders;
    return orders.filter(order => {
      if (!order.created_at) return false;
      const date = new Date(order.created_at);
      const orderMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return orderMonth === monthFilter;
    });
  }, [orders, monthFilter]);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (channelFilter !== 'all') params.order_type = channelFilter;
      const data = await surplusFoodApi.getOrders(params);
      setOrders(data);
    } catch (error) {
      console.error('載入訂單失敗:', error);
      alert('載入訂單失敗');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter]);

  // 初始載入
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Firestore 即時監聽惜福品訂單
  useEffect(() => {
    let isInitialLoad = true;
    let reloadTimeout = null;
    const surplusOrdersRef = collection(db, 'surplus_orders');

    const unsubscribe = onSnapshot(surplusOrdersRef, (snapshot) => {
      // 跳過初始載入的事件（避免重複載入）
      if (isInitialLoad) {
        isInitialLoad = false;
        setRealtimeStatus('即時更新中');
        return;
      }

      let needsReload = false;

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          console.log('新惜福品訂單:', change.doc.data());
          // 標記需要重新載入（用防抖避免多次呼叫）
          needsReload = true;
        } else if (change.type === 'modified') {
          const updatedOrder = change.doc.data();
          console.log('惜福品訂單更新:', updatedOrder);

          // 更新本地訂單狀態（不重新載入整個列表）
          setOrders(prevOrders =>
            prevOrders.map(order => {
              if (String(order.id) === change.doc.id ||
                order.order_number === updatedOrder.order_number ||
                order.pickup_number === updatedOrder.pickup_number) {
                return {
                  ...order,
                  status: updatedOrder.status,
                  status_display: getStatusLabel(updatedOrder.status)
                };
              }
              return order;
            })
          );
        } else if (change.type === 'removed') {
          const removedOrder = change.doc.data();
          console.log('惜福品訂單已刪除:', removedOrder);
          // 從本地列表移除（不重新載入整個列表）
          setOrders(prevOrders =>
            prevOrders.filter(order =>
              String(order.id) !== change.doc.id &&
              order.order_number !== removedOrder.order_number
            )
          );
        }
      });

      // 只有新增訂單時才重新載入，且使用防抖
      if (needsReload) {
        if (reloadTimeout) clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(async () => {
          try {
            const data = await surplusFoodApi.getOrders({});
            setOrders(data);
          } catch (error) {
            console.error('重新載入訂單失敗:', error);
          }
        }, 500); // 500ms 防抖
      }
    }, (error) => {
      console.error('Firestore 監聯錯誤:', error);
      setRealtimeStatus('連線失敗');
    });

    return () => {
      unsubscribe();
      if (reloadTimeout) clearTimeout(reloadTimeout);
    };
  }, []); // 不依賴任何外部變數

  const getStatusLabel = (status) => {
    const labels = {
      'pending': '待確認',
      'confirmed': '已確認',
      'ready': '可取餐',
      'completed': '已完成',
      'cancelled': '已取消',
      'rejected': '已拒絕'
    };
    return labels[status] || status;
  };

  const handleUpdateStatus = async (orderId, action) => {
    // 定義狀態映射
    const statusMap = {
      'confirm': 'confirmed',
      'ready': 'ready',
      'complete': 'completed',
      'cancel': 'cancelled',
      'reject': 'rejected'
    };

    const newStatus = statusMap[action];

    // 樂觀更新：先更新 UI
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId
          ? { ...order, status: newStatus, status_display: getStatusLabel(newStatus) }
          : order
      )
    );

    try {
      if (action === 'confirm') {
        await surplusFoodApi.confirmOrder(orderId);
      } else if (action === 'ready') {
        await surplusFoodApi.readyOrder(orderId);
      } else if (action === 'complete') {
        await surplusFoodApi.completeOrder(orderId);
      } else if (action === 'cancel') {
        await surplusFoodApi.cancelOrder(orderId);
      } else if (action === 'reject') {
        await surplusFoodApi.rejectOrder(orderId);
      }
    } catch (error) {
      console.error('更新失敗:', error);
      alert('更新失敗');
      // 如果失敗，重新載入正確的資料
      loadOrders();
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('確定要刪除此訂單嗎？')) {
      return;
    }

    // 樂觀更新：先從 UI 移除
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));

    try {
      await surplusFoodApi.deleteOrder(orderId);
      alert('訂單已成功刪除');
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗');
      // 如果失敗，重新載入正確的資料
      loadOrders();
    }
  };

  return (
    <div className="tab-content">
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>惜福食品訂單</h2>
        <div className={`realtime-status ${realtimeStatus === '即時更新中' ? 'connected' : ''}`}>
          <span className="status-dot"></span>
          {realtimeStatus}
        </div>
      </div>

      {/* 狀態篩選器 */}
      <div className="filter-section" style={{ marginBottom: '20px' }}>
        <button
          className={statusFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('all')}
        >
          全部
        </button>
        <button
          className={statusFilter === 'pending' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('pending')}
        >
          待處理
        </button>
        <button
          className={statusFilter === 'confirmed' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('confirmed')}
        >
          已接受
        </button>
        <button
          className={statusFilter === 'ready' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('ready')}
        >
          可取餐
        </button>
        <button
          className={statusFilter === 'completed' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('completed')}
        >
          已完成
        </button>
        <button
          className={statusFilter === 'cancelled' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('cancelled')}
        >
          已拒絕
        </button>
      </div>

      {/* 內用/外帶篩選器 */}
      <div className="filter-section" style={{ marginBottom: '20px' }}>
        <button
          className={channelFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setChannelFilter('all')}
        >
          全部
        </button>
        <button
          className={channelFilter === 'dine_in' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setChannelFilter('dine_in')}
        >
          內用
        </button>
        <button
          className={channelFilter === 'takeout' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setChannelFilter('takeout')}
        >
          外帶
        </button>

        {/* 月份篩選 */}
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto', marginLeft: '16px' }}
          value={monthFilter}
          onChange={(e) => {
            setMonthFilter(e.target.value);
            setPage(1);
          }}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">載入中...</div>
      ) : (
        <>
          <div className="orders-list">
            {filteredOrders.length === 0 ? (
              <div className="empty-state">目前沒有訂單</div>
            ) : (
              filteredOrders
                .slice((page - 1) * pageSize, page * pageSize)
                .map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onUpdateStatus={handleUpdateStatus}
                    onDeleteOrder={handleDeleteOrder}
                  />
                ))
            )}
          </div>
          {/* 分頁控制 */}
          {filteredOrders.length > pageSize && (
            <div className="d-flex justify-content-between align-items-center mt-3" style={{ padding: '0 10px' }}>
              <div className="text-muted">
                第 {page} / {Math.ceil(filteredOrders.length / pageSize)} 頁（共 {filteredOrders.length} 筆）
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一頁
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page >= Math.ceil(filteredOrders.length / pageSize)}
                  onClick={() => setPage((p) => Math.min(Math.ceil(filteredOrders.length / pageSize), p + 1))}
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const OrderCard = ({ order, onUpdateStatus, onDeleteOrder }) => {
  const statusLabels = {
    pending: '待處理',
    confirmed: '已接受',
    ready: '可取餐',
    completed: '已完成',
    cancelled: '已拒絕',
  };

  // 從 order_type 取得訂單類型
  const getOrderType = () => {
    if (order.order_type === 'dine_in') return '內用';
    if (order.order_type === 'takeout') return '外帶';
    return order.order_type_display || '外帶';
  };

  // 格式化取餐時間
  const formatPickupTime = (pickupTime) => {
    if (!pickupTime) return null;
    const date = new Date(pickupTime);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="order-card">
      <div className="order-body">
        <div className="order-info">
          <p><strong>取餐號碼：</strong>{order.pickup_number || '待生成'}</p>
          <p><strong>客戶：</strong>{order.customer_name}</p>
          <p><strong>電話：</strong>{order.customer_phone}</p>
          <p><strong>訂單類型：</strong>{getOrderType()}</p>
          {order.order_type === 'dine_in' && order.table_label && (
            <p><strong>桌號：</strong>{order.table_label}</p>
          )}
          <p><strong>訂單狀態：</strong>{statusLabels[order.status] || order.status_display}</p>
          <p><strong>付款方式：</strong>{order.payment_method_display}</p>
          <p><strong>備註：</strong>{order.notes || '—'}</p>
          <p><strong>餐具需求：</strong>{order.use_utensils ? '需要餐具' : '不需要餐具'}</p>
          {order.pickup_time && order.order_type === 'takeout' && (
            <p><strong>取餐時間：</strong>{formatPickupTime(order.pickup_time)}</p>
          )}
          <div className="mt-2">
            <strong>品項：</strong>
            <ul className="mb-0">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, index) => {
                  const itemPrice = item.unit_price || item.surplus_food_detail?.surplus_price || 0;
                  const subtotal = Math.round(itemPrice * item.quantity);
                  return (
                    <li key={index}>
                      {item.surplus_food_title || item.surplus_food_detail?.title} × {item.quantity}
                      {itemPrice > 0 && <span style={{ color: '#666' }}> (NT$ {subtotal})</span>}
                    </li>
                  );
                })
              ) : (
                // 向後兼容：舊格式單一品項
                order.surplus_food_detail && (
                  <li>
                    {order.surplus_food_detail.title} × {order.quantity || 1}
                    {order.surplus_food_detail.surplus_price && (
                      <span style={{ color: '#666' }}> (NT$ {Math.round(order.surplus_food_detail.surplus_price * (order.quantity || 1))})</span>
                    )}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="order-actions">
        {order.status === 'pending' && (
          <>
            <button
              className="surplus-btn-sm btn-success"
              onClick={() => onUpdateStatus(order.id, 'confirm')}
            >
              確認訂單
            </button>
            <button
              className="surplus-btn-sm btn-danger"
              onClick={() => onUpdateStatus(order.id, 'reject')}
            >
              拒絕
            </button>
          </>
        )}
        {order.status === 'confirmed' && (
          <>
            <button
              className="surplus-btn-sm surplus-btn-primary"
              onClick={() => onUpdateStatus(order.id, 'ready')}
            >
              可取餐
            </button>
            <button
              className="surplus-btn-sm btn-danger"
              onClick={() => onUpdateStatus(order.id, 'cancel')}
            >
              取消
            </button>
          </>
        )}
        {order.status === 'ready' && (
          <button
            className="surplus-btn-sm btn-success"
            onClick={() => onUpdateStatus(order.id, 'complete')}
          >
            完成訂單
          </button>
        )}
        {(order.status === 'completed' || order.status === 'cancelled' || order.status === 'rejected') && (
          <button
            className="surplus-btn-sm btn-danger"
            onClick={() => onDeleteOrder(order.id)}
          >
            刪除
          </button>
        )}
      </div>
    </div>
  );
};

export default SurplusOrderList;
