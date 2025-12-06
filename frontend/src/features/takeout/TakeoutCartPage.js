import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaTrash, FaPlus, FaMinus } from "react-icons/fa";
import { createTakeoutOrder } from "../../api/orderApi";
import { useAuth } from "../../store/AuthContext";
import "./TakeoutCartPage.css";

const paymentOptionsList = [
  { value: "cash", label: "現金" },
  { value: "credit_card", label: "信用卡" },
  { value: "line_pay", label: "LINE Pay" },
];

const formatPrice = (value) => Math.round(Number(value) || 0);

const pickupSlots = () => {
  const slots = [];
  const now = new Date();
  for (let i = 20; i <= 60; i += 10) {
    const slot = new Date(now.getTime() + i * 60000);
    slots.push(slot.toISOString());
  }
  return slots;
};

function TakeoutCartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { cart: initialCart, store, storeId } = location.state || {};
  
  // 使用本地狀態管理購物車
  const [cartItems, setCartItems] = useState(initialCart?.items || []);
  const [contactName, setContactName] = useState(initialCart?.contact?.name || user?.username || "");
  const [contactPhone, setContactPhone] = useState(initialCart?.contact?.phone || user?.phone_number || "");
  const [pickupAt, setPickupAt] = useState(initialCart?.pickupAt || pickupSlots()[0]);
  const [paymentMethod, setPaymentMethod] = useState(paymentOptionsList[0].value);
  const [useUtensils, setUseUtensils] = useState("no");
  const [notes, setNotes] = useState(initialCart?.notes || "");
  const [submitting, setSubmitting] = useState(false);

  const slots = useMemo(pickupSlots, []);
  const total = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0,
    [cartItems]
  );

  if (!initialCart || !store) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">購物車資料遺失，請返回重新選購。</div>
        <button className="btn btn-primary" onClick={() => navigate(-1)}>
          返回
        </button>
      </div>
    );
  }

  const handleQuantityChange = (itemId, change) => {
    setCartItems(prevItems => {
      if (change > 0) {
        return prevItems.map(item =>
          item.id === itemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return prevItems
          .map(item =>
            item.id === itemId
              ? { ...item, quantity: item.quantity - 1 }
              : item
          )
          .filter(item => item.quantity > 0);
      }
    });
  };

  const handleSubmit = async () => {
    if (!cartItems.length) {
      alert("購物車是空的。");
      return;
    }
    
    // 決定使用的聯絡資訊
    let finalName = contactName;
    let finalPhone = contactPhone;
    
    if (user) {
      // 已登入：使用使用者資料
      finalName = user.username || user.email || "會員";
      finalPhone = user.phone_number || "未提供";
    } else {
      // 未登入：必須填寫
      if (!contactName || !contactPhone) {
        alert("請填寫聯絡人姓名與電話。");
        return;
      }
    }
    
    try {
      setSubmitting(true);
      const payload = {
        store: storeId,
        service_channel: "takeout",
        pickup_at: pickupAt,
        customer_name: finalName,
        customer_phone: finalPhone,
        notes: notes,
        payment_method: paymentMethod,
        use_utensils: useUtensils === "yes",
        items: cartItems.map((item) => ({
          product: item.id,
          quantity: item.quantity,
        })),
      };

      const response = await createTakeoutOrder(payload);
      const orderId = String(response.data?.id || "pending");
      const pickupNo = response.data?.pickup_number;
      
      // 清空購物車
      setCartItems([]);
      
      const paymentLabel = paymentOptionsList.find((o) => o.value === paymentMethod)?.label;
      
      alert(`付款方式：${paymentLabel}\n取餐號碼：${pickupNo || "待通知"}`);

      navigate(`/confirmation/${orderId}`, {
        state: {
          pickupNumber: pickupNo || null,
          paymentMethod: paymentLabel || paymentMethod,
        },
      });
    } catch (err) {
      alert("送出失敗，請稍後再試。");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="takeout-cart-page container" style={{ marginTop: "70px", marginBottom: "40px" }}>
      <div className="row mb-4">
        <div className="col-12">
          <button 
            className="btn btn-link ps-0" 
            onClick={() => navigate(`/store/${storeId}/takeout`, { 
              state: { 
                cart: {
                  items: cartItems,
                  notes: notes,
                  pickupAt: pickupAt,
                  contact: { name: contactName, phone: contactPhone }
                }
              }
            })}
          >
            <FaArrowLeft className="me-2" />
            返回菜單
          </button>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="mb-1">{store?.name}</h2>
              <p className="text-muted mb-0">{store?.address}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          {/* 購物車商品列表 */}
          <div className="card shadow-sm mb-4">
            <div className="card-header cart-header">
              <strong>購物車</strong>
            </div>
            <div className="card-body">
              {cartItems.length === 0 ? (
                <p className="text-muted">購物車是空的。</p>
              ) : (
                <>
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="cart-item d-flex justify-content-between align-items-center border-bottom py-3"
                    >
                      <div className="flex-grow-1">
                        <h5 className="mb-1">{item.name}</h5>
                        <p className="text-muted mb-1">{item.description}</p>
                        <strong className="text-dark">NT$ {formatPrice(item.price)}</strong>
                      </div>
                      <div className="d-flex align-items-center gap-3">
                        <div className="quantity-controls d-flex align-items-center gap-2">
                          <button
                            className="btn rounded-circle quantity-btn"
                            onClick={() => handleQuantityChange(item.id, -1)}
                          >
                            <FaMinus />
                          </button>
                          <span className="quantity-display">
                            {item.quantity}
                          </span>
                          <button
                            className="btn rounded-circle quantity-btn"
                            onClick={() => handleQuantityChange(item.id, 1)}
                          >
                            <FaPlus />
                          </button>
                        </div>
                        <div className="text-end" style={{ minWidth: '80px' }}>
                          <strong className="text-dark">NT$ {formatPrice(item.price * item.quantity)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center">
                      <h4 className="mb-0">總計</h4>
                      <h4 className="mb-0 text-dark">NT$ {formatPrice(total)}</h4>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          {/* 聯絡資訊 - 只在未登入時顯示 */}
          {!user && (
            <div className="card shadow-sm mb-3">
              <div className="card-header cart-header">
                <strong>聯絡資訊</strong>
              </div>
              <div className="card-body">
              <div className="mb-3">
                <label className="form-label">姓名 *</label>
                <input
                  type="text"
                  className="form-control"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="請輸入姓名"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">電話 *</label>
                <input
                  type="tel"
                  className="form-control"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="請輸入電話號碼"
                />
              </div>
            </div>
          </div>
          )}

          {/* 取餐時間 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header cart-header">
              <strong>取餐時間</strong>
            </div>
            <div className="card-body">
              <select
                className="form-select"
                value={pickupAt}
                onChange={(e) => setPickupAt(e.target.value)}
              >
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {new Date(slot).toLocaleTimeString("zh-TW", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 付款方式 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header cart-header">
              <strong>付款方式</strong>
            </div>
            <div className="card-body">
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {paymentOptionsList.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 是否需要餐具 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header cart-header">
              <strong>是否需要餐具</strong>
            </div>
            <div className="card-body">
              <select
                className="form-select"
                value={useUtensils}
                onChange={(e) => setUseUtensils(e.target.value)}
              >
                <option value="no">不需要</option>
                <option value="yes">需要</option>
              </select>
            </div>
          </div>

          {/* 備註 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header cart-header">
              <strong>備註</strong>
            </div>
            <div className="card-body">
              <textarea
                className="form-control"
                rows="3"
                placeholder="如有特殊需求請在此說明..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* 送出按鈕 */}
          <button
            className="btn btn-primary w-100 py-3 fw-bold"
            onClick={handleSubmit}
            disabled={submitting || cartItems.length === 0}
          >
            {submitting 
              ? "送出中..." 
              : paymentMethod === "cash"
              ? `確認訂單 (NT$ ${formatPrice(total)})`
              : `前往付款 (NT$ ${formatPrice(total)})`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default TakeoutCartPage;
