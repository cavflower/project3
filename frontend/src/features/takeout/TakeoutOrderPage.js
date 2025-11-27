import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import { createTakeoutOrder, getTakeoutProducts } from '../../api/orderApi';
import { useAuth } from '../../store/AuthContext';
import './TakeoutOrderPage.css';

const initialCart = {
  items: [],
  notes: '',
  pickupAt: '',
  contact: { name: '', phone: '' },
};

const paymentOptions = ['cash', 'credit_card', 'line_pay']; 




function cartReducer(state, action) {
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
    case 'UPDATE_PICKUP':
      return { ...state, pickupAt: action.payload };
    case 'UPDATE_CONTACT':
      return { ...state, contact: { ...state.contact, ...action.payload } };
    default:
      return state;
  }
}

const pickupSlots = () => {
  const slots = [];
  const now = new Date();
  for (let i = 20; i <= 60; i += 10) {
    const slot = new Date(now.getTime() + i * 60000);
    slots.push(slot.toISOString());
  }
  return slots;
};


function TakeoutOrderPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const paymentOptions = [
  { value: 'cash', label: '現金' },
  { value: 'credit_card', label: '信用卡' },
  { value: 'line_pay', label: 'LINE Pay' },
    ];
const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0].value);
const [pickupNumber, setPickupNumber] = useState('');

  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cart, dispatch] = useReducer(cartReducer, {
    ...initialCart,
    contact: {
      name: user?.name || '',
      phone: user?.phone || '',
    },
    pickupAt: pickupSlots()[0] || '',
  });

  useEffect(() => {
    async function load() {
        try {
        setLoading(true);
        setError('');
        const response = await getStore(storeId);
        setStore(response.data);

        const productsRes = await getTakeoutProducts(storeId);
        setMenuItems(productsRes.data);
        } catch (err) {
        setError('載入資料失敗，請稍後再試');
        } finally {
        setLoading(false);
        }
        }
        load();
    }, [storeId]);


  useEffect(() => {
    dispatch({
      type: 'UPDATE_CONTACT',
      payload: { name: user?.name || '', phone: user?.phone || '' },
    });
  }, [user]);


  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart.items]
  );
  const slots = useMemo(pickupSlots, []);

  const handleSubmit = async () => {
    if (!cart.items.length) {
      alert('請先選擇餐點。');
      return;
    }
    if (!cart.contact.name || !cart.contact.phone) {
      alert('請填寫聯絡人姓名與電話。');
      return;
    }
    try {
      setSubmitting(true);
        const payload = {
        store: storeId,
        pickup_at: cart.pickupAt,
        customer_name: cart.contact.name,
        customer_phone: cart.contact.phone,
        notes: cart.notes,
        payment_method: paymentMethod,
        items: cart.items.map((item) => ({
            product: item.id,
            quantity: item.quantity,
        })),
        };

      const response = await createTakeoutOrder(payload);
      const pickupNo = response.data?.pickup_number;
      setPickupNumber(pickupNo || '');
      dispatch({ type: 'CLEAR_CART' });
      const paymentLabel = paymentOptions.find((o) => o.value === paymentMethod)?.label;
      alert(`付款方式：${paymentLabel}\n取餐號碼：${pickupNo || '待通知'}`);

      const orderId = response.data?.id || 'pending';
      navigate(`/confirmation/${orderId}`, {
        state: {
          pickupNumber: pickupNo || null,
          paymentMethod: paymentLabel || paymentMethod,
        },
      });
    } catch (err) {
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

  if (error) {
    return (
      <div className="takeout-page container py-5">
        <div className="alert alert-danger">{error}</div>
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
                {store?.opening_hours && (
                  <span>
                    <i className="bi bi-clock me-1" />
                    取餐時間請選擇下方時段
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
                <p className="text-muted">店家尚未提供文字菜單，請直接聯絡。</p>
              )}
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="d-flex justify-content-between align-items-center border-bottom py-3"
                >
                  <div>
                    <h5 className="mb-1">{item.name}</h5>
                    {item.description && (
                      <p className="text-muted mb-1">{item.description}</p>
                    )}
                    <strong>NT$ {item.price}</strong>
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
          <div className="card shadow-sm sticky-top takeout-card"  style={{ top: '90px' }}>
            <div className="card-header takeout-card-header" style={{ color: 'black' }}>
              <strong>外帶資訊</strong>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">取餐時間</label>
                <select
                  className="form-select"
                  value={cart.pickupAt}
                  onChange={(e) =>
                    dispatch({ type: 'UPDATE_PICKUP', payload: e.target.value })
                  }
                >
                  {slots.map((slot) => (
                    <option key={slot} value={slot}>
                      {new Date(slot).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label">取餐人姓名</label>
                <input
                  className="form-control"
                  value={cart.contact.name}
                  onChange={(e) =>
                    dispatch({ type: 'UPDATE_CONTACT', payload: { name: e.target.value } })
                  }
                />
              </div>

              <div className="mb-3">
                <label className="form-label">聯絡電話</label>
                <input
                  className="form-control"
                  value={cart.contact.phone}
                  onChange={(e) =>
                    dispatch({ type: 'UPDATE_CONTACT', payload: { phone: e.target.value } })
                  }
                />
              </div>
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
                <label className="form-label">備註</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={cart.notes}
                  onChange={(e) =>
                    dispatch({ type: 'UPDATE_NOTE', payload: e.target.value })
                  }
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
                      NT$ {item.price} × {item.quantity}
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
                <strong>NT$ {total}</strong>
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

export default TakeoutOrderPage;
