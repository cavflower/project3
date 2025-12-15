import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaTrash, FaPlus, FaMinus } from "react-icons/fa";
import { createTakeoutOrder } from "../../api/orderApi";
import api from "../../api/api";
import { useAuth } from "../../store/AuthContext";
import CreditCardSelector from "../checkout/CreditCardSelector";
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
  // 從現在開始加 20 分鐘為最快取餐時間
  const startTime = new Date(now.getTime() + 20 * 60000);
  
  // 每 5 分鐘一個選項，最多 10 項
  for (let i = 0; i < 10; i++) {
    const slot = new Date(startTime.getTime() + i * 5 * 60000);
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
  const [useUtensils, setUseUtensils] = useState("yes");
  const [notes, setNotes] = useState(initialCart?.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const slots = useMemo(pickupSlots, []);
  
  // 分離一般商品和惜福品
  const regularItems = useMemo(
    () => cartItems.filter(item => item.itemType === 'regular' || !item.itemType),
    [cartItems]
  );
  
  const surplusItems = useMemo(
    () => cartItems.filter(item => item.itemType === 'surplus'),
    [cartItems]
  );
  
  const regularTotal = useMemo(
    () => regularItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0,
    [regularItems]
  );
  
  const surplusTotal = useMemo(
    () => surplusItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0,
    [surplusItems]
  );
  
  const total = regularTotal + surplusTotal;

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
    
    // 如果選擇信用卡付款且已登入，先顯示卡片選擇器
    if (paymentMethod === 'credit_card' && user) {
      setShowCardSelector(true);
      return;
    }
    
    // 其他付款方式或未登入直接執行訂單
    await executeOrder(finalName, finalPhone);
  };
  
  const executeOrder = async (finalName, finalPhone) => {
    
    try {
      setSubmitting(true);
      const orderResults = [];
      
      // 1. 如果有一般商品，創建一般外帶訂單
      if (regularItems.length > 0) {
        const regularPayload = {
          store: storeId,
          service_channel: "takeout",
          pickup_at: pickupAt,
          customer_name: finalName,
          customer_phone: finalPhone,
          notes: notes,
          payment_method: paymentMethod,
          use_utensils: useUtensils === "yes",
          items: regularItems.map((item) => ({
            product: item.id,
            quantity: item.quantity,
          })),
        };

        const regularResponse = await createTakeoutOrder(regularPayload);
        orderResults.push({
          type: 'regular',
          orderId: regularResponse.data?.id,
          pickupNumber: regularResponse.data?.pickup_number
        });
      }
      
      // 2. 如果有惜福品，合併成一張訂單
      if (surplusItems.length > 0) {
        const surplusPayload = {
          items: surplusItems.map(item => ({
            surplus_food: item.id,
            quantity: item.quantity
          })),
          customer_name: finalName,
          customer_phone: finalPhone,
          pickup_at: pickupAt,
          payment_method: paymentMethod,
          order_type: 'takeout',
          use_utensils: useUtensils === "yes",
          notes: notes,
        };
        
        const surplusResponse = await api.post('/surplus/orders/', surplusPayload);
        orderResults.push({
          type: 'surplus',
          code: surplusResponse.data?.order_number,
          pickupNumber: surplusResponse.data?.pickup_number,
          orderId: surplusResponse.data?.id
        });
      }
      
      // 清空購物車
      setCartItems([]);
      
      const paymentLabel = paymentOptionsList.find((o) => o.value === paymentMethod)?.label;
      
      const regularOrder = orderResults.find(r => r.type === 'regular');
      const surplusOrder = orderResults.find(r => r.type === 'surplus');

      // 如果有一般訂單，導向確認頁；否則返回店家頁面
      if (regularOrder && regularOrder.orderId) {
        navigate(`/confirmation/${regularOrder.orderId}`, {
          state: {
            pickupNumber: regularOrder.pickupNumber || null,
            paymentMethod: paymentLabel || paymentMethod,
            hasSurplusOrders: surplusOrder ? true : false,
            surplusOrderNumbers: surplusOrder ? [surplusOrder.code] : [],
            surplusPickupNumbers: surplusOrder ? [surplusOrder.pickupNumber] : []
          },
        });
      } else {
        navigate(`/store/${storeId}`);
      }
    } catch (err) {
      alert("送出失敗，請稍後再試。");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleCardSelected = async (card) => {
    setSelectedCard(card);
    
    // 決定使用的聯絡資訊
    let finalName = contactName;
    let finalPhone = contactPhone;
    
    if (user) {
      finalName = user.username || user.email || "會員";
      finalPhone = user.phone_number || "未提供";
    } else {
      if (!contactName || !contactPhone) {
        alert("請填寫聯絡人姓名與電話。");
        return;
      }
    }
    
    // 執行訂單
    await executeOrder(finalName, finalPhone);
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
                  {/* 一般商品區塊 */}
                  {regularItems.length > 0 && (
                    <div className="mb-4">
                      <h6 className="text-muted mb-3">
                        <i className="bi bi-bag me-2"></i>一般外帶商品
                      </h6>
                      {regularItems.map((item) => (
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
                      <div className="pt-2 text-end">
                        <span className="text-muted">小計：</span>
                        <strong className="text-dark ms-2">NT$ {formatPrice(regularTotal)}</strong>
                      </div>
                    </div>
                  )}
                  
                  {/* 惜福品區塊 */}
                  {surplusItems.length > 0 && (
                    <div className="mb-4">
                      <h6 className="text-success mb-3">
                        <i className="bi bi-leaf me-2"></i>惜福專區商品
                      </h6>
                      {surplusItems.map((item) => (
                        <div
                          key={item.id}
                          className="cart-item d-flex justify-content-between align-items-center border-bottom py-3"
                          style={{ backgroundColor: '#f0fff4' }}
                        >
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <h5 className="mb-0">{item.title || item.name}</h5>
                              {item.condition && (
                                <span className="badge bg-warning text-dark" style={{ fontSize: '0.75rem' }}>
                                  {item.condition === 'near_expiry' ? '即期品' : item.condition === 'surplus' ? '剩餘品' : '外包裝損傷'}
                                </span>
                              )}
                            </div>
                            <p className="text-muted mb-1">{item.description}</p>
                            <div className="d-flex align-items-center gap-2">
                              {item.original_price && item.price < item.original_price && (
                                <span className="text-decoration-line-through text-muted small">
                                  原價 NT$ {formatPrice(item.original_price)}
                                </span>
                              )}
                              <strong className="text-success">惜福價 NT$ {formatPrice(item.price)}</strong>
                            </div>
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
                                disabled={item.remaining_quantity && item.quantity >= item.remaining_quantity}
                              >
                                <FaPlus />
                              </button>
                            </div>
                            <div className="text-end" style={{ minWidth: '80px' }}>
                              <strong className="text-success">NT$ {formatPrice(item.price * item.quantity)}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 text-end">
                        <span className="text-muted">小計：</span>
                        <strong className="text-success ms-2">NT$ {formatPrice(surplusTotal)}</strong>
                      </div>
                    </div>
                  )}
                  
                  {/* 總計 */}
                  <div className="pt-3 mt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center">
                      <h4 className="mb-0">總計</h4>
                      <h4 className="mb-0 text-primary">NT$ {formatPrice(total)}</h4>
                    </div>
                    {regularItems.length > 0 && surplusItems.length > 0 && (
                      <p className="text-muted small mt-2 mb-0">
                        <i className="bi bi-info-circle me-1"></i>
                        一般商品和惜福品將分開處理訂單
                      </p>
                    )}
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
                {slots.map((slot) => {
                  const date = new Date(slot);
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const hours = date.getHours();
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  const period = hours >= 12 ? '下午' : '上午';
                  const displayHours = hours % 12 || 12;
                  
                  return (
                    <option key={slot} value={slot}>
                      {`${year}/${month}/${day} ${period}${displayHours}:${minutes}`}
                    </option>
                  );
                })}
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
              <option value="yes">需要</option>
              <option value="no">不需要</option>
                
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
            onClick={() => setShowCheckoutModal(true)}
            disabled={submitting || cartItems.length === 0}
          >
            確認訂單 (NT$ {formatPrice(total)})
          </button>
        </div>
      </div>

      {/* 結帳確認Modal */}
      {showCheckoutModal && (
        <div className="checkout-modal-overlay" onClick={() => !submitting && setShowCheckoutModal(false)}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>確認訂單</h3>
              <button 
                className="btn-close" 
                onClick={() => setShowCheckoutModal(false)}
                disabled={submitting}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* 店家資訊 */}
              <div className="checkout-section">
                <h5 className="section-title">
                  <i className="bi bi-shop me-2"></i>店家資訊
                </h5>
                <div className="info-card">
                  <strong>{store?.name}</strong>
                  <p className="text-muted mb-0">{store?.address}</p>
                </div>
              </div>

              {/* 訂單明細 */}
              <div className="checkout-section">
                <h5 className="section-title">
                  <i className="bi bi-receipt me-2"></i>訂單明細
                </h5>
                <div className="order-items">
                  {regularItems.length > 0 && (
                    <div className="items-group">
                      <div className="group-label">一般外帶商品</div>
                      {regularItems.map((item) => (
                        <div key={item.id} className="order-item">
                          <span className="item-name">{item.name}</span>
                          <span className="item-quantity">× {item.quantity}</span>
                          <span className="item-price">NT$ {formatPrice(item.price * item.quantity)}</span>
                        </div>
                      ))}
                      <div className="subtotal">
                        小計：NT$ {formatPrice(regularTotal)}
                      </div>
                    </div>
                  )}
                  
                  {surplusItems.length > 0 && (
                    <div className="items-group surplus-group">
                      <div className="group-label">
                        <i className="bi bi-leaf me-1"></i>惜福品
                      </div>
                      {surplusItems.map((item) => (
                        <div key={item.id} className="order-item">
                          <span className="item-name">{item.name}</span>
                          <span className="item-quantity">× {item.quantity}</span>
                          <span className="item-price">NT$ {formatPrice(item.price * item.quantity)}</span>
                        </div>
                      ))}
                      <div className="subtotal">
                        小計：NT$ {formatPrice(surplusTotal)}
                      </div>
                    </div>
                  )}
                  
                  <div className="total-section">
                    <div className="total-row">
                      <span className="total-label">總計</span>
                      <span className="total-amount">NT$ {formatPrice(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 取餐資訊 */}
              <div className="checkout-section">
                <h5 className="section-title">
                  <i className="bi bi-clock me-2"></i>取餐資訊
                </h5>
                <div className="info-grid">
                  <div className="info-item">
                    <label>取餐時間</label>
                    <span>{new Date(pickupAt).toLocaleString("zh-TW", {
                      month: 'numeric',
                      day: 'numeric',
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</span>
                  </div>
                  <div className="info-item">
                    <label>聯絡人</label>
                    <span>{user ? (user.username || user.email) : contactName}</span>
                  </div>
                  <div className="info-item">
                    <label>聯絡電話</label>
                    <span>{user ? (user.phone_number || "未提供") : contactPhone}</span>
                  </div>
                  <div className="info-item">
                    <label>餐具</label>
                    <span>{useUtensils === "yes" ? "需要" : "不需要"}</span>
                  </div>
                </div>
                {notes && (
                  <div className="notes-display">
                    <label>備註</label>
                    <p>{notes}</p>
                  </div>
                )}
              </div>

              {/* 付款資訊 */}
              <div className="checkout-section">
                <h5 className="section-title">
                  <i className="bi bi-credit-card me-2"></i>付款方式
                </h5>
                <div className="payment-method">
                  <div className="payment-badge">
                    {paymentOptionsList.find((o) => o.value === paymentMethod)?.label}
                  </div>
                  {paymentMethod === "cash" && (
                    <small className="text-muted d-block mt-2">請於取餐時以現金付款</small>
                  )}
                  {paymentMethod === "credit_card" && (
                    <small className="text-muted d-block mt-2">請於取餐時以信用卡付款</small>
                  )}
                  {paymentMethod === "line_pay" && (
                    <small className="text-muted d-block mt-2">將前往 LINE Pay 付款頁面</small>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCheckoutModal(false)}
                disabled={submitting}
              >
                返回修改
              </button>
              <button
                className="btn btn-primary btn-confirm"
                onClick={() => {
                  handleSubmit();
                }}
                disabled={submitting}
              >
                {submitting 
                  ? "處理中..." 
                  : paymentMethod === "cash"
                  ? `確認送出`
                  : `前往付款`
                }
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 信用卡選擇器 */}
      <CreditCardSelector
        show={showCardSelector}
        onClose={() => setShowCardSelector(false)}
        onSelectCard={handleCardSelected}
      />
    </div>
  );
}

export default TakeoutCartPage;
