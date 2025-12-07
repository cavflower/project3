import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import api from '../../../api/api';
import { getMyStore } from '../../../api/storeApi';
import { db } from '../../../lib/firebase';
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
  const [selected, setSelected] = useState(null);
  const [productMap, setProductMap] = useState({});
  const [statusFilter, setStatusFilter] = useState('pending');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const storeRes = await getMyStore();
        const id = storeRes.data?.id;
        setStoreId(id);
        if (!id) {
          setError('無法取得店家資料');
          return;
        }
        // 避免觸發複合索引需求，僅 where 篩選，排序改在前端做
        const q = query(collection(db, 'orders'), where('store_id', '==', id));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            created_at: data.created_at?.toDate?.() || null,
          };
        });
        setOrders(items);
        // 取得商品名稱對照
        try {
          const productsRes = await api.get('/products/public/products/', {
            params: { store: id },
          });
          const map = {};
          (productsRes.data || []).forEach((p) => {
            map[p.id] = p.name || p.title || `商品${p.id}`;
          });
          setProductMap(map);
        } catch (prodErr) {
          console.error('load products error', prodErr);
        }
      } catch (err) {
        console.error('load orders error', err);
        const detail =
          err?.response?.data?.detail ||
          err?.message ||
          '載入訂單失敗，請確認 Firebase 設定與登入狀態';
        setError(detail);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleUpdateStatus = async (pickupNumber, status) => {
    try {
      setUpdating(true);
      await api.patch(`/orders/status/${pickupNumber}/`, { status });
      setOrders((prev) =>
        prev.map((o) =>
          o.pickup_number === pickupNumber || o.id === pickupNumber
            ? { ...o, status }
            : o
        )
      );
      if (selected && (selected.pickup_number === pickupNumber || selected.id === pickupNumber)) {
        setSelected({ ...selected, status });
      }
    } catch (err) {
      console.error('update status error', err);
      alert('更新狀態失敗');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (pickupNumber) => {
    if (!window.confirm('確定要永久刪除此訂單？此操作將從資料庫中完全移除訂單資料。')) return;
    try {
      setUpdating(true);
      await api.delete(`/orders/status/${pickupNumber}/`);
      setOrders((prev) =>
        prev.filter((o) => o.pickup_number !== pickupNumber && o.id !== pickupNumber)
      );
      if (selected && (selected.pickup_number === pickupNumber || selected.id === pickupNumber)) {
        setSelected(null);
      }
      alert('訂單已成功刪除');
    } catch (err) {
      console.error('delete order error', err);
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
    if (statusFilter === 'all') return sortedOrders;
    return sortedOrders.filter((o) => (o.status || 'pending') === statusFilter);
  }, [sortedOrders, statusFilter]);

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
      if (ecoTrue) return '內用：有環保餐具';
      if (ecoFalse) return '內用：無環保餐具';
      return '內用：未填';
    }
    // 外帶
    if (utTrue) return '外帶：需要餐具';
    if (utFalse) return '外帶：不需要餐具';
    return '外帶：未填';
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
            請確認已登入店家帳號、Firebase 設定正確且 Firestore 有 orders 集合（字段包含 store_id）。
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
            className={`btn btn-sm filter-btn ${
              statusFilter === opt.key ? 'filter-btn-active' : ''
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

      {sortedOrders.length === 0 ? (
        <div className="alert alert-secondary">目前沒有訂單</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>取餐號碼</th>
                <th>客戶</th>
                <th>聯絡電話</th>
                <th>訂單類型</th>
                <th>付款方式</th>
                <th>狀態</th>
                <th>建立時間</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.pickup_number || order.id}</strong></td>
                  <td>{order.customer_name}</td>
                  <td>{order.customer_phone}</td>
                  <td>
                    <span className={`badge ${order.channel === 'takeout' ? 'bg-warning' : 'bg-info'}`}>
                      {order.channel === 'takeout' ? '外帶' : '內用'}
                    </span>
                  </td>
                  <td>{order.payment_method}</td>
                  {(() => {
                    const status = order.status || 'pending';
                    return (
                    <td>
                      <span className={`badge status-${status}`}>
                        {statusLabels[status] || status}
                      </span>
                    </td>
                    );
                  })()}
                  <td>
                    {order.created_at
            ? order.created_at.toLocaleString()
            : '-'}
          </td>
                  <td>
                    {(() => {
                      const status = order.status || 'pending';
                      if (status === 'pending') {
                        return (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-success"
                              disabled={updating}
                              onClick={() => handleUpdateStatus(order.pickup_number || order.id, 'accepted')}
                            >
                              接受
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={updating}
                              onClick={() => handleUpdateStatus(order.pickup_number || order.id, 'rejected')}
                            >
                              拒絕
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setSelected(order)}
                            >
                              查看
                            </button>
                          </div>
                        );
                      } else if (status === 'accepted') {
                        return (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={updating}
                              onClick={() => handleUpdateStatus(order.pickup_number || order.id, 'ready_for_pickup')}
                            >
                              製作完成
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={updating}
                              onClick={() => handleUpdateStatus(order.pickup_number || order.id, 'rejected')}
                            >
                              取消
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setSelected(order)}
                            >
                              查看
                            </button>
                          </div>
                        );
                      } else if (status === 'ready_for_pickup') {
                        return (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-success"
                              disabled={updating}
                              onClick={() => handleUpdateStatus(order.pickup_number || order.id, 'completed')}
                            >
                              完成訂單
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setSelected(order)}
                            >
                              查看
                            </button>
                          </div>
                        );
                      } else if (status === 'completed' || status === 'rejected') {
                        return (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setSelected(order)}
                            >
                              查看
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              disabled={updating}
                              onClick={() => handleDelete(order.pickup_number || order.id)}
                            >
                              刪除
                            </button>
                          </div>
                        );
                      }
                      return (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setSelected(order)}
                        >
                          查看
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      )}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">訂單詳情</h5>
              <button className="btn-close" onClick={() => setSelected(null)} />
            </div>
            <div className="modal-body">
              <p><strong>取餐號碼：</strong>{selected.pickup_number || selected.id}</p>
              <p><strong>客戶：</strong>{selected.customer_name}</p>
              <p><strong>電話：</strong>{selected.customer_phone}</p>
              <p><strong>付款方式：</strong>{selected.payment_method}</p>
              <p><strong>備註：</strong>{selected.notes || '—'}</p>
              <p>
                <strong>餐具需求：</strong>
                {formatUtensils(selected)}
              </p>
              {selected.table_label && <p><strong>桌號：</strong>{selected.table_label}</p>}
              {Array.isArray(selected.items) && selected.items.length > 0 && (
                <div className="mt-2">
                  <strong>品項：</strong>
                  <ul className="mb-0">
                    {selected.items.map((it, idx) => (
                      <li key={idx}>
                        {productMap[it.product_id || it.product] ||
                          `商品ID: ${it.product_id || it.product}`}{' '}
                        × {it.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer d-flex justify-content-end gap-2">
              {(() => {
                const status = selected.status || 'pending';
                if (status === 'pending') {
                  return (
                    <>
                      <button
                        className="btn btn-success"
                        disabled={updating}
                        onClick={() => handleUpdateStatus(selected.pickup_number || selected.id, 'accepted')}
                      >
                        接受
                      </button>
                      <button
                        className="btn btn-outline-danger"
                        disabled={updating}
                        onClick={() => handleUpdateStatus(selected.pickup_number || selected.id, 'rejected')}
                      >
                        拒絕
                      </button>
                    </>
                  );
                } else if (status === 'accepted') {
                  return (
                    <>
                      <button
                        className="btn btn-primary"
                        disabled={updating}
                        onClick={() => handleUpdateStatus(selected.pickup_number || selected.id, 'ready_for_pickup')}
                      >
                        製作完成
                      </button>
                      <button
                        className="btn btn-outline-danger"
                        disabled={updating}
                        onClick={() => handleUpdateStatus(selected.pickup_number || selected.id, 'rejected')}
                      >
                        取消
                      </button>
                    </>
                  );
                } else if (status === 'ready_for_pickup') {
                  return (
                    <button
                      className="btn btn-success"
                      disabled={updating}
                      onClick={() => handleUpdateStatus(selected.pickup_number || selected.id, 'completed')}
                    >
                      完成訂單
                    </button>
                  );
                } else if (status === 'completed' || status === 'rejected') {
                  return (
                    <button
                      className="btn btn-outline-danger"
                      disabled={updating}
                      onClick={() => handleDelete(selected.pickup_number || selected.id)}
                    >
                      刪除
                    </button>
                  );
                }
                return null;
              })()}
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>關閉</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderManagementPage;
