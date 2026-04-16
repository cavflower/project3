import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../api/api';
import { useStore } from '../../../store/StoreContext';
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

const paymentMethodLabels = {
  cash: '現金',
  credit_card: '信用卡',
  line_pay: 'LINE Pay',
  points: '點數兌換',
};

const normalizePaymentMethodLabel = (paymentMethod, paymentMethodDisplay) => {
  if (paymentMethodDisplay) return paymentMethodDisplay;
  return paymentMethodLabels[paymentMethod] || paymentMethod || '未提供';
};

const buildSpecificationText = (rawSpecifications) => {
  if (!Array.isArray(rawSpecifications) || rawSpecifications.length === 0) {
    return '';
  }

  return rawSpecifications
    .map((spec) => {
      if (typeof spec === 'string') return spec;
      if (!spec || typeof spec !== 'object') return '';

      const groupName = spec.groupName || spec.group_name || spec.label || '';
      const optionName = spec.optionName || spec.option_name || spec.value || spec.name || '';
      const adjustment = Number(spec.priceAdjustment ?? spec.price_adjustment ?? spec.adjustment ?? 0);
      const adjustmentText = Number.isFinite(adjustment) && adjustment !== 0
        ? ` (${adjustment > 0 ? '+' : ''}${Math.round(adjustment)})`
        : '';

      if (groupName && optionName) return `${groupName}: ${optionName}${adjustmentText}`;
      if (optionName) return `${optionName}${adjustmentText}`;
      if (groupName) return groupName;
      return '';
    })
    .filter(Boolean)
    .join('、');
};

