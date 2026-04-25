import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPlus, FaMinus, FaCoins } from "react-icons/fa";
import { createTakeoutOrder } from "../../api/orderApi";
import api from "../../api/api";
import surplusFoodApi from "../../api/surplusFoodApi";
import { useAuth } from "../../store/AuthContext";
import CreditCardSelector from "../checkout/CreditCardSelector";
import styles from './TakeoutCartPage.module.css';

const paymentOptionsList = [
  { value: "cash", label: "現金" },
  { value: "credit_card", label: "信用卡" },
  { value: "line_pay", label: "LINE Pay" },
];

const formatPrice = (value) => Math.round(Number(value) || 0);
const CARRIER_BODY_REGEX = /^[0-9A-Z.+-]{7}$/;

const normalizeCarrierBody = (rawValue) =>
  (rawValue || '')
    .toUpperCase()
    .replace(/[^0-9A-Z.+-]/g, '')
    .slice(0, 7);

const getSpecSummaryText = (specs = []) => {
  if (!Array.isArray(specs) || specs.length === 0) return '';
  const labels = specs
    .map((spec) => {
      const groupName = spec.groupName || spec.group_name || '';
      const optionName = spec.optionName || spec.option_name || spec.name || '';
      if (groupName && optionName) return `${groupName}: ${optionName}`;
      return optionName || groupName;
    })
    .filter(Boolean);
  return labels.join('、');
};

const roundUpToFiveMinutes = (date) => {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minute = rounded.getMinutes();
  const nextFive = Math.ceil(minute / 5) * 5;
  if (nextFive === 60) {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  } else {
    rounded.setMinutes(nextFive, 0, 0);
  }
  return rounded;
};

const getEarliestPickupTime = (now = new Date()) =>
  roundUpToFiveMinutes(new Date(now.getTime() + 20 * 60000));

const buildPickupSlots = (now = new Date()) => {
  const slots = [];
  const earliest = getEarliestPickupTime(now);
  const endOfDay = new Date(earliest);
  endOfDay.setHours(23, 55, 0, 0);

  for (let cursor = new Date(earliest); cursor <= endOfDay; cursor = new Date(cursor.getTime() + 5 * 60000)) {
    slots.push(new Date(cursor));
  }

  return slots;
};

