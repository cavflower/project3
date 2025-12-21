import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaMinus, FaCoins } from "react-icons/fa";
import { createDineInOrder } from "../../api/orderApi";
import api from "../../api/api";
import surplusFoodApi from "../../api/surplusFoodApi";
import { useAuth } from "../../store/AuthContext";
import CreditCardSelector from "../checkout/CreditCardSelector";
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
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

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
    () => regularItems.reduce((sum, item) => {
      const itemPrice = item.finalPrice || item.price;
      return sum + Number(itemPrice) * item.quantity;
    }, 0) || 0,
    [regularItems]
  );

  const surplusTotal = useMemo(
    () => surplusItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) || 0,
    [surplusItems]
  );

  // 兌換項目（折扣）
  const redemptionItems = useMemo(
    () => cartItems.filter(item => item.itemType === 'redemption'),
    [cartItems]
  );

  // 計算折扣總額
  const discountTotal = useMemo(
    () => redemptionItems.reduce((sum, item) => {
      if (item.redemptionRule?.redemption_type === 'discount') {
        return sum + Number(item.redemptionRule.discount_value) * (item.quantity || 1);
      }
      return sum;
    }, 0) || 0,
    [redemptionItems]
  );

  const subtotal = regularTotal + surplusTotal;
  // 折扣金額不能超過小計
  const actualDiscount = Math.min(discountTotal, subtotal);
  const total = Math.max(0, subtotal - actualDiscount);

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

  const handleQuantityChange = (cartKey, change) => {
    setCartItems(prevItems => {
      if (change > 0) {
        return prevItems.map(item => {
          const itemKey = item.cartKey || item.id?.toString() || item.id;
          return itemKey === cartKey
            ? { ...item, quantity: item.quantity + 1 }
            : item;
        });
      } else {
        return prevItems
          .map(item => {
            const itemKey = item.cartKey || item.id?.toString() || item.id;
            return itemKey === cartKey
              ? { ...item, quantity: item.quantity - 1 }
              : item;
          })
          .filter(item => item.quantity > 0);
      }
    });
  };

  const handleSubmit = async () => {
    if (!cartItems.length) {
      alert("購物車是空的。");
      return;
    }

    // 驗證折扣是否超過商品小計
    if (discountTotal > subtotal) {
      alert(`折扣金額 (NT$ ${discountTotal}) 不能超過商品小計 (NT$ ${subtotal})，請移除部分兌換項目。`);
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

      // 0. 如果有兌換項目，先扣除點數
      if (redemptionItems.length > 0 && user) {
        const totalPointsToUse = redemptionItems.reduce((sum, item) => {
          const rule = item.redemptionRule;
          return sum + (rule?.required_points || 0) * (item.quantity || 1);
        }, 0);

        if (totalPointsToUse > 0) {
          const redemptionReasons = redemptionItems.map(item =>
            `${item.name} ×${item.quantity}`
          ).join(', ');

          try {
            await surplusFoodApi.useGreenPoints(
              storeId,
              totalPointsToUse,
              `兌換使用: ${redemptionReasons}`
            );
          } catch (pointsError) {
            console.error('扣除點數失敗:', pointsError);
            alert('扣除點數失敗，請稍後再試。');
            setSubmitting(false);
            return;
          }
        }
      }

      // 取得 product 類型的兌換項目（免費商品）
      const productRedemptionItems = redemptionItems.filter(
        item => item.redemptionRule?.redemption_type === 'product'
      );

      // 1. 如果有一般商品 或 有兌換商品（product類型），創建一般內用訂單
      if (regularItems.length > 0 || productRedemptionItems.length > 0) {
        // 構建備註內容（包含兌換項目）
        let orderNotes = notes || '';
        if (redemptionItems.length > 0) {
          const redemptionInfo = redemptionItems.map(item => {
            const rule = item.redemptionRule;
            if (rule?.redemption_type === 'discount') {
              return `【綠色點數折扣】${item.name} -NT$${rule.discount_value} (消耗${rule.required_points}點×${item.quantity})`;
            } else {
              return `【綠色點數兌換】${item.name} ×${item.quantity} (消耗${rule?.required_points}點×${item.quantity})`;
            }
          }).join('\n');
          orderNotes = orderNotes ? `${orderNotes}\n\n${redemptionInfo}` : redemptionInfo;
        }

        // 組合訂單品項
        // 注意：兌換商品無法作為品項加入（沒有 product_id），所以只包含一般商品
        // 兌換商品資訊已在備註中顯示
        const orderItems = regularItems.map((item) => ({
          product: item.id,
          quantity: item.quantity,
          unit_price: item.finalPrice || item.price,
          specifications: item.selectedSpecs || [],
        }));

        const regularPayload = {
          store: storeId,
          customer_name: finalName,
          customer_phone: finalPhone,
          table_label: tableLabel || '',
          notes: orderNotes,
          payment_method: paymentMethod,
          use_eco_tableware: useEcoTableware === "yes",
          items: orderItems,
          // 標記這是一個有兌換商品的訂單
          has_product_redemption: productRedemptionItems.length > 0,
          // 如果有兌換商品，傳送兌換商品資訊給後端
          product_redemptions: productRedemptionItems.map(item => ({
            name: item.redemptionRule?.product_name || item.name,
            quantity: item.quantity || 1,
            required_points: item.redemptionRule?.required_points || 0
          }))
        };

        const regularResponse = await createDineInOrder(regularPayload);
        orderResults.push({
          type: 'regular',
          orderId: regularResponse.data?.id,
          pickupNumber: regularResponse.data?.order_number  // 內用訂單使用 order_number
        });
      }

      // 2. 如果有惜福品，合併成一張訂單
      if (surplusItems.length > 0) {
        // 構建備註內容（包含兌換項目）
        let surplusNotes = notes || '';
        if (redemptionItems.length > 0) {
          // 惜福品訂單也要顯示兌換資訊
          const redemptionInfo = redemptionItems.map(item => {
            const rule = item.redemptionRule;
            if (rule?.redemption_type === 'discount') {
              return `【綠色點數折扣】${item.name} -NT$${rule.discount_value} (消耗${rule.required_points}點×${item.quantity})`;
            } else {
              return `【綠色點數兌換】${item.name} ×${item.quantity} (消耗${rule?.required_points}點×${item.quantity})`;
            }
          }).join('\n');
          surplusNotes = surplusNotes ? `${surplusNotes}\n\n${redemptionInfo}` : redemptionInfo;
        }

        const surplusPayload = {
          items: surplusItems.map(item => ({
            surplus_food: item.id,
            quantity: item.quantity
          })),
          customer_name: finalName,
          customer_phone: finalPhone,
          table_label: tableLabel || '',  // 添加桌號
          pickup_at: new Date().toISOString(),
          payment_method: paymentMethod,
          order_type: 'dine_in',  // 訂單類型為內用
          use_utensils: useEcoTableware === "yes",
          notes: surplusNotes,
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
      const surplusOrders = orderResults.filter(r => r.type === 'surplus');

      // 如果有一般訂單，導向確認頁
      if (regularOrder && regularOrder.orderId) {
        navigate(`/confirmation/${regularOrder.orderId}`, {
          state: {
            pickupNumber: regularOrder.pickupNumber || null,
            paymentMethod: paymentLabel || paymentMethod,
            hasSurplusOrders: surplusOrders.length > 0,
            surplusOrderNumbers: surplusOrders.map(o => o.code).filter(Boolean),
            surplusPickupNumbers: surplusOrders.map(o => o.pickupNumber).filter(Boolean),
            isDineIn: true,
            tableLabel: tableLabel
          },
        });
      } else if (surplusOrders.length > 0) {
        // 只有惜福品訂單，導向惜福品確認頁
        const firstSurplusOrder = surplusOrders[0];
        navigate(`/confirmation/surplus/${firstSurplusOrder.orderId || 'success'}`, {
          state: {
            pickupNumber: firstSurplusOrder.pickupNumber || null,
            orderNumber: firstSurplusOrder.code || null,
            paymentMethod: paymentLabel || paymentMethod,
            isSurplusOnly: true,
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

  const handleCardSelected = async (card) => {
    setSelectedCard(card);

    // 決定使用的聯絡資訊
    let finalName = '訪客';
    let finalPhone = '訪客';

    if (user) {
      finalName = user.username || user.email || '訪客';
      finalPhone = user.phone_number || '訪客';
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
                      {regularItems.map((item) => {
                        const displayPrice = item.finalPrice || item.price;
                        return (
                          <div
                            key={item.cartKey || item.id}
                            className="cart-item d-flex justify-content-between align-items-center border-bottom py-3"
                          >
                            <div className="flex-grow-1">
                              <h5 className="mb-1">{item.name}</h5>
                              {/* 顯示已選規格 */}
                              {item.selectedSpecs && item.selectedSpecs.length > 0 && (
                                <div className="selected-specs mb-1">
                                  {item.selectedSpecs.map((spec, idx) => (
                                    <span key={idx} className="badge bg-light text-dark me-1" style={{ fontSize: '0.75rem' }}>
                                      {spec.groupName}: {spec.optionName}
                                      {spec.priceAdjustment !== 0 && (
                                        <span className={spec.priceAdjustment > 0 ? 'text-danger' : 'text-success'}>
                                          {spec.priceAdjustment > 0 ? ` +$${spec.priceAdjustment}` : ` -$${Math.abs(spec.priceAdjustment)}`}
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <strong className="text-dark">NT$ {formatPrice(displayPrice)}</strong>
                            </div>
                            <div className="d-flex align-items-center gap-3">
                              <div className="quantity-controls d-flex align-items-center gap-2">
                                <button
                                  className="btn rounded-circle quantity-btn"
                                  onClick={() => handleQuantityChange(item.cartKey, -1)}
                                >
                                  <FaMinus />
                                </button>
                                <span className="quantity-display">
                                  {item.quantity}
                                </span>
                                <button
                                  className="btn rounded-circle quantity-btn"
                                  onClick={() => handleQuantityChange(item.cartKey, 1)}
                                >
                                  <FaPlus />
                                </button>
                              </div>
                              <div className="text-end" style={{ minWidth: '80px' }}>
                                <strong className="text-dark">NT$ {formatPrice(displayPrice * item.quantity)}</strong>
                              </div>
                            </div>
                          </div>
                        )
                      })}
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
                          key={item.cartKey || item.id}
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
                                onClick={() => handleQuantityChange(item.cartKey || item.id.toString(), -1)}
                              >
                                <FaMinus />
                              </button>
                              <span className="quantity-display">
                                {item.quantity}
                              </span>
                              <button
                                className="btn rounded-circle quantity-btn"
                                onClick={() => handleQuantityChange(item.cartKey || item.id.toString(), 1)}
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
            onClick={() => setShowCheckoutModal(true)}
            disabled={submitting || cartItems.length === 0}
          >
            確認訂單 (NT$ {formatPrice(total)})
          </button>
        </div>
      </div>

      {/* 信用卡選擇器 */}
      <CreditCardSelector
        show={showCardSelector}
        onClose={() => setShowCardSelector(false)}
        onSelectCard={handleCardSelected}
      />

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
                  {tableLabel && (
                    <p className="mb-0 mt-2"><strong>桌號：</strong>{tableLabel}</p>
                  )}
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
                      <div className="group-label">一般內用商品</div>
                      {regularItems.map((item) => (
                        <div key={item.cartKey || item.id} className="order-item">
                          <span className="item-name">{item.name}</span>
                          <span className="item-quantity">× {item.quantity}</span>
                          <span className="item-price">NT$ {formatPrice((item.finalPrice || item.price) * item.quantity)}</span>
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

              {/* 用餐資訊 */}
              <div className="checkout-section">
                <h5 className="section-title">
                  <i className="bi bi-info-circle me-2"></i>用餐資訊
                </h5>
                <div className="info-grid">
                  <div className="info-item">
                    <label>聯絡人</label>
                    <span>{user ? (user.username || user.email) : '訪客'}</span>
                  </div>
                  <div className="info-item">
                    <label>聯絡電話</label>
                    <span>{user ? (user.phone_number || "未提供") : '訪客'}</span>
                  </div>
                  <div className="info-item">
                    <label>環保餐具</label>
                    <span>{useEcoTableware === "yes" ? "有" : "無"}</span>
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
                    <small className="text-muted d-block mt-2">請以現金付款</small>
                  )}
                  {paymentMethod === "credit_card" && (
                    <small className="text-muted d-block mt-2">請以信用卡付款</small>
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
                {submitting ? "送出中..." : "確認送出"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DineInCartPage;