function OrderManagementPage() {
  const { storeId: contextStoreId, loading: storeLoading } = useStore();
  const [storeId, setStoreId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    if (contextStoreId) {
      setStoreId(contextStoreId);
    }
  }, [contextStoreId]);

  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: '全部月份' }];
    const now = new Date();
    for (let i = 0; i < 12; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      options.push({ value, label });
    }
    return options;
  }, []);

  const normalizeOrdersResponse = useCallback((payload) => {
    if (Array.isArray(payload)) {
      return {
        results: payload,
        total_count: payload.length,
        total_pages: Math.max(1, Math.ceil(payload.length / pageSize)),
      };
    }

    return {
      results: Array.isArray(payload?.results) ? payload.results : [],
      total_count: Number(payload?.total_count || 0),
      total_pages: Number(payload?.total_pages || 1),
    };
  }, []);

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!storeId) return;

    try {
      if (!silent) {
        setLoading(true);
      }

      const params = {
        store_id: storeId,
        paginated: 1,
        page,
        page_size: pageSize,
      };

      if (statusFilter !== 'all') params.status = statusFilter;
      if (channelFilter !== 'all') params.channel = channelFilter;
      if (monthFilter !== 'all') params.month = monthFilter;

      const ordersRes = await api.get('/orders/list/', { params });
      const normalized = normalizeOrdersResponse(ordersRes.data);

      const items = normalized.results.map((data) => ({
        ...data,
        created_at: data.created_at ? new Date(data.created_at) : null,
        pickup_at: data.pickup_at ? new Date(data.pickup_at) : null,
      }));

      setOrders(items);
      setTotalCount(normalized.total_count);
      setTotalPages(Math.max(1, normalized.total_pages));
    } catch (err) {
      console.error('load orders error', err);
      const detail = err?.response?.data?.detail || err?.message || '載入訂單失敗，請確認登入狀態';
      setError(detail);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [channelFilter, monthFilter, normalizeOrdersResponse, page, statusFilter, storeId]);

  useEffect(() => {
    if (storeLoading) return;
    if (!contextStoreId) {
      setError('無法取得店家資料，請先到「餐廳設定」建立你的店家資訊。');
      setLoading(false);
    }
  }, [contextStoreId, storeLoading]);

  useEffect(() => {
    if (!storeId) return;
    loadOrders();
  }, [loadOrders, storeId]);

  useEffect(() => {
    if (!storeId) return undefined;

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('store_id', '==', storeId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
            setOrders((prevOrders) =>
              prevOrders.map((order) => {
                if (
                  String(order.id) === change.doc.id ||
                  order.pickup_number === updatedOrder.pickup_number ||
                  order.order_number === updatedOrder.order_number
                ) {
                  return {
                    ...order,
                    status: updatedOrder.status,
                  };
                }
                return order;
              })
            );
          } else if (change.type === 'removed') {
            const removedOrder = change.doc.data();
            setOrders((prevOrders) =>
              prevOrders.filter(
                (order) =>
                  String(order.id) !== change.doc.id &&
                  order.pickup_number !== removedOrder.pickup_number
              )
            );
          }
        });
      },
      (snapshotError) => {
        console.error('Firestore 監聽錯誤:', snapshotError);
      }
    );

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [loadOrders, storeId]);

  const handleUpdateStatus = async (pickupNumber, status) => {
    const oldOrders = [...orders];

    setOrders((prev) =>
      prev.map((o) =>
        o.pickup_number === pickupNumber || o.id === pickupNumber ? { ...o, status } : o
      )
    );

    try {
      setUpdating(true);
      await api.patch(`/orders/status/${pickupNumber}/`, { status });
    } catch (err) {
      console.error('update status error', err);
      setOrders(oldOrders);
      window.alert('更新狀態失敗');
    } finally {
      setUpdating(false);
      loadOrders({ silent: true });
    }
  };

  const handleDelete = async (pickupNumber) => {
    if (!window.confirm('確定要從店家端清單移除此訂單？顧客端仍會保留該筆歷史紀錄。')) return;

    const oldOrders = [...orders];

    setOrders((prev) => prev.filter((o) => o.pickup_number !== pickupNumber && o.id !== pickupNumber));

    try {
      setUpdating(true);
      await api.delete(`/orders/status/${pickupNumber}/`);
      window.alert('訂單已從店家端清單移除');
    } catch (err) {
      console.error('delete order error', err);
      setOrders(oldOrders);
      const errorMsg = err.response?.data?.detail || '刪除訂單失敗';
      window.alert(errorMsg);
    } finally {
      setUpdating(false);
      loadOrders({ silent: true });
    }
  };

  const currentPage = Math.min(page, totalPages);

  const formatUtensils = (order) => {
    const eco = order.use_eco_tableware;
    const utensils = order.use_utensils;
    const ecoTrue = eco === true || eco === 'true' || eco === 'yes';
    const ecoFalse = eco === false || eco === 'false' || eco === 'no';
    const utTrue = utensils === true || utensils === 'true' || utensils === 'yes';
    const utFalse = utensils === false || utensils === 'false' || utensils === 'no';

    if (order.service_channel === 'dine_in') {
      if (ecoTrue) return '使用環保餐具';
      if (ecoFalse) return '不使用環保餐具';
      return '未填寫';
    }

    if (utTrue) return '需要餐具';
    if (utFalse) return '不需要餐具';
    return '未填寫';
  };

  if (loading) {
    return (
      <div className={`${styles.orderPage} container text-center py-5`}>
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.orderPage} container py-5`}>
        <div className="alert alert-danger">
          {error}
          <div className="small text-muted mt-2">請確認已登入店家帳號並有權限存取訂單資料。</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.orderPage} container py-4`}>
      <div className="d-flex justify-content-between align-items-center mb-3">
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

      {orders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📭</div>
          <p>目前沒有訂單</p>
        </div>
      ) : (
        <div className={styles.ordersList}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              formatUtensils={formatUtensils}
              statusLabels={statusLabels}
              updating={updating}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <div className={styles.pagination}>
        <div className={styles.pageInfo}>第 {currentPage} / {totalPages} 頁（共 {totalCount} 筆）</div>
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
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一頁
          </button>
        </div>
      </div>
    </div>
  );
}

