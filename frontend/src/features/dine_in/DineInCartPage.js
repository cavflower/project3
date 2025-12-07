import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaMinus } from "react-icons/fa";
import { createDineInOrder } from "../../api/orderApi";
import api from "../../api/api";
import { useAuth } from "../../store/AuthContext";
import "../takeout/TakeoutCartPage.css";

const paymentOptionsList = [
  { value: "cash", label: "現金" },
  { value: "credit_card", label: "信用卡" },
  { value: "line_pay", label: "LINE Pay" },
];

const formatPrice = (value) => Math.round(Number(value) || 0);

function DineInCartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { cart: initialCart, store, storeId, tableLabel } = location.state || {};
  
  // 使用本地狀態管理購物車
  const [cartItems, setCartItems] = useState(initialCart?.items || []);
  const [paymentMethod, setPaymentMethod] = useState(paymentOptionsList[0].value);
  const [useEcoTableware, setUseEcoTableware] = useState("no");
  const [notes, setNotes] = useState(initialCart?.notes || "");
  const [submitting, setSubmitting] = useState(false);

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
    let finalName = '訪客';
    let finalPhone = '訪客';
    
    // 如果有登入，使用真實用戶資料
    if (user) {
      finalName = user.username || user.email || '訪客';
      finalPhone = user.phone_number || '訪客';
    }
    
    try {
      setSubmitting(true);
      const orderResults = [];
      
      // 1. 如果有一般商品，創建一般內用訂單
      if (regularItems.length > 0) {
        const regularPayload = {
          store: storeId,
          customer_name: finalName,
          customer_phone: finalPhone,
          table_label: tableLabel || '',
          notes: notes,  // 備註欄位預設為空，不包含桌號
          payment_method: paymentMethod,
          use_eco_tableware: useEcoTableware === "yes",
          items: regularItems.map((item) => ({
            product: item.id,
            quantity: item.quantity,
          })),
        };

        const regularResponse = await createDineInOrder(regularPayload);
        orderResults.push({
          type: 'regular',
          orderId: regularResponse.data?.id,
          pickupNumber: regularResponse.data?.order_number  // 內用訂單使用 order_number
        });
      }
      
      // 2. 如果有惜福品，分別創建惜福品訂單
      if (surplusItems.length > 0) {
        const surplusPromises = surplusItems.map(item => {
          const surplusPayload = {
            surplus_food: item.id,
            quantity: item.quantity,
            customer_name: finalName,
            customer_phone: finalPhone,
            pickup_at: new Date().toISOString(),
            payment_method: paymentMethod,
            order_type: 'dine_in',  // 新增：訂單類型為內用
            use_utensils: useEcoTableware === "yes",
            notes: notes,  // 備註不包含桌號
          };
          
          return api.post('/merchant/surplus/orders/', surplusPayload);
        });

        const surplusResponses = await Promise.all(surplusPromises);
        surplusResponses.forEach(response => {
          orderResults.push({
            type: 'surplus',
            code: response.data?.order_number,
            pickupNumber: response.data?.pickup_number,
            orderId: response.data?.id
          });
        });
      }
      
      // 清空購物車
      setCartItems([]);
      
      const paymentLabel = paymentOptionsList.find((o) => o.value === paymentMethod)?.label;
      
      // 構建成功訊息
      let alertMessage = `桌號：${tableLabel || '未提供'}\n付款方式：${paymentLabel}\n環保餐具：${useEcoTableware === 'yes' ? '有' : '無'}\n`;
      
      const regularOrder = orderResults.find(r => r.type === 'regular');
      if (regularOrder) {
        alertMessage += `\n【內用訂單】\n取單號碼：${regularOrder.pickupNumber || "待通知"}`;
      }
      
      const surplusOrders = orderResults.filter(r => r.type === 'surplus');
      if (surplusOrders.length > 0) {
        const pickupNumbers = surplusOrders
          .map(o => o.pickupNumber)
          .filter(Boolean)
          .join(', ');
        const codes = surplusOrders.map(o => o.code).filter(Boolean).join(', ');
        
        alertMessage += `\n\n【惜福品訂單】`;
        if (pickupNumbers) {
          alertMessage += `\n取單號碼：${pickupNumbers}`;
        }
        alertMessage += `\n訂單編號：${codes || "待處理"}`;
      }
      
      alertMessage += '\n\n請等待服務人員確認。';
      
      alert(alertMessage);

      // 如果有一般訂單，導向確認頁；否則返回菜單
      if (regularOrder && regularOrder.orderId) {
        navigate(`/confirmation/${regularOrder.orderId}`, {
          state: {
            pickupNumber: regularOrder.pickupNumber || null,
            paymentMethod: paymentLabel || paymentMethod,
            hasSurplusOrders: surplusOrders.length > 0,
            isDineIn: true,
            tableLabel: tableLabel
          },
        });
      } else {
        navigate(`/store/${storeId}/dine-in/menu?table=${tableLabel || ''}`);
      }
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
            onClick={() => navigate(`/store/${storeId}/dine-in/menu?table=${tableLabel || ''}`, { 
              state: { 
                cart: {
                  items: cartItems,
                  notes: notes
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
              <p className="text-muted mb-2">{store?.address}</p>
              {tableLabel && (
                <div className="d-flex flex-wrap gap-3">
                  <span>
                    <i className="bi bi-geo-alt me-1" />
                    桌號：{tableLabel}
                  </span>
                </div>
              )}
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
                        <i className="bi bi-bag me-2"></i>一般內用商品
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
          {/* 桌號資訊 */}
          {tableLabel && (
            <div className="card shadow-sm mb-3">
              <div className="card-header cart-header">
                <strong>用餐資訊</strong>
              </div>
              <div className="card-body">
                <div className="mb-0">
                  <label className="form-label">桌號</label>
                  <input
                    type="text"
                    className="form-control"
                    value={tableLabel}
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}

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

          {/* 有無環保餐具 */}
          <div className="card shadow-sm mb-3">
            <div className="card-header cart-header">
              <strong>有無環保餐具</strong>
            </div>
            <div className="card-body">
              <select
                className="form-select"
                value={useEcoTableware}
                onChange={(e) => setUseEcoTableware(e.target.value)}
              >
                <option value="no">無</option>
                <option value="yes">有</option>
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
                placeholder="特殊需求或過敏資訊..."
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
              : `送出訂單 (NT$ ${formatPrice(total)})`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default DineInCartPage;
