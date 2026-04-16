import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import { useStore } from '../../store/StoreContext';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import styles from './SurplusFoodManagement.module.css';

const SurplusOrderList = () => {
  const { storeId: contextStoreId, loading: storeLoading } = useStore();
  const [storeId, setStoreId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [realtimeStatus, setRealtimeStatus] = useState('連線中...');
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    if (contextStoreId) {
      setStoreId(contextStoreId);
    }
  }, [contextStoreId]);

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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [pageSize, totalCount]);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!storeId) return;

    try {
      if (!silent) {
        setLoading(true);
      }

      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (channelFilter !== 'all') params.order_type = channelFilter;
      if (monthFilter !== 'all') params.month = monthFilter;
      params.page = page;
      params.page_size = pageSize;

      const data = await surplusFoodApi.getOrders(params);
      const nextOrders = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      const count = Number(data?.count ?? nextOrders.length ?? 0);

      setOrders(nextOrders);
      setTotalCount(count);
    } catch (error) {
      console.error('載入訂單失敗:', error);
      alert('載入訂單失敗');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [channelFilter, monthFilter, page, pageSize, statusFilter, storeId]);

  useEffect(() => {
    if (!storeLoading && !contextStoreId) {
      setRealtimeStatus('店家資料載入失敗');
    }
  }, [contextStoreId, storeLoading]);

  // 初始載入
  useEffect(() => {
    if (!storeId) return;
    loadOrders();
  }, [loadOrders, storeId]);

  // Firestore 即時監聽惜福品訂單
  useEffect(() => {
    if (!storeId) return undefined;

    let isInitialLoad = true;
    const surplusOrdersRef = collection(db, 'surplus_orders');
    const surplusOrdersQuery = query(surplusOrdersRef, where('store_id', '==', String(storeId)));

    const unsubscribe = onSnapshot(surplusOrdersQuery, (snapshot) => {
      if (isInitialLoad) {
        isInitialLoad = false;
        setRealtimeStatus('即時更新中');
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = setTimeout(() => {
            loadOrders({ silent: true });
          }, 250);
        } else if (change.type === 'modified') {
          const updatedOrder = change.doc.data();

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
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }
          refreshTimerRef.current = setTimeout(() => {
            loadOrders({ silent: true });
          }, 250);
        }
      });
    }, (error) => {
      console.error('Firestore 監聯錯誤:', error);
      setRealtimeStatus('連線失敗');
    });

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [loadOrders, storeId]);

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
    const statusMap = {
      'confirm': 'confirmed',
      'ready': 'ready',
      'complete': 'completed',
      'cancel': 'cancelled',
      'reject': 'rejected'
    };

    const newStatus = statusMap[action];

    // 樂觀更新
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
      loadOrders();
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('確定要從店家端清單移除此訂單嗎？顧客端仍會保留該筆歷史紀錄。')) {
      return;
    }

    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));

    try {
      await surplusFoodApi.deleteOrder(orderId);
      alert('訂單已從店家端清單移除');
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗');
      loadOrders();
    }
  };

  const statusFilters = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待處理' },
    { value: 'confirmed', label: '已接受' },
    { value: 'ready', label: '可取餐' },
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '已拒絕' },
  ];

  const channelFilters = [
    { value: 'all', label: '全部' },
    { value: 'dine_in', label: '內用' },
    { value: 'takeout', label: '外帶' },
  ];

  return (
    <div className={styles.tabContent}>
      <div className={styles.contentHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>惜福食品訂單</h2>
        <div className={realtimeStatus === '即時更新中' ? styles.realtimeStatusConnected : styles.realtimeStatus}>
          <span className={realtimeStatus === '即時更新中' ? styles.statusDotConnected : styles.statusDot}></span>
          {realtimeStatus}
        </div>
      </div>

      {/* 狀態篩選器 */}
      <div className={styles.filterSection} style={{ marginBottom: '20px' }}>
        {statusFilters.map(f => (
          <button
            key={f.value}
            className={statusFilter === f.value ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 內用/外帶篩選器 */}
      <div className={styles.filterSection} style={{ marginBottom: '20px' }}>
        {channelFilters.map(f => (
          <button
            key={f.value}
            className={channelFilter === f.value ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setChannelFilter(f.value)}
          >
            {f.label}
          </button>
        ))}

        {/* 月份篩選 */}
        <select
          className={styles.filterSelect}
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
        <div className={styles.loading}>載入中...</div>
      ) : (
        <>
          <div className={styles.ordersList}>
            {orders.length === 0 ? (
              <div className={styles.emptyState}>目前沒有訂單</div>
            ) : (
              orders.map(order => (
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
          {totalCount > pageSize && (
            <div className="d-flex justify-content-between align-items-center mt-3" style={{ padding: '0 10px' }}>
              <div className="text-muted">
                第 {page} / {totalPages} 頁（共 {totalCount} 筆）
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
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

  const getOrderType = () => {
    if (order.order_type === 'dine_in') return '內用';
    if (order.order_type === 'takeout') return '外帶';
    return order.order_type_display || '外帶';
  };

  const getPaymentMethodLabel = () => {
    if (order.payment_method_display) return order.payment_method_display;

    const map = {
      cash: '現金',
      credit_card: '信用卡',
      line_pay: 'LINE Pay',
      points: '點數兌換',
    };
    return map[order.payment_method] || order.payment_method || '未提供';
  };

  const getItemSpecificationText = (item) => {
    if (!Array.isArray(item.specifications) || item.specifications.length === 0) {
      return '';
    }

    return item.specifications
      .map((spec) => {
        if (typeof spec === 'string') return spec;
        if (!spec || typeof spec !== 'object') return '';

        const label = spec.label || spec.groupName || spec.group_name || '';
        const value = spec.value || spec.optionName || spec.option_name || spec.name || '';

        if (label && value) return `${label}: ${value}`;
        return value || label;
      })
      .filter(Boolean)
      .join('、');
  };

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
    <div className={styles.orderCard}>
      <div className={styles.orderBody}>
        <div className={styles.orderInfo}>
          <p><strong>取餐號碼：</strong>{order.pickup_number || '待生成'}</p>
          <p><strong>客戶：</strong>{order.customer_name}</p>
          <p><strong>電話：</strong>{order.customer_phone}</p>
          <p><strong>訂單類型：</strong>{getOrderType()}</p>
          {order.order_type === 'dine_in' && order.table_label && (
            <p><strong>桌號：</strong>{order.table_label}</p>
          )}
          <p><strong>訂單狀態：</strong>{statusLabels[order.status] || order.status_display}</p>
          <p><strong>付款方式：</strong>{getPaymentMethodLabel()}</p>
          <p><strong>訂單金額：</strong>NT$ {Math.round(Number(order.total_price || 0))}</p>
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
                  const itemName = item.surplus_food_title || item.snapshot_surplus_food_name || item.surplus_food_detail?.title || '已下架惜福品';
                  const specText = getItemSpecificationText(item);
                  return (
                    <li key={index}>
                      {itemName} × {item.quantity}
                      {itemPrice > 0 && <span style={{ color: '#666' }}> (NT$ {subtotal})</span>}
                      {specText && <div style={{ color: '#5b6f72', fontSize: '0.85rem' }}>規格：{specText}</div>}
                    </li>
                  );
                })
              ) : (
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
      <div className={styles.orderActions}>
        {order.status === 'pending' && (
          <>
            <button
              className={styles.btnSmSuccess}
              onClick={() => onUpdateStatus(order.id, 'confirm')}
            >
              確認訂單
            </button>
            <button
              className={styles.btnSmDanger}
              onClick={() => onUpdateStatus(order.id, 'reject')}
            >
              拒絕
            </button>
          </>
        )}
        {order.status === 'confirmed' && (
          <>
            <button
              className={styles.btnSmPrimary}
              onClick={() => onUpdateStatus(order.id, 'ready')}
            >
              可取餐
            </button>
            <button
              className={styles.btnSmDanger}
              onClick={() => onUpdateStatus(order.id, 'cancel')}
            >
              取消
            </button>
          </>
        )}
        {order.status === 'ready' && (
          <button
            className={styles.btnSmSuccess}
            onClick={() => onUpdateStatus(order.id, 'complete')}
          >
            完成訂單
          </button>
        )}
        {(order.status === 'completed' || order.status === 'cancelled' || order.status === 'rejected') && (
          <button
            className={styles.btnSmDanger}
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
