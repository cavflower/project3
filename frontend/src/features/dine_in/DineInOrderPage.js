import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import { createDineInOrder, getDineInProducts } from '../../api/orderApi';
import '../takeout/TakeoutOrderPage.css';

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find((item) => item.id === action.payload.id);
      const items = existing
        ? state.items.map((item) =>
            item.id === action.payload.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...state.items, { ...action.payload, quantity: 1 }];
      return { ...state, items };
    }
    case 'DECREMENT_ITEM': {
      const items = state.items
        .map((item) =>
          item.id === action.payload ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0);
      return { ...state, items };
    }
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'UPDATE_NOTE':
      return { ...state, notes: action.payload };
    default:
      return state;
  }
};

const paymentOptions = [
  { value: 'cash', label: '現金' },
  { value: 'credit_card', label: '信用卡' },
  { value: 'line_pay', label: 'LINE Pay' },
];

const formatPrice = (value) => Math.round(Number(value) || 0);
const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  return `http://127.0.0.1:8000${imagePath}`;
};

function DineInOrderPage() {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const tableLabel = searchParams.get('table') || '';

  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0].value);
  const [useEcoTableware, setUseEcoTableware] = useState('no');
  const [pickupNumber, setPickupNumber] = useState('');

  const [cart, dispatch] = useReducer(cartReducer, {
    items: [],
    notes: '',
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const response = await getStore(storeId);
        setStore(response.data);

        const productsRes = await getDineInProducts(storeId);
        const dineInMenu = (productsRes.data || []).filter(
          (item) => item.service_type === 'dine_in' || item.service_type === 'both'
        );
        setMenuItems(dineInMenu);
      } catch (err) {
        console.error(err);
        setError('載入資料失敗，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [storeId]);

  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart.items]
  );

  const handleSubmit = async () => {
    if (!cart.items.length) {
      alert('請先選擇餐點。');
      return;
    }
    try {
      setSubmitting(true);
      const notesWithTable = tableLabel
        ? `桌號：${tableLabel}${cart.notes ? ` / ${cart.notes}` : ''}`
        : cart.notes;
      const payload = {
        store: storeId,
        customer_name: tableLabel ? `桌號 ${tableLabel}` : '內用顧客',
        customer_phone: '0000000000',
        pickup_at: new Date().toISOString(),
        payment_method: paymentMethod,
        table_label: tableLabel,
        service_channel: 'dine_in',
        use_eco_tableware: useEcoTableware === 'yes',
        notes: notesWithTable,
        items: cart.items.map((item) => ({
          product: item.id,
          quantity: item.quantity,
        })),
      };
      const response = await createDineInOrder(payload);
      const pickupNo = response.data?.pickup_number;
      setPickupNumber(pickupNo || '');
      dispatch({ type: 'CLEAR_CART' });
      const paymentLabel =
        paymentOptions.find((o) => o.value === paymentMethod)?.label || paymentMethod;
      alert(
        `桌號：${tableLabel || '未提供'}\n付款方式：${paymentLabel}\n取單號碼：${
          pickupNo || '待通知'
        }\n環保餐具：${useEcoTableware === 'yes' ? '需要' : '不需要'}\n請等待服務人員確認。`
      );
      const orderId = response.data?.id || 'pending';
      navigate(`/confirmation/${orderId}`, {
        state: {
          pickupNumber: pickupNo || null,
          paymentMethod: paymentLabel,
        },
      });
    } catch (err) {
      console.error(err);
      alert('送出失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="takeout-page container py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">載入中...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="takeout-page container py-5">
        <div className="alert alert-danger">{error || '店家不可用。'}</div>
      </div>
    );
  }

  return (
    <div className="takeout-page container" style={{ marginTop: '70px' }}>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="mb-1">{store?.name}</h2>
              <p className="text-muted mb-2">{store?.address}</p>
              <div className="d-flex flex-wrap gap-3">
                <span>
                  <i className="bi bi-telephone me-1" />
                  {store?.phone}
                </span>
                {tableLabel && (
                  <span>
                    <i className="bi bi-geo-alt me-1" />
                    桌號：{tableLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card shadow-sm mb-4 takeout-card">
            <div className="card-header takeout-card-header">
              <strong>餐點列表</strong>
            </div>
            <div className="card-body">
              {menuItems.length === 0 && (
                <p className="text-muted">目前尚無餐點，請洽服務人員。</p>
              )}
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="d-flex justify-content-between align-items-center border-bottom py-3"
                >
                  <div className="d-flex align-items-center gap-3">
                    {item.image && (
                      <img
                        src={getImageUrl(item.image)}
                        alt={item.name}
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div>
                      <h5 className="mb-1">{item.name}</h5>
                      <p className="text-muted mb-1">{item.description}</p>
                      <strong>NT$ {formatPrice(item.price)}</strong>
                    </div>
                  </div>
                  <button
                    className="btn btn-outline-primary"
                    onClick={() => dispatch({ type: 'ADD_ITEM', payload: item })}
                  >
                    加入
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card shadow-sm takeout-card">
            <div className="card-header takeout-card-header" style={{ color: 'black' }}>
              <strong>內用資訊</strong>
            </div>
            <div className="card-body">
              {tableLabel && (
                <div className="mb-3">
                  <label className="form-label">桌號</label>
                  <input className="form-control" value={tableLabel} readOnly />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">付款方式</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {paymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">是否自備環保餐具</label>
                <div className="switch-container">
                  <span>{useEcoTableware === 'yes' ? '有' : '沒有'}</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={useEcoTableware === 'yes'}
                      onChange={(e) => setUseEcoTableware(e.target.checked ? 'yes' : 'no')}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">備註</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={cart.notes}
                  onChange={(e) =>
                    dispatch({ type: 'UPDATE_NOTE', payload: e.target.value })
                  }
                  placeholder="特殊需求或過敏資訊"
                />
              </div>

              <hr />

              <h5 className="mb-3">購物車</h5>
              {cart.items.length === 0 && (
                <p className="text-muted">尚未選擇餐點。</p>
              )}
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="d-flex justify-content-between align-items-center mb-2"
                >
                  <div>
                    <strong>{item.name}</strong>
                    <p className="mb-0 small text-muted">
                      NT$ {formatPrice(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <div className="btn-group">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => dispatch({ type: 'DECREMENT_ITEM', payload: item.id })}
                    >
                      -
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => dispatch({ type: 'ADD_ITEM', payload: item })}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <div className="d-flex justify-content-between align-items-center mt-3">
                <span>小計</span>
                <strong>NT$ {formatPrice(total)}</strong>
              </div>

              <button
                className="btn btn-success w-100 mt-4"
                onClick={handleSubmit}
                disabled={submitting || cart.items.length === 0}
              >
                {submitting ? '送出中...' : '送出訂單'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DineInOrderPage;