const OrderCard = ({ order, formatUtensils, statusLabels, updating, onUpdateStatus, onDelete }) => {
  const status = order.status || 'pending';
  const orderType = order.channel === 'takeout' ? '外帶訂單' : '內用訂單';
  const items = Array.isArray(order.items) ? order.items : [];
  const orderTotal = Number.isFinite(Number(order.total_amount))
    ? Number(order.total_amount)
    : items.reduce((sum, item) => {
      const itemSubtotal = Number(item.subtotal);
      if (Number.isFinite(itemSubtotal)) return sum + itemSubtotal;

      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unit_price);
      if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
        return sum + (quantity * unitPrice);
      }
      return sum;
    }, 0);

  const getStatusBadgeClass = () => {
    if (status === 'accepted') return styles.badgeStatusAccepted;
    if (status === 'ready_for_pickup') return styles.badgeStatusReady;
    if (status === 'completed') return styles.badgeStatusCompleted;
    return styles.badgeStatus;
  };

  const formatPickupTime = (pickupAt) => {
    if (!pickupAt) return null;
    const date = pickupAt instanceof Date ? pickupAt : new Date(pickupAt);
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className={styles.orderCard}>
      <div className={styles.cardHeader}>
        <div className={styles.orderNumber}>#{order.pickup_number || order.id}</div>
        <div className={styles.badgeGroup}>
          <span className={`${styles.badge} ${styles.badgeChannel}`}>
            {order.channel === 'takeout' ? '外帶' : '內用'}
          </span>
          <span className={`${styles.badge} ${getStatusBadgeClass()}`}>{statusLabels[status] || status}</span>
        </div>
        {order.table_label && <span className={`${styles.badge} ${styles.badgeChannel}`}>桌 {order.table_label}</span>}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.infoGroup}>
          <div className={styles.infoLabel}>客戶</div>
          <div className={styles.infoValue}>{order.customer_name || '未提供'}</div>
        </div>
        <div className={styles.infoGroup}>
          <div className={styles.infoLabel}>電話</div>
          <div className={styles.infoValue}>{order.customer_phone || '未提供'}</div>
        </div>
        <div className={styles.infoGroup}>
          <div className={styles.infoLabel}>類型</div>
          <div className={styles.infoValue}>{orderType}</div>
        </div>
        <div className={styles.infoGroup}>
          <div className={styles.infoLabel}>付款方式</div>
          <div className={styles.infoValue}>{normalizePaymentMethodLabel(order.payment_method, order.payment_method_display)}</div>
        </div>
        <div className={styles.infoGroup}>
          <div className={styles.infoLabel}>訂單金額</div>
          <div className={styles.infoValue}>NT$ {Math.round(orderTotal)}</div>
        </div>
        <div className={styles.infoGroup}>
          <div className={styles.infoLabel}>餐具需求</div>
          <div className={styles.infoValue}>{formatUtensils(order)}</div>
        </div>
        <div className={styles.infoGroup}>
          <div className={styles.infoLabel}>備註</div>
          <div className={styles.infoValue}>{order.notes || '—'}</div>
        </div>

        {order.channel === 'takeout' && order.pickup_at && (
          <div className={styles.infoGroup}>
            <div className={styles.infoLabel}>取餐時間</div>
            <div className={styles.infoValue}>{formatPickupTime(order.pickup_at)}</div>
          </div>
        )}

        {items.length > 0 && (
          <div className={styles.itemsList}>
            <div className={styles.itemsLabel}>品項</div>
            <div className={styles.itemsContent}>
              {items.map((it, idx) => {
                const itemName =
                  it.product_name || `商品ID: ${it.product_id || it.product}`;
                const isRedemption = it.is_redemption || itemName.startsWith('【兌換】');
                const qty = it.quantity || 1;
                const specificationText = buildSpecificationText(it.specifications || []);
                const itemSubtotal = Number.isFinite(Number(it.subtotal))
                  ? Number(it.subtotal)
                  : (Number.isFinite(Number(it.unit_price)) ? Number(it.unit_price) * qty : null);

                return (
                  <div key={`${itemName}-${idx}`} className={styles.itemTag}>
                    <span className={styles.itemMain}>
                      {isRedemption ? '兌換 ' : ''}
                      {itemName} x{qty}
                      {itemSubtotal !== null && (
                        <span className={styles.itemAmount}>NT$ {Math.round(itemSubtotal)}</span>
                      )}
                    </span>
                    {specificationText && (
                      <span className={styles.itemSpec}>規格：{specificationText}</span>
                    )}
                  </div>
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
              className={`${styles.actionBtn} ${styles.btnAccept}`}
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'accepted')}
            >
              接受
            </button>
            <button
              className={`${styles.actionBtn} ${styles.btnReject}`}
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
              className={`${styles.actionBtn} ${styles.btnReady}`}
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'ready_for_pickup')}
            >
              可取餐
            </button>
            <button
              className={`${styles.actionBtn} ${styles.btnReject}`}
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'rejected')}
            >
              取消
            </button>
          </>
        )}

        {status === 'ready_for_pickup' && (
          <button
            className={`${styles.actionBtn} ${styles.btnComplete}`}
            disabled={updating}
            onClick={() => onUpdateStatus(order.pickup_number || order.id, 'completed')}
          >
            完成訂單
          </button>
        )}

        {(status === 'completed' || status === 'rejected') && (
          <button
            className={`${styles.actionBtn} ${styles.btnDelete}`}
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
