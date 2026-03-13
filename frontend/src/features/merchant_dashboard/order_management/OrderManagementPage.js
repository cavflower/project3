import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../../api/api';
import { getMyStore } from '../../../api/storeApi';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import styles from './OrderManagementPage.module.css';

const statusLabels = {
  pending: '待處理',
  accepted: '已接受',
  ready_for_pickup: '可取餐',
  completed: '已完成',
  rejected: '已拒絕',
};

function OrderManagementPage() {
  const [storeId, setStoreId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [productMap, setProductMap] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all'); // 'all', 'dine_in', 'takeout'
  const [monthFilter, setMonthFilter] = useState('all'); // 月份篩選
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

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');

        // 先獲取店家 ID
        const storeRes = await getMyStore();
        const id = storeRes.data?.id;
        setStoreId(id);

        if (!id) {
          setError('無法取得店家資料，請先到「餐廳設定」建立你的店家資訊。');
          setLoading(false);
          return;
        }

        // 並行載入訂單和商品資料
        const [ordersRes, productsRes] = await Promise.all([
          api.get('/orders/list/', { params: { store_id: id } }),
          api.get('/products/public/products/', { params: { store: id } })
        ]);

        // 處理訂單資料
        const items = (ordersRes.data || []).map((data) => ({
          ...data,
          created_at: data.created_at ? new Date(data.created_at) : null,
          pickup_at: data.pickup_at ? new Date(data.pickup_at) : null,
        }));

        setOrders(items);

        // 處理商品名稱對照
        const map = {};
        (productsRes.data || []).forEach((p) => {
          map[p.id] = p.name || p.title || `商品${p.id}`;
        });
        setProductMap(map);

      } catch (err) {
        console.error('load orders error', err);
        const detail =
          err?.response?.data?.detail ||
          err?.message ||
          '載入訂單失敗，請確認登入狀態';
        setError(detail);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Firestore 即時監聽訂單更新
  useEffect(() => {
    if (!storeId) return;

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('store_id', '==', storeId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          // 新訂單：從後端載入完整訂單資料
          const newOrderData = change.doc.data();
          const pickupNumber = newOrderData.pickup_number || newOrderData.order_number;

          // 檢查是否已存在（避免初始載入時重複）
          const alreadyExists = orders.some(
            order => order.pickup_number === pickupNumber || order.order_number === pickupNumber
          );

          if (!alreadyExists && pickupNumber) {
            // 載入完整訂單資料
            try {
              const response = await api.get('/orders/list/', { params: { store_id: storeId } });
              const newOrders = (response.data || []).map((data) => ({
                ...data,
                created_at: data.created_at ? new Date(data.created_at) : null,
                pickup_at: data.pickup_at ? new Date(data.pickup_at) : null,
              }));
              setOrders(newOrders);
            } catch (err) {
              console.error('載入新訂單失敗:', err);
            }
          }
        } else if (change.type === 'modified') {
          const updatedOrder = change.doc.data();
          // 即時更新本地訂單狀態
          setOrders(prevOrders =>
            prevOrders.map(order => {
              if (String(order.id) === change.doc.id ||
                order.pickup_number === updatedOrder.pickup_number ||
                order.order_number === updatedOrder.order_number) {
                return {
                  ...order,
                  status: updatedOrder.status
                };
              }
              return order;
            })
          );
        } else if (change.type === 'removed') {
          const removedOrder = change.doc.data();
          setOrders(prevOrders =>
            prevOrders.filter(order =>
              String(order.id) !== change.doc.id &&
              order.pickup_number !== removedOrder.pickup_number
            )
          );
        }
      });
    }, (error) => {
      console.error('Firestore 監聯錯誤:', error);
    });

    return () => unsubscribe();
  }, [storeId]);

  const handleUpdateStatus = async (pickupNumber, status) => {
    // 樂觀更新：先保存舊狀態
    const oldOrders = [...orders];

    // 立即更新 UI
    setOrders((prev) =>
      prev.map((o) =>
        o.pickup_number === pickupNumber || o.id === pickupNumber
          ? { ...o, status }
          : o
      )
    );

    try {
      setUpdating(true);
      // 背景發送請求
      await api.patch(`/orders/status/${pickupNumber}/`, { status });
    } catch (err) {
      console.error('update status error', err);
      // 失敗時回滾到舊狀態
      setOrders(oldOrders);
      alert('更新狀態失敗');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (pickupNumber) => {
    if (!window.confirm('確定要永久刪除此訂單？此操作將從資料庫中完全移除訂單資料。')) return;

    // 樂觀更新：先保存舊訂單清單
    const oldOrders = [...orders];

    // 立即從 UI 移除
    setOrders((prev) =>
      prev.filter((o) => o.pickup_number !== pickupNumber && o.id !== pickupNumber)
    );

    try {
      setUpdating(true);
      // 背景發送刪除請求
      await api.delete(`/orders/status/${pickupNumber}/`);
      alert('訂單已成功刪除');
    } catch (err) {
      console.error('delete order error', err);
      // 失敗時回滾
      setOrders(oldOrders);
      const errorMsg = err.response?.data?.detail || '刪除訂單失敗';
      alert(errorMsg);
    } finally {
      setUpdating(false);
    }
  };

  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const ta = a.created_at ? a.created_at.getTime() : 0;
        const tb = b.created_at ? b.created_at.getTime() : 0;
        return tb - ta;
      }),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    let filtered = sortedOrders;

    // 狀態篩選
    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) => (o.status || 'pending') === statusFilter);
    }

    // 內用/外帶篩選
    if (channelFilter !== 'all') {
      filtered = filtered.filter((o) => o.channel === channelFilter);
    }

    // 月份篩選
    if (monthFilter !== 'all') {
      filtered = filtered.filter((o) => {
        if (!o.created_at) return false;
        const orderMonth = `${o.created_at.getFullYear()}-${String(o.created_at.getMonth() + 1).padStart(2, '0')}`;
        return orderMonth === monthFilter;
      });
    }

    return filtered;
  }, [sortedOrders, statusFilter, channelFilter, monthFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const formatUtensils = (order) => {
    const eco = order.use_eco_tableware;
    const utensils = order.use_utensils;
    const ecoTrue = eco === true || eco === 'true' || eco === 'yes';
    const ecoFalse = eco === false || eco === 'false' || eco === 'no';
    const utTrue = utensils === true || utensils === 'true' || utensils === 'yes';
    const utFalse = utensils === false || utensils === 'false' || utensils === 'no';

    if (order.service_channel === 'dine_in') {
      // 內用訂單：use_eco_tableware 表示是否使用環保餐具
      if (ecoTrue) return '使用環保餐具';
      if (ecoFalse) return '不使用環保餐具';
      return '未填寫';
    }
    // 外帶訂單：use_utensils 表示是否需要餐具
    if (utTrue) return '需要餐具';
    if (utFalse) return '不需要餐具';
    return '未填寫';
  };

  if (loading) {
    return (
      <div className="order-page container text-center py-5">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-page container py-5">
        <div className="alert alert-danger">
          {error}
          <div className="small text-muted mt-2">
            請確認已登入店家帳號並有權限存取訂單資料。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.orderPage}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>訂單管理</h1>
          <p className={styles.pageSubtitle}>店家 ID：{storeId}</p>
        </div>
      </div>

      <div className={styles.filterBar}>
        {[
          { key: 'all', label: '全部' },
          { key: 'pending', label: '待處理' },
          { key: 'accepted', label: '已接受' },
          { key: 'ready_for_pickup', label: '可取餐' },
          { key: 'completed', label: '已完成' },
          { key: 'rejected', label: '已拒絕' },
        ].map((opt) => (
          <button
            key={opt.key}
            className={statusFilter === opt.key ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => {
              setStatusFilter(opt.key);
              setPage(1);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className={styles.filterBar}>
        {[
          { key: 'all', label: '全部' },
          { key: 'dine_in', label: '內用' },
          { key: 'takeout', label: '外帶' },
        ].map((opt) => (
          <button
            key={opt.key}
            className={channelFilter === opt.key ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => {
              setChannelFilter(opt.key);
              setPage(1);
            }}
          >
            {opt.label}
          </button>
        ))}
        <select
          className={styles.monthSelect}
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

      {sortedOrders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📭</div>
          <p>目前沒有訂單</p>
        </div>
      ) : (
        <>
          <div className={styles.ordersList}>
            {pagedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                productMap={productMap}
                formatUtensils={formatUtensils}
                statusLabels={statusLabels}
                updating={updating}
                onUpdateStatus={handleUpdateStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>

          <div className={styles.pagination}>
            <div className={styles.pageInfo}>
              第 {currentPage} / {totalPages} 頁（共 {filteredOrders.length} 筆）
            </div>
            <div className={styles.paginationBtns}>
              <button
                className={styles.paginBtn}
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一頁
              </button>
              <button
                className={styles.paginBtn}
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一頁
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const OrderCard = ({ order, productMap, formatUtensils, statusLabels, updating, onUpdateStatus, onDelete }) => {
  const status = order.status || 'pending';
  const orderType = order.channel === 'takeout' ? '外帶訂單' : '內用訂單';

  // 格式化取餐時間
  const formatPickupTime = (pickupAt) => {
    if (!pickupAt) return null;
    const date = pickupAt instanceof Date ? pickupAt : new Date(pickupAt);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusBadgeClass = () => {
    switch (status) {
      case 'pending':
        return styles.badgeStatus;
      case 'accepted':
        return styles.badgeStatusAccepted;
      case 'ready_for_pickup':
        return styles.badgeStatusReady;
      case 'completed':
        return styles.badgeStatusCompleted;
      case 'rejected':
        return styles.badgeStatus;
      default:
        return styles.badgeStatus;
    }
  };

  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <div className={styles.orderCard}>
      <div className={styles.cardHeader}>
        <div className={styles.orderNumber}>#{order.pickup_number || order.id}</div>
        <div className={styles.badgeGroup}>
          <span className={`${styles.badge} ${styles.badgeChannel}`}>
            {order.channel === 'takeout' ? '外帶' : '內用'}
          </span>
          <span className={`${styles.badge} ${getStatusBadgeClass()}`}>
            {statusLabels[status] || status}
          </span>
        </div>
        {order.table_label && (
          <span className={`${styles.badge} ${styles.badgeChannel}`}>
            桌 {order.table_label}
          </span>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>客戶</span>
          <span className={styles.infoValue}>{order.customer_name}</span>
        </div>
        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>電話</span>
          <span className={styles.infoValue}>{order.customer_phone || '—'}</span>
        </div>

        {order.channel === 'takeout' && order.pickup_at && (
          <div className={styles.infoGroup}>
            <span className={styles.infoLabel}>取餐時間</span>
            <span className={styles.infoValue}>{formatPickupTime(order.pickup_at)}</span>
          </div>
        )}

        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>付款方式</span>
          <span className={styles.infoValue}>{order.payment_method || '—'}</span>
        </div>

        {order.notes && (
          <div className={styles.infoGroup}>
            <span className={styles.infoLabel}>備註</span>
            <span className={styles.infoValue} style={{ fontSize: '0.9rem' }}>{order.notes}</span>
          </div>
        )}

        <div className={styles.infoGroup}>
          <span className={styles.infoLabel}>餐具</span>
          <span className={styles.infoValue}>{formatUtensils(order)}</span>
        </div>

        {items.length > 0 && (
          <div className={styles.itemsList}>
            <div className={styles.itemsLabel}>品項明細</div>
            <div className={styles.itemsContent}>
              {items.map((item, idx) => {
                const itemName = item.product_name ||
                  productMap[item.product_id || item.product] ||
                  `商品ID: ${item.product_id || item.product}`;
                return (
                  <span key={idx} className={styles.itemTag}>
                    {itemName} ×{item.quantity}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        {status === 'pending' && (
          <>
            <button
              className={styles.actionBtn + ' ' + styles.btnAccept}
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'accepted')}
            >
              接受
            </button>
            <button
              className={styles.actionBtn + ' ' + styles.btnReject}
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'rejected')}
            >
              拒絕
            </button>
          </>
        )}
        {status === 'accepted' && (
          <>
            <button
              className={styles.actionBtn + ' ' + styles.btnReady}
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'ready_for_pickup')}
            >
              可取餐
            </button>
            <button
              className={styles.actionBtn + ' ' + styles.btnReject}
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'rejected')}
            >
              取消
            </button>
          </>
        )}
        {status === 'ready_for_pickup' && (
          <button
            className={styles.actionBtn + ' ' + styles.btnComplete}
            disabled={updating}
            onClick={() => onUpdateStatus(order.pickup_number || order.id, 'completed')}
          >
            完成訂單
          </button>
        )}
        {(status === 'completed' || status === 'rejected') && (
          <button
            className={styles.actionBtn + ' ' + styles.btnDelete}
            disabled={updating}
            onClick={() => onDelete(order.pickup_number || order.id)}
          >
            刪除
          </button>
        )}
      </div>
    </div>
  );
};

export default OrderManagementPage;
