import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../api/api';
import { createMerchantCounterOrder, getDineInProducts, getTakeoutProducts } from '../../../api/orderApi';
import { getDineInLayout } from '../../../api/storeApi';
import { useStore } from '../../../store/StoreContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getPublicSpecificationGroups } from '../../../api/productApi';
import ProductSpecificationModal from '../../../components/common/ProductSpecificationModal';
import SkeletonLoader from '../../../components/common/SkeletonLoader';
import { normalizeDineInLayout } from '../../../utils/dineInLayout';
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

const calculateOrderTotal = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (Number.isFinite(Number(order?.total_amount))) {
    return Number(order.total_amount);
  }

  return items.reduce((sum, item) => {
    const itemSubtotal = Number(item.subtotal);
    if (Number.isFinite(itemSubtotal)) return sum + itemSubtotal;

    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unit_price);
    if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
      return sum + (quantity * unitPrice);
    }
    return sum;
  }, 0);
};

const formatCurrency = (value) => `NT$ ${Math.round(Number(value) || 0)}`;

const isCashPayment = (order) => {
  const rawValue = `${order?.payment_method || ''} ${order?.payment_method_display || ''}`.toLowerCase();
  return rawValue.includes('cash') || rawValue.includes('現金') || rawValue.includes('?暸');
};