const getInitialPickupAt = (initialPickupAt) => {
  const slots = buildPickupSlots(new Date());
  if (slots.length === 0) return new Date().toISOString();

  if (initialPickupAt) {
    const parsed = new Date(initialPickupAt);
    const matched = slots.find((slot) => slot.getTime() === parsed.getTime());
    if (matched) return matched.toISOString();
  }

  return slots[0].toISOString();
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
  const [pickupAt, setPickupAt] = useState(() => getInitialPickupAt(initialCart?.pickupAt));
  const [paymentMethod, setPaymentMethod] = useState(paymentOptionsList[0].value);
  const [useUtensils, setUseUtensils] = useState("yes");
  const [notes, setNotes] = useState(initialCart?.notes || "");
  const [invoiceCarrierBody, setInvoiceCarrierBody] = useState(() =>
    normalizeCarrierBody(initialCart?.carrierCode || initialCart?.invoiceCarrier || '')
  );
  const [submitting, setSubmitting] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const slots = useMemo(() => buildPickupSlots(new Date()), []);
  const selectedPickupDate = useMemo(() => {
    const current = new Date(pickupAt);
    const matched = slots.find((slot) => slot.getTime() === current.getTime());
    return matched || slots[0] || null;
  }, [pickupAt, slots]);
  const hourOptions = useMemo(
    () => [...new Set(slots.map((slot) => slot.getHours()))],
    [slots]
  );
  const minuteOptions = useMemo(() => {
    if (!selectedPickupDate) return [];
    const selectedHour = selectedPickupDate.getHours();
    return [...new Set(
      slots
        .filter((slot) => slot.getHours() === selectedHour)
        .map((slot) => slot.getMinutes())
    )];
  }, [selectedPickupDate, slots]);

  const handlePickupHourChange = (hourValue) => {
    if (!selectedPickupDate) return;
    const nextHour = Number(hourValue);
    const candidateMinutes = [...new Set(
      slots
        .filter((slot) => slot.getHours() === nextHour)
        .map((slot) => slot.getMinutes())
    )];
    const currentMinute = selectedPickupDate.getMinutes();
    const nextMinute = candidateMinutes.includes(currentMinute) ? currentMinute : candidateMinutes[0];
    const next = slots.find((slot) => slot.getHours() === nextHour && slot.getMinutes() === nextMinute);
    if (next) setPickupAt(next.toISOString());
  };

  const handlePickupMinuteChange = (minuteValue) => {
    if (!selectedPickupDate) return;
    const nextMinute = Number(minuteValue);
    const next = slots.find(
      (slot) => slot.getHours() === selectedPickupDate.getHours() && slot.getMinutes() === nextMinute
    );
    if (next) setPickupAt(next.toISOString());
  };

  // 分離一般商品和惜福品
  const regularItems = useMemo(
    () => cartItems.filter(item => item.itemType === 'regular' || !item.itemType),
    [cartItems]
  );

  const surplusItems = useMemo(
    () => cartItems.filter(item => item.itemType === 'surplus'),
    [cartItems]
  );

  // 兌換項目（折扣）
  const redemptionItems = useMemo(
    () => cartItems.filter(item => item.itemType === 'redemption'),
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

  // 計算折扣金額
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
    const earliestPickup = getEarliestPickupTime(new Date());
    const selectedPickup = new Date(pickupAt);
    if (Number.isNaN(selectedPickup.getTime()) || selectedPickup < earliestPickup) {
      setPickupAt(earliestPickup.toISOString());
      alert(
        `取餐時間需晚於現在 20 分鐘，已自動調整為 ${earliestPickup.toLocaleString("zh-TW", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}`
      );
      return;
    }

    if (!cartItems.length) {
      alert("購物車是空的。");
      return;
    }

    if (invoiceCarrierBody && !CARRIER_BODY_REGEX.test(invoiceCarrierBody)) {
      alert('載具格式需為 /XXXXXXX（斜線固定，請輸入 7 碼）。');
      return;
    }

    const invoiceCarrier = invoiceCarrierBody ? `/${invoiceCarrierBody}` : '';

    // 驗證折扣是否超過商品小計
    if (discountTotal > subtotal) {
      alert(`折扣金額 (NT$ ${discountTotal}) 不能超過商品小計 (NT$ ${subtotal})，請移除部分兌換項目。`);
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
    await executeOrder(finalName, finalPhone, null, invoiceCarrier);
  };

  const executeOrder = async (finalName, finalPhone, cardForPayment = null, invoiceCarrier = '') => {

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

      // 1. 如果有一般商品 或 有兌換商品（product類型），創建一般外帶訂單
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

        // 如果只有兌換商品沒有一般商品，需要至少提供空的 items 陣列
        // 後端需要處理這種情況
        const regularPayload = {
          store: storeId,
          service_channel: "takeout",
          pickup_at: pickupAt,
          customer_name: finalName,
          customer_phone: finalPhone,
          invoice_carrier: invoiceCarrier,
          notes: orderNotes,
          payment_method: paymentMethod,
          use_utensils: useUtensils === "yes",
          items: orderItems,
          // 標記這是一個有兌換商品的訂單
          has_product_redemption: productRedemptionItems.length > 0,
          // 如果只有兌換商品，傳送兌換商品資訊給後端
          product_redemptions: productRedemptionItems.map(item => ({
            name: item.redemptionRule?.product_name || item.name,
            quantity: item.quantity || 1,
            required_points: item.redemptionRule?.required_points || 0
          }))
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
          pickup_at: pickupAt,
          payment_method: paymentMethod,
          order_type: 'takeout',
          use_utensils: useUtensils === "yes",
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
      const regularOrderItemsForReceipt = [
        ...regularItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          amount: Number(item.finalPrice || item.price) * Number(item.quantity || 1),
          specText: getSpecSummaryText(item.selectedSpecs || []),
        })),
        ...productRedemptionItems.map((item) => ({
          name: item.redemptionRule?.product_name || item.name,
          quantity: item.quantity || 1,
          amount: 0,
        })),
      ];
      const surplusOrderItemsForReceipt = surplusItems.map((item) => ({
        name: item.title || item.name,
        quantity: item.quantity,
        amount: Number(item.price) * Number(item.quantity || 1),
      }));

      setCartItems([]);

      const paymentLabel = paymentOptionsList.find((o) => o.value === paymentMethod)?.label;

      const regularOrder = orderResults.find(r => r.type === 'regular');
      const surplusOrder = orderResults.find(r => r.type === 'surplus');

      // 如果有一般訂單，導向確認頁
      if (regularOrder && regularOrder.orderId) {
        const cardInfo = cardForPayment || selectedCard;
        navigate(`/confirmation/${regularOrder.orderId}`, {
          state: {
            pickupNumber: regularOrder.pickupNumber || null,
            paymentMethod: paymentLabel || paymentMethod,
            hasSurplusOrders: surplusOrder ? true : false,
            surplusOrderNumbers: surplusOrder ? [surplusOrder.code] : [],
            surplusPickupNumbers: surplusOrder ? [surplusOrder.pickupNumber] : [],
            selectedCard: cardInfo || null,
            selectedCardName: cardInfo?.card_holder_name || null,
            selectedCardLastFour: cardInfo?.card_last_four || null,
            orderItems: regularOrderItemsForReceipt,
          },
        });
      } else if (surplusOrder) {
        // 只有惜福品訂單，導向惜福品確認頁
        const cardInfo = cardForPayment || selectedCard;
        navigate(`/confirmation/surplus/${surplusOrder.orderId || 'success'}`, {
          state: {
            pickupNumber: surplusOrder.pickupNumber || null,
            orderNumber: surplusOrder.code || null,
            paymentMethod: paymentLabel || paymentMethod,
            isSurplusOnly: true,
            isDineIn: false,
            selectedCard: cardInfo || null,
            selectedCardName: cardInfo?.card_holder_name || null,
            selectedCardLastFour: cardInfo?.card_last_four || null,
            orderItems: surplusOrderItemsForReceipt,
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

    if (invoiceCarrierBody && !CARRIER_BODY_REGEX.test(invoiceCarrierBody)) {
      alert('載具格式需為 /XXXXXXX（斜線固定，請輸入 7 碼）。');
      return;
    }

    const invoiceCarrier = invoiceCarrierBody ? `/${invoiceCarrierBody}` : '';

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
    await executeOrder(finalName, finalPhone, card, invoiceCarrier);
  };

  return (
    <div className={`${styles['takeout-cart-page']} container`} style={{ marginTop: "8px", marginBottom: "40px" }}>
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
                  contact: { name: contactName, phone: contactPhone },
                  carrierCode: invoiceCarrierBody
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
            <div className={`card-header ${styles['cart-header']}`}>
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
                      {regularItems.map((item) => {
                        const displayPrice = item.finalPrice || item.price;
                        return (
                          <div
                            key={item.cartKey || item.id}
                            className={`${styles['cart-item']} d-flex justify-content-between align-items-center border-bottom py-3`}
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
                              <div className={`${styles['quantity-controls']} d-flex align-items-center gap-2`}>
                                <button
                                  className={`btn rounded-circle ${styles['quantity-btn']}`}
                                  onClick={() => handleQuantityChange(item.cartKey, -1)}
                                >
                                  <FaMinus />
                                </button>
                                <span className={styles['quantity-display']}>
                                  {item.quantity}
                                </span>
                                <button
                                  className={`btn rounded-circle ${styles['quantity-btn']}`}
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
                          className={`${styles['cart-item']} d-flex justify-content-between align-items-center border-bottom py-3`}
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
                            <div className={`${styles['quantity-controls']} d-flex align-items-center gap-2`}>
                              <button
                                className={`btn rounded-circle ${styles['quantity-btn']}`}
                                onClick={() => handleQuantityChange(item.cartKey || item.id.toString(), -1)}
                              >
                                <FaMinus />
                              </button>
                              <span className={styles['quantity-display']}>
                                {item.quantity}
                              </span>
                              <button
                                className={`btn rounded-circle ${styles['quantity-btn']}`}
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

                  {/* 綠色點數兌換區塊 */}
                  {redemptionItems.length > 0 && (
                    <div className="mb-4">
                      <h6 className="text-success mb-3">
                        <FaCoins className="me-2" />綠色點數兌換
                      </h6>
                      {redemptionItems.map((item) => {
                        const maxQty = item.redemptionRule?.redemption_type === 'discount'
                          ? 1
                          : (item.redemptionRule?.max_quantity_per_order || 1);
                        const quantity = item.quantity || 1;

                        return (
                          <div
                            key={item.cartKey || item.id}
                            className={`${styles['cart-item']} d-flex justify-content-between align-items-center border-bottom py-3`}
                            style={{ backgroundColor: '#e8f5e9' }}
                          >
                            <div className="flex-grow-1">
                              <h5 className="mb-1">
                                {item.name}
                                <span className={`badge ms-2 ${item.redemptionRule?.redemption_type === 'discount' ? 'bg-warning text-dark' : 'bg-info'}`}>
                                  {item.redemptionRule?.redemption_type === 'discount' ? '折扣' : '商品'}
                                </span>
                              </h5>
                              <p className="text-muted mb-1">
                                消耗點數：{item.redemptionRule?.required_points} 點
                                {item.redemptionRule?.redemption_type === 'product' && quantity > 1 && (
                                  <span> × {quantity} = {item.redemptionRule?.required_points * quantity} 點</span>
                                )}
                              </p>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <div className={`${styles['quantity-control']} d-flex align-items-center gap-2`}>
                                <button
                                  className={`${styles['quantity-btn']} rounded-circle`}
                                  onClick={() => handleQuantityChange(item.cartKey || item.id, -1)}
                                >
                                  <FaMinus size={12} />
                                </button>
                                <span className={styles['quantity-display']}>{quantity}</span>
                                <button
                                  className={`${styles['quantity-btn']} rounded-circle`}
                                  onClick={() => handleQuantityChange(item.cartKey || item.id, 1)}
                                  disabled={quantity >= maxQty}
                                  style={quantity >= maxQty ? { opacity: 0.5 } : {}}
                                >
                                  <FaPlus size={12} />
                                </button>
                              </div>
                              {item.redemptionRule?.redemption_type === 'discount' && (
                                <div className="text-end" style={{ minWidth: '80px' }}>
                                  <strong className="text-success">-NT$ {item.redemptionRule.discount_value}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 總計 */}
                  <div className="pt-3 mt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted">小計</span>
                      <span className="text-dark">NT$ {formatPrice(subtotal)}</span>
                    </div>
                    {actualDiscount > 0 && (
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-success"><FaCoins className="me-1" />綠色點數折扣</span>
                        <span className="text-success">-NT$ {formatPrice(actualDiscount)}</span>
                      </div>
                    )}
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
          <div className="card shadow-sm mb-3">
            <div className={`card-header ${styles['cart-header']}`}>
              <strong>訂單資訊</strong>
            </div>
          </div>

          {/* 聯絡資訊 - 只在未登入時顯示 */}
          {!user && (
            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <p className="fw-bold text-muted mb-2">聯絡資訊</p>
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
            <div className="card-body">
              <p className="fw-bold text-muted mb-2">取餐時間</p>
              {selectedPickupDate && (
                <>
                  <div className="row g-2">
                    <div className="col-6">
                      <select
                        className="form-select"
                        value={selectedPickupDate.getHours()}
                        onChange={(e) => handlePickupHourChange(e.target.value)}
                      >
                        {hourOptions.map((hour) => {
                          const period = hour >= 12 ? '下午' : '上午';
                          const displayHour = hour % 12 || 12;
                          return (
                            <option key={hour} value={hour}>
                              {`${period}${displayHour}點`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="col-6">
                      <select
                        className="form-select"
                        value={selectedPickupDate.getMinutes()}
                        onChange={(e) => handlePickupMinuteChange(e.target.value)}
                      >
                        {minuteOptions.map((minute) => (
                          <option key={minute} value={minute}>
                            {`${String(minute).padStart(2, '0')} 分`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <small className="text-muted d-block mt-2">
                    最快可取餐時間：{slots[0].toLocaleString('zh-TW', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })}
                  </small>
                </>
              )}
            </div>
          </div>

          {/* 是否需要餐具 */}
          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <p className="fw-bold text-muted mb-2">是否需要餐具</p>
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

          {/* 載具 */}
          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <p className="fw-bold text-muted mb-2">發票載具（選填）</p>
              <div className="input-group mb-2">
                <span className="input-group-text">/</span>
                <input
                  type="text"
                  className="form-control"
                  value={invoiceCarrierBody}
                  onChange={(e) => setInvoiceCarrierBody(normalizeCarrierBody(e.target.value))}
                  maxLength={7}
                  placeholder="請輸入 7 碼"
                />
              </div>
              <small className="text-muted">格式：/XXXXXXX（輸入 7 碼即可）</small>
            </div>
          </div>

          {/* 備註 */}
          <div className="card shadow-sm mb-3">
            <div className="card-body">
              <p className="fw-bold text-muted mb-2">備註</p>
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
        <div className={styles['checkout-modal-overlay']} onClick={() => !submitting && setShowCheckoutModal(false)}>
          <div className={styles['checkout-modal']} onClick={(e) => e.stopPropagation()}>
            <button
              className={`btn-close ${styles['receipt-close']}`}
              onClick={() => setShowCheckoutModal(false)}
              disabled={submitting}
            >
              ×
            </button>

            <div className="modal-body">
              <div className={styles['checkout-receipt']}>
                <div className={styles['receipt-shop-name']}>{store?.name}</div>
                <div className={styles['receipt-info']}>
                  <div>{store?.address}</div>
                  <div>
                    取餐時間：{new Date(pickupAt).toLocaleString("zh-TW", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <table className={styles['checkout-receipt-table']}>
                  <thead>
                    <tr>
                      <th>品項</th>
                      <th>數量</th>
                      <th>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regularItems.map((item) => (
                      <tr key={`regular-${item.cartKey || item.id}`}>
                        <td>
                          {item.name}
                          {!!getSpecSummaryText(item.selectedSpecs || []) && (
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                              {getSpecSummaryText(item.selectedSpecs || [])}
                            </div>
                          )}
                        </td>
                        <td>{item.quantity}</td>
                        <td>NT$ {formatPrice((item.finalPrice || item.price) * item.quantity)}</td>
                      </tr>
                    ))}
                    {surplusItems.map((item) => (
                      <tr key={`surplus-${item.cartKey || item.id}`}>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>NT$ {formatPrice(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                    {actualDiscount > 0 && (
                      <tr>
                        <td>綠色點數折扣</td>
                        <td>1</td>
                        <td>-NT$ {formatPrice(actualDiscount)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className={styles['checkout-receipt-total']}>
                  <span>總計</span>
                  <span>NT$ {formatPrice(total)}</span>
                </div>

                <div className={styles['checkout-receipt-meta']}>
                  <div>
                    <label>聯絡人</label>
                    <span>{user ? (user.username || user.email) : contactName}</span>
                  </div>
                  <div>
                    <label>聯絡電話</label>
                    <span>{user ? (user.phone_number || "未提供") : contactPhone}</span>
                  </div>
                  <div>
                    <label>餐具</label>
                    <span>{useUtensils === "yes" ? "需要" : "不需要"}</span>
                  </div>
                  <div>
                    <label>發票載具</label>
                    <span>{invoiceCarrierBody ? `/${invoiceCarrierBody}` : '未填寫'}</span>
                  </div>
                </div>

                {notes && (
                  <div className={styles['checkout-receipt-notes']}>
                    <label>備註</label>
                    <p>{notes}</p>
                  </div>
                )}

                <div className={styles['checkout-receipt-payment']}>
                  <label>付款方式</label>
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
                className={`btn btn-primary ${styles['btn-confirm']}`}
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

