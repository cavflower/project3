import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../../api/api';
import { getMyStore } from '../../../api/storeApi';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import './OrderManagementPage.css';

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
  const [page, setPage] = useState(1);
  const pageSize = 8;

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

  // Firestore 即時監聽訂單狀態更新
  useEffect(() => {
    if (!storeId) return;

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('store_id', '==', storeId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
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
      console.error('Firestore 監聽錯誤:', error);
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

    return filtered;
  }, [sortedOrders, statusFilter, channelFilter]);

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
    <div className="order-page container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">訂單管理</h2>
          <p className="text-muted mb-0">店家 ID：{storeId}</p>
        </div>
      </div>

      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
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
            className={`btn btn-sm filter-btn ${statusFilter === opt.key ? 'filter-btn-active' : ''
              }`}
            onClick={() => {
              setStatusFilter(opt.key);
              setPage(1);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        {[
          { key: 'all', label: '全部' },
          { key: 'dine_in', label: '內用' },
          { key: 'takeout', label: '外帶' },
        ].map((opt) => (
          <button
            key={opt.key}
            className={`btn btn-sm filter-btn ${channelFilter === opt.key ? 'filter-btn-active' : ''
              }`}
            onClick={() => {
              setChannelFilter(opt.key);
              setPage(1);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {sortedOrders.length === 0 ? (
        <div className="alert alert-secondary">目前沒有訂單</div>
      ) : (
        <div className="orders-list">
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
      )}

      {/* 分頁控制 */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="text-muted">
          第 {currentPage} / {totalPages} 頁（共 {filteredOrders.length} 筆）
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一頁
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一頁
          </button>
        </div>
      </div>
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

  return (
    <div className="order-card">
      <div className="order-body">
        <div className="order-info">
          <p><strong>取餐號碼：</strong>{order.pickup_number || order.id}</p>
          <p><strong>客戶：</strong>{order.customer_name}</p>
          <p><strong>電話：</strong>{order.customer_phone}</p>
          <p><strong>類型：</strong>{orderType}</p>
          {order.channel === 'takeout' && order.pickup_at && (
            <p><strong>取餐時間：</strong>{formatPickupTime(order.pickup_at)}</p>
          )}
          <p><strong>訂單狀態：</strong>{statusLabels[status] || status}</p>
          <p><strong>付款方式：</strong>{order.payment_method}</p>
          <p><strong>備註：</strong>{order.notes || '—'}</p>
          <p><strong>餐具需求：</strong>{formatUtensils(order)}</p>
          {order.table_label && <p><strong>桌號：</strong>{order.table_label}</p>}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="mt-2">
              <strong>品項：</strong>
              <ul className="mb-0">
                {order.items.map((it, idx) => (
                  <li key={idx}>
                    {productMap[it.product_id || it.product] ||
                      `商品ID: ${it.product_id || it.product}`}{' '}
                    × {it.quantity}
                    {it.unit_price && (
                      <span className="text-muted ms-1">
                        (NT$ {Math.round(it.unit_price)})
                      </span>
                    )}
                    {/* 顯示規格 - 按類別分組 */}
                    {it.specifications && it.specifications.length > 0 && (
                      <div className="ms-3 small text-secondary">
                        {/* 按 groupName 分組 */}
                        {Object.entries(
                          it.specifications.reduce((groups, spec) => {
                            const group = spec.groupName || '其他';
                            if (!groups[group]) groups[group] = [];
                            groups[group].push(spec);
                            return groups;
                          }, {})
                        ).map(([groupName, specs], groupIdx) => (
                          <span key={groupIdx} className="me-2">
                            {groupName}: {specs.map((spec, specIdx) => (
                              <span key={specIdx}>
                                {specIdx > 0 && '、'}
                                {spec.optionName}
                                {spec.priceAdjustment !== 0 && (
                                  <span className={spec.priceAdjustment > 0 ? 'text-danger' : 'text-success'}>
                                    {spec.priceAdjustment > 0 ? ` +$${spec.priceAdjustment}` : ` -$${Math.abs(spec.priceAdjustment)}`}
                                  </span>
                                )}
                              </span>
                            ))}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="order-actions">
        {status === 'pending' && (
          <>
            <button
              className="surplus-btn-sm btn-success btn-accept"
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'accepted')}
            >
              接受
            </button>
            <button
              className="surplus-btn-sm btn-danger"
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
              className="surplus-btn-sm surplus-btn-primary btn-accept"
              disabled={updating}
              onClick={() => onUpdateStatus(
                order.pickup_number || order.id,
                'ready_for_pickup'
              )}
            >
              可取餐
            </button>
            <button
              className="surplus-btn-sm btn-danger"
              disabled={updating}
              onClick={() => onUpdateStatus(order.pickup_number || order.id, 'rejected')}
            >
              取消
            </button>
          </>
        )}
        {status === 'ready_for_pickup' && (
          <button
            className="surplus-btn-sm btn-success"
            disabled={updating}
            onClick={() => onUpdateStatus(order.pickup_number || order.id, 'completed')}
          >
            完成訂單
          </button>
        )}
        {(status === 'completed' || status === 'rejected') && (
          <button
            className="surplus-btn-sm btn-danger"
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