function OrderManagementPage() {
  const { store, storeId: contextStoreId, loading: storeLoading } = useStore();
  const [storeId, setStoreId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('today');
  const [page, setPage] = useState(1);
  const [cashCheckoutOrder, setCashCheckoutOrder] = useState(null);
  const [checkoutTargetStatus, setCheckoutTargetStatus] = useState('completed');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [printingDetails, setPrintingDetails] = useState(false);
  const [counterOrderOpen, setCounterOrderOpen] = useState(false);
  const pageSize = 9;
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    if (contextStoreId) {
      setStoreId(contextStoreId);
    }
  }, [contextStoreId]);

  const monthOptions = useMemo(() => {
    const options = [
      { value: 'all', label: '全部月份' },
      { value: 'today', label: '今日' },
    ];
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
      if (monthFilter === 'today') {
        params.date = 'today';
      } else if (monthFilter !== 'all') {
        params.month = monthFilter;
      }

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
    let success = false;

    setOrders((prev) =>
      prev.map((o) =>
        o.pickup_number === pickupNumber || o.id === pickupNumber ? { ...o, status } : o
      )
    );

    try {
      setUpdating(true);
      await api.patch(`/orders/status/${pickupNumber}/`, { status });
      success = true;
      if (status === 'accepted') {
        window.alert('廚房已收到訂單');
      }
    } catch (err) {
      console.error('update status error', err);
      setOrders(oldOrders);
      window.alert('更新狀態失敗');
    } finally {
      setUpdating(false);
      loadOrders({ silent: true });
    }

    return success;
  };

  const openCheckout = (order, targetStatus) => {
    setCashCheckoutOrder(order);
    setCheckoutTargetStatus(targetStatus);
    setReceivedAmount('');
  };

  const handleAcceptOrder = (order) => {
    if (order?.channel === 'dine_in') {
      openCheckout(order, 'accepted');
      return;
    }

    handleUpdateStatus(order.pickup_number || order.id, 'accepted');
  };

  const handleCompleteOrder = (order) => {
    if (order?.channel === 'takeout') {
      openCheckout(order, 'completed');
      return;
    }

    handleUpdateStatus(order.pickup_number || order.id, 'completed');
  };

  const handleCloseCashCheckout = () => {
    if (updating || printingDetails) return;
    setCashCheckoutOrder(null);
    setReceivedAmount('');
  };

  const handlePrintDetails = () => {
    setPrintingDetails(true);

    setTimeout(() => {
      setPrintingDetails(false);
      window.alert('列印完成');
    }, 2000);
  };

  const handleCashCheckout = async () => {
    if (!cashCheckoutOrder) return;

    const success = await handleUpdateStatus(
      cashCheckoutOrder.pickup_number || cashCheckoutOrder.id,
      checkoutTargetStatus
    );

    if (success) {
      setCashCheckoutOrder(null);
      setReceivedAmount('');
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
    return <SkeletonLoader variant="list" rows={8} />;
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
        <button
          type="button"
          className={styles.counterOrderBtn}
          onClick={() => setCounterOrderOpen(true)}
          disabled={!storeId}
        >
          現場點餐
        </button>
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
              onAcceptOrder={handleAcceptOrder}
              onCompleteOrder={handleCompleteOrder}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {counterOrderOpen && (
        <CounterOrderModal
          storeId={storeId}
          store={store}
          onClose={() => setCounterOrderOpen(false)}
          onCreated={() => {
            setCounterOrderOpen(false);
            setPage(1);
            loadOrders({ silent: true });
          }}
        />
      )}

      {cashCheckoutOrder && (
        <CashCheckoutModal
          order={cashCheckoutOrder}
          receivedAmount={receivedAmount}
          onReceivedAmountChange={setReceivedAmount}
          onClose={handleCloseCashCheckout}
          onPrintDetails={handlePrintDetails}
          onCheckout={handleCashCheckout}
          printing={printingDetails}
          updating={updating}
          targetStatus={checkoutTargetStatus}
        />
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

const counterPaymentOptions = [
  { value: 'cash', label: '現金' },
  { value: 'credit_card', label: '信用卡' },
  { value: 'line_pay', label: 'LINE Pay' },
];

const getCounterItemKey = (item) => {
  const specKey = item.specKey || (item.selectedSpecs || [])
    .map((spec) => `${spec.groupName}:${spec.optionName}`)
    .join('|');
  return specKey ? `${item.id}_${specKey}` : String(item.id);
};

const CounterOrderModal = ({ storeId, store, onClose, onCreated }) => {
  const [orderType, setOrderType] = useState('');
  const [step, setStep] = useState('type');
  const [floors, setFloors] = useState([]);
  const [activeFloorId, setActiveFloorId] = useState('');
  const [selectedTables, setSelectedTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSpecGroups, setProductSpecGroups] = useState({});

  const activeFloor = useMemo(
    () => floors.find((floor) => floor.id === activeFloorId) || floors[0] || null,
    [floors, activeFloorId]
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.orderPrice || item.price || 0) * Number(item.quantity || 1), 0),
    [cart]
  );

  const loadTables = useCallback(async () => {
    if (!storeId) return;
    const layoutData = store?.dine_in_layout || (await getDineInLayout(storeId)).data;
    const normalized = normalizeDineInLayout(layoutData);
    const usableFloors = normalized.floors.map((floor) => ({
      ...floor,
      tables: (floor.tables || []).filter((table) => String(table.label || '').trim()),
    }));
    setFloors(usableFloors);
    setActiveFloorId(normalized.activeFloorId || usableFloors[0]?.id || '');
  }, [store, storeId]);

  const loadMenu = useCallback(async (nextType) => {
    if (!storeId) return;
    setLoadingMenu(true);
    try {
      const response = nextType === 'takeout'
        ? await getTakeoutProducts(storeId)
        : await getDineInProducts(storeId);
      setMenuItems(response.data || []);
    } catch (error) {
      console.error('counter menu load error', error);
      window.alert('載入菜單失敗，請稍後再試');
    } finally {
      setLoadingMenu(false);
    }
  }, [storeId]);

  const handleSelectType = async (nextType) => {
    setOrderType(nextType);
    setCart([]);
    setSelectedTables([]);
    await loadMenu(nextType);
    if (nextType === 'dine_in') {
      await loadTables();
      setStep('table');
    } else {
      setStep('menu');
    }
  };

  const toggleTable = (label) => {
    setSelectedTables((prev) => (
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    ));
  };

  const addToCart = (product) => {
    const orderPrice = Number(product.finalPrice ?? product.price ?? 0);
    const item = {
      ...product,
      orderPrice,
      selectedSpecs: product.selectedSpecs || [],
      cartKey: getCounterItemKey(product),
    };
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.cartKey === item.cartKey);
      if (existing) {
        return prev.map((cartItem) => (
          cartItem.cartKey === item.cartKey
            ? { ...cartItem, quantity: Number(cartItem.quantity || 1) + 1 }
            : cartItem
        ));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const decrementCartItem = (cartKey) => {
    setCart((prev) => prev
      .map((item) => (
        item.cartKey === cartKey
          ? { ...item, quantity: Number(item.quantity || 1) - 1 }
          : item
      ))
      .filter((item) => Number(item.quantity || 0) > 0));
  };

  const handleProductClick = async (product) => {
    if (product.is_orderable === false || product.is_sold_out_by_ingredients) return;

    try {
      const cachedSpecs = productSpecGroups[product.id];
      const specs = Array.isArray(cachedSpecs)
        ? cachedSpecs
        : (await getPublicSpecificationGroups(product.id)).data || [];
      setProductSpecGroups((prev) => ({ ...prev, [product.id]: specs }));

      if (specs.length > 0 && specs.some((group) => group.options && group.options.length > 0)) {
        setSelectedProduct(product);
        return;
      }
    } catch (error) {
      console.error('counter specs load error', error);
    }

    addToCart(product);
  };

  const handleSpecConfirm = (productWithSpecs) => {
    addToCart(productWithSpecs);
    setSelectedProduct(null);
  };

  const handleSubmit = async () => {
    if (!cart.length) {
      window.alert('請至少選擇一個餐點');
      return;
    }
    if (orderType === 'dine_in' && selectedTables.length === 0) {
      window.alert('內用單請先選擇桌位');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        order_type: orderType,
        payment_method: paymentMethod,
        notes,
        customer_name: '現場客人',
        customer_phone: '0000000000',
        table_labels: orderType === 'dine_in' ? selectedTables : undefined,
        items: cart.map((item) => ({
          product: item.id,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.orderPrice || item.price || 0),
          specifications: item.selectedSpecs || [],
        })),
      };

      const response = await createMerchantCounterOrder(payload);
      window.alert(`已建立現場訂單：#${response.data?.order_number || response.data?.pickup_number || ''}`);
      onCreated();
    } catch (error) {
      console.error('counter order create error', error);
      const detail = error.response?.data?.detail || JSON.stringify(error.response?.data || {}) || '建立訂單失敗';
      window.alert(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.counterModal}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>現場點餐</h2>
            <p className={styles.modalSubtitle}>
              {orderType === 'dine_in' ? '內用單' : orderType === 'takeout' ? '外帶單' : '請選擇訂單類型'}
            </p>
          </div>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} disabled={submitting}>
            x
          </button>
        </div>

        {step === 'type' && (
          <div className={styles.counterTypeGrid}>
            <button type="button" onClick={() => handleSelectType('dine_in')}>
              <strong>內用單</strong>
              <span>先選擇桌位，再開始點餐</span>
            </button>
            <button type="button" onClick={() => handleSelectType('takeout')}>
              <strong>外帶單</strong>
              <span>直接進入菜單點餐</span>
            </button>
          </div>
        )}

        {step === 'table' && (
          <div className={styles.counterSection}>
            <div className={styles.counterStepHeader}>
              <strong>選擇桌位</strong>
              <span>可複選：{selectedTables.length ? selectedTables.join(', ') : '尚未選擇'}</span>
            </div>
            <div className={styles.counterFloorTabs}>
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  className={activeFloor?.id === floor.id ? styles.counterFloorActive : styles.counterFloor}
                  onClick={() => setActiveFloorId(floor.id)}
                >
                  {floor.name}
                </button>
              ))}
            </div>
            <div className={styles.counterTableGrid}>
              {(activeFloor?.tables || []).map((table) => {
                const label = String(table.label || '').trim();
                const selected = selectedTables.includes(label);
                return (
                  <button
                    key={table.id || label}
                    type="button"
                    className={selected ? styles.counterTableActive : styles.counterTable}
                    onClick={() => toggleTable(label)}
                  >
                    <strong>{label}</strong>
                    <span>{table.seats || 0} 人</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.counterFooterActions}>
              <button type="button" className={styles.paginBtn} onClick={() => setStep('type')}>
                上一步
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.btnAccept}`}
                onClick={() => setStep('menu')}
                disabled={selectedTables.length === 0}
              >
                開始點餐
              </button>
            </div>
          </div>
        )}

        {step === 'menu' && (
          <div className={styles.counterMenuLayout}>
            <div className={styles.counterMenuList}>
              <div className={styles.counterStepHeader}>
                <strong>菜單</strong>
                <span>{loadingMenu ? '載入中...' : `${menuItems.length} 項餐點`}</span>
              </div>
              {menuItems.map((product) => {
                const disabled = product.is_orderable === false || product.is_sold_out_by_ingredients;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={styles.counterProductRow}
                    onClick={() => handleProductClick(product)}
                    disabled={disabled}
                  >
                    <span>
                      <strong>{product.name}</strong>
                      {product.description && <small>{product.description}</small>}
                    </span>
                    <b>NT$ {Math.round(Number(product.price || 0))}</b>
                  </button>
                );
              })}
            </div>

            <aside className={styles.counterCartPanel}>
              <div className={styles.counterStepHeader}>
                <strong>訂單內容</strong>
                <span>NT$ {Math.round(cartTotal)}</span>
              </div>
              {orderType === 'dine_in' && (
                <div className={styles.counterTableSummary}>桌位：{selectedTables.join(', ')}</div>
              )}
              <div className={styles.counterCartItems}>
                {cart.length === 0 ? (
                  <p className={styles.counterEmptyText}>尚未選擇餐點</p>
                ) : cart.map((item) => (
                  <div key={item.cartKey} className={styles.counterCartItem}>
                    <div>
                      <strong>{item.name}</strong>
                      {(item.selectedSpecs || []).length > 0 && (
                        <small>
                          {item.selectedSpecs.map((spec) => `${spec.groupName}: ${spec.optionName}`).join('、')}
                        </small>
                      )}
                      <span>NT$ {Math.round(Number(item.orderPrice || 0))}</span>
                    </div>
                    <div className={styles.counterQtyControl}>
                      <button type="button" onClick={() => decrementCartItem(item.cartKey)}>-</button>
                      <b>{item.quantity}</b>
                      <button type="button" onClick={() => addToCart(item)}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              <label className={styles.counterField}>
                <span>付款方式</span>
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  {counterPaymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.counterField}>
                <span>備註</span>
                <textarea
                  rows="3"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="例如：少冰、餐具、客人特殊需求"
                />
              </label>

              <div className={styles.counterFooterActions}>
                <button
                  type="button"
                  className={styles.paginBtn}
                  onClick={() => setStep(orderType === 'dine_in' ? 'table' : 'type')}
                  disabled={submitting}
                >
                  上一步
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.btnComplete}`}
                  onClick={handleSubmit}
                  disabled={submitting || cart.length === 0}
                >
                  {submitting ? '建立中...' : '建立訂單'}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductSpecificationModal
          product={selectedProduct}
          initialSpecGroups={productSpecGroups[selectedProduct.id]}
          onConfirm={handleSpecConfirm}
          onCancel={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
};

const OrderCard = ({ order, formatUtensils, statusLabels, updating, onUpdateStatus, onAcceptOrder, onCompleteOrder, onDelete }) => {
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
              onClick={() => onAcceptOrder(order)}
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
            onClick={() => onCompleteOrder(order)}
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

const CashCheckoutModal = ({
  order,
  receivedAmount,
  onReceivedAmountChange,
  onClose,
  onPrintDetails,
  onCheckout,
  printing,
  updating,
  targetStatus,
}) => {
  const total = calculateOrderTotal(order);
  const received = Number(receivedAmount);
  const isCash = isCashPayment(order);
  const hasEnoughCash = !isCash || (Number.isFinite(received) && received >= total);
  const change = isCash && hasEnoughCash ? received - total : 0;
  const items = Array.isArray(order.items) ? order.items : [];
  const orderTypeText = order.channel === 'dine_in' ? '內用訂單' : '外帶訂單';
  const paymentText = normalizePaymentMethodLabel(order.payment_method, order.payment_method_display);

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.checkoutModal}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{targetStatus === 'accepted' ? '接受訂單結帳' : '完成訂單結帳'}</h2>
            <p className={styles.modalSubtitle}>訂單 #{order.pickup_number || order.id}</p>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            disabled={updating || printing}
            aria-label="關閉"
          >
            x
          </button>
        </div>

        <div className={styles.printArea}>
          <div className={styles.receiptHeader}>
            <strong>{orderTypeText}明細</strong>
            <span>#{order.pickup_number || order.id}</span>
          </div>

          <div className={styles.receiptRows}>
            {items.map((item, index) => {
              const quantity = Number(item.quantity || 1);
              const subtotal = Number.isFinite(Number(item.subtotal))
                ? Number(item.subtotal)
                : Number(item.unit_price || 0) * quantity;

              return (
                <div key={`${item.product_name || item.product_id}-${index}`} className={styles.receiptRow}>
                  <span>{item.product_name || `商品 ${item.product_id || index + 1}`} x{quantity}</span>
                  <strong>{formatCurrency(subtotal)}</strong>
                </div>
              );
            })}
          </div>

          <div className={styles.checkoutSummary}>
            <div>
              <span>訂單總金額</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <div>
              <span>付款方式</span>
              <strong>{paymentText}</strong>
            </div>
          </div>
        </div>

        {isCash ? (
          <>
            <label className={styles.cashInputGroup}>
              <span>收款金額</span>
              <input
                type="number"
                min="0"
                step="1"
                value={receivedAmount}
                onChange={(event) => onReceivedAmountChange(event.target.value)}
                placeholder="請輸入客人支付金額"
                autoFocus
              />
            </label>

            <div className={styles.changePanel}>
              <span>應找金額</span>
              <strong>{hasEnoughCash ? formatCurrency(change) : '收款金額不足'}</strong>
            </div>
          </>
        ) : (
          <div className={styles.changePanel}>
            <span>結帳狀態</span>
            <strong>確認 {paymentText} 已完成</strong>
          </div>
        )}

        <div className={styles.modalActions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnReady}`}
            onClick={onPrintDetails}
            disabled={printing || updating}
          >
            {printing ? '列印中...' : '列印明細'}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.btnComplete}`}
            onClick={onCheckout}
            disabled={!hasEnoughCash || updating || printing}
          >
            {updating ? '結帳中...' : '結帳'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderManagementPage;
