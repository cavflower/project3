import React, { useEffect, useMemo, useReducer, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaPlus, FaMinus, FaShoppingCart, FaArrowLeft, FaCoins } from "react-icons/fa";
import { getStore } from "../../api/storeApi";
import api from "../../api/api";
import surplusFoodApi from "../../api/surplusFoodApi";
import { useAuth } from "../../store/AuthContext";
import "./TakeoutOrderPage.css";
import "./SurplusZonePage.css";

const initialCart = {
  items: [],
  notes: "",
  pickupAt: "",
  contact: { name: "", phone: "" },
};

const formatPrice = (value) => Math.round(Number(value) || 0);

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD_ITEM": {
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
    case "DECREMENT_ITEM": {
      const items = state.items
        .map((item) =>
          item.id === action.payload
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0);
      return { ...state, items };
    }
    case "CLEAR_CART":
      return { ...state, items: [] };
    case "UPDATE_NOTE":
      return { ...state, notes: action.payload };
    case "UPDATE_PICKUP":
      return { ...state, pickupAt: action.payload };
    case "UPDATE_CONTACT":
      return { ...state, contact: { ...state.contact, ...action.payload } };
    default:
      return state;
  }
}

function SurplusZonePage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [surplusItems, setSurplusItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState("");
  const categoryRefs = useRef({});
  const [greenPoints, setGreenPoints] = useState(null);
  const [redemptionRules, setRedemptionRules] = useState([]);
  const [showGreenPointSection, setShowGreenPointSection] = useState(false);
  const greenPointRef = useRef(null);

  const initialCartState = location.state?.cart || initialCart;
  const tableLabel = location.state?.tableLabel; // 從內用菜單來的桌號
  const [cart, dispatch] = useReducer(cartReducer, initialCartState);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const [storeRes, surplusRes, categoriesRes] = await Promise.all([
          getStore(storeId),
          api.get('/surplus/foods/', { params: { store: storeId } }),
          api.get('/surplus/foods/categories/', { params: { store: storeId } })
        ]);

        setStore(storeRes.data);
        setSurplusItems(surplusRes.data || []);
        setCategories(categoriesRes.data || []);

        // 預設選中第一個類別
        if (categoriesRes.data && categoriesRes.data.length > 0) {
          setSelectedCategory(categoriesRes.data[0].id);
        }
      } catch (err) {
        console.error('載入惜福品失敗:', err);
        setError("載入資料失敗，請稍後再試");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [storeId]);

  // 綠色點數查詢（登入用戶）
  useEffect(() => {
    async function loadGreenPoints() {
      if (user && storeId) {
        try {
          const data = await surplusFoodApi.getUserGreenPoints(storeId);
          setGreenPoints(data.points);
        } catch (err) {
          console.log('綠色點數查詢失敗:', err);
        }
      }
    }
    loadGreenPoints();
  }, [user, storeId]);

  // 載入兌換規則
  useEffect(() => {
    async function loadRedemptionRules() {
      if (storeId) {
        try {
          const data = await surplusFoodApi.getPublicRedemptionRules(storeId);
          setRedemptionRules(data);
        } catch (err) {
          console.log('兌換規則載入失敗:', err);
        }
      }
    }
    loadRedemptionRules();
  }, [storeId]);

  // 選擇兌換規則
  const handleSelectRedemption = (rule) => {
    if (greenPoints === null || greenPoints < rule.required_points) {
      alert(`您的點數不足，需要 ${rule.required_points} 點`);
      return;
    }
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        id: `redemption_${rule.id}`,
        name: rule.name,
        price: rule.redemption_type === 'discount' ? -rule.discount_value : 0,
        itemType: 'redemption',
        redemptionRule: rule
      }
    });
    // 不彈窗提示，直接加入購物車
  };

  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.price || item.discounted_price) * item.quantity, 0),
    [cart.items]
  );

  const handleGoToCart = () => {
    // 判斷是從內用還是外帶進來
    if (tableLabel) {
      // 從內用進來，導向內用購物車
      navigate(`/dinein/${storeId}/cart`, {
        state: {
          cart: cart,
          store: store,
          storeId: storeId,
          tableLabel: tableLabel
        }
      });
    } else {
      // 從外帶進來，導向外帶購物車
      navigate(`/takeout/${storeId}/cart`, {
        state: {
          cart: cart,
          store: store,
          storeId: storeId
        }
      });
    }
  };

  const handleBackToMenu = () => {
    // 判斷是從內用還是外帶進來
    if (tableLabel) {
      // 返回內用菜單
      navigate(`/store/${storeId}/dine-in/menu?table=${tableLabel}`, {
        state: {
          cart: cart
        }
      });
    } else {
      // 返回外帶菜單
      navigate(`/store/${storeId}/takeout`, {
        state: {
          cart: cart,
          returnFromSurplus: true
        }
      });
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
    <div className="takeout-page surplus-zone-page container" style={{ marginTop: "70px" }}>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="mb-1">{store?.name} - 惜福專區</h2>
              <p className="text-muted mb-2">{store?.address}</p>
              <div className="d-flex flex-wrap gap-3 align-items-center">
                <span>
                  <i className="bi bi-telephone me-1" />
                  {store?.phone}
                </span>
                {user && greenPoints !== null && (
                  <span className="green-points-badge">
                    <FaCoins style={{ color: '#4CAF50', marginRight: '4px' }} />
                    綠色點數：{greenPoints} 點
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12">
          {/* 導航標籤列：返回按鈕 + 類別標籤 + 購物車按鈕 */}
          <div className="category-nav-tabs mb-3">
            <div className="nav-tabs-scroll">


              {/* 類別標籤 */}
              {categories.length > 0 && categories.map((category) => {
                const categoryProducts = surplusItems.filter(item => item.category === category.id);
                return (
                  <button
                    key={category.id}
                    className={`category-nav-btn ${selectedCategory === category.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      categoryRefs.current[category.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    {category.name}
                    {categoryProducts.length > 0 && (
                      <span className="category-count">{categoryProducts.length}</span>
                    )}
                  </button>
                );
              })}

              {/* 購物車按鈕 */}
              <button
                className="cart-nav-btn"
                onClick={handleGoToCart}
              >
                <FaShoppingCart size={18} />
                {cart.items.length > 0 && (
                  <span className="cart-badge">{cart.items.length}</span>
                )}
              </button>

              {/* 綠色點數按鈕 */}
              {redemptionRules.length > 0 && (
                <button
                  className={`category-nav-btn green-points-nav-btn ${showGreenPointSection ? 'active' : ''}`}
                  onClick={() => {
                    setShowGreenPointSection(!showGreenPointSection);
                    setSelectedCategory(null);
                    setTimeout(() => {
                      greenPointRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                >
                  綠色點數
                </button>
              )}

              {/* 返回菜單按鈕 */}
              <button
                className="back-to-menu-btn"
                onClick={handleBackToMenu}
              >
                {tableLabel ? '內用菜單' : '外帶菜單'}
              </button>
            </div>
          </div>

          {/* 綠色點數兌換區 */}
          {showGreenPointSection && redemptionRules.length > 0 && (
            <div ref={greenPointRef} className="card shadow-sm mb-4 takeout-card category-section">
              <div className="card-header takeout-card-header" style={{ background: 'linear-gradient(135deg, #4CAF50, #2E7D32)' }}>
                <strong>綠色點數兌換</strong>
                <small className="d-block mt-1" style={{ opacity: 0.9 }}>
                  您的點數：{greenPoints !== null ? greenPoints : '請登入查看'} 點
                </small>
              </div>
              <div className="card-body">
                {redemptionRules.map((rule) => {
                  const canRedeem = greenPoints !== null && greenPoints >= rule.required_points;
                  const cartItem = cart.items.find(item => item.id === `redemption_${rule.id}`);
                  const quantity = cartItem ? cartItem.quantity : 0;
                  const maxQty = rule.redemption_type === 'discount' ? 1 : (rule.max_quantity_per_order || 1);

                  return (
                    <div
                      key={rule.id}
                      className="d-flex justify-content-between align-items-center border-bottom py-3"
                    >
                      <div className="flex-grow-1">
                        <h5 className="mb-1">
                          {rule.name}
                          <span className={`badge ms-2 ${rule.redemption_type === 'discount' ? 'bg-warning text-dark' : 'bg-info'}`}>
                            {rule.redemption_type === 'discount' ? '折扣' : '商品'}
                          </span>
                        </h5>
                        <p className="text-muted mb-1">
                          需要點數：<strong className="text-success">{rule.required_points} 點</strong>
                          {rule.redemption_type === 'product' && maxQty > 1 && (
                            <span className="ms-2 text-muted">（單筆最多 {maxQty} 份）</span>
                          )}
                        </p>
                        {rule.redemption_type === 'discount' && (
                          <p className="text-success mb-0">折抵 NT$ {rule.discount_value}</p>
                        )}
                        {rule.redemption_type === 'product' && rule.product_name && (
                          <p className="text-success mb-0">免費商品：{rule.product_name}</p>
                        )}
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {quantity > 0 ? (
                          <div className="quantity-control d-flex align-items-center gap-2">
                            <button
                              className="quantity-btn rounded-circle"
                              onClick={() => dispatch({ type: 'DECREMENT_ITEM', payload: `redemption_${rule.id}` })}
                            >
                              <FaMinus size={12} />
                            </button>
                            <span className="quantity-display">{quantity}</span>
                            <button
                              className="quantity-btn rounded-circle"
                              onClick={() => handleSelectRedemption(rule)}
                              disabled={quantity >= maxQty || !canRedeem}
                              style={(quantity >= maxQty || !canRedeem) ? { opacity: 0.5 } : {}}
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="add-btn rounded-circle"
                            onClick={() => handleSelectRedemption(rule)}
                            disabled={!canRedeem}
                            style={!canRedeem ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            title={!canRedeem ? '點數不足' : '添加兌換'}
                          >
                            <FaPlus size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 按類別分組顯示惜福品 */}
          {categories.length === 0 ? (
            <div className="card shadow-sm mb-4 takeout-card">
              <div className="card-header takeout-card-header">
                <strong>惜福商品</strong>
              </div>
              <div className="card-body">
                {surplusItems.length === 0 && (
                  <p className="text-muted">目前尚無惜福商品。</p>
                )}
                {surplusItems.map((item) => {
                  const cartItem = cart.items.find((ci) => ci.id === item.id);
                  const quantity = cartItem ? cartItem.quantity : 0;
                  // 修復：直接使用 surplus_price 和 original_price，不用 || 逻輯
                  const surplusPrice = Number(item.surplus_price) || 0;
                  const originalPrice = Number(item.original_price) || 0;
                  const hasDiscount = originalPrice > 0 && surplusPrice > 0 && originalPrice > surplusPrice;

                  return (
                    <div
                      key={item.id}
                      className="menu-item d-flex justify-content-between align-items-center border-bottom py-3"
                    >
                      {item.image && (
                        <div className="me-3">
                          <img
                            src={item.image.startsWith('http') ? item.image : `http://127.0.0.1:8000${item.image}`}
                            alt={item.title}
                            style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                          />
                        </div>
                      )}
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2">
                          <h5 className="mb-1">{item.title}</h5>
                          {item.condition && (
                            <span className="badge bg-warning text-dark condition-badge">
                              {item.condition === 'near_expiry' ? '即期品' : item.condition === 'surplus' ? '剩餘品' : '外包裝損傷'}
                            </span>
                          )}
                          <span className="badge bg-info text-dark">剩餘 {item.remaining_quantity}</span>
                        </div>
                        <p className="text-muted mb-1 small">{item.description}</p>
                        {item.condition === 'near_expiry' && item.expiry_date && (
                          <p className="text-danger mb-1 small">
                            <strong>到期日：{new Date(item.expiry_date).toLocaleDateString('zh-TW')}</strong>
                          </p>
                        )}
                        <div className="price-container">
                          {hasDiscount && (
                            <span className="original-price">
                              原價 NT$ {formatPrice(originalPrice)}
                            </span>
                          )}
                          <strong className="surplus-price">NT$ {formatPrice(surplusPrice)}</strong>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {quantity > 0 ? (
                          <div className="quantity-control d-flex align-items-center gap-2">
                            <button
                              className="quantity-btn rounded-circle"
                              onClick={() => dispatch({ type: "DECREMENT_ITEM", payload: item.id })}
                            >
                              <FaMinus size={12} />
                            </button>
                            <span className="quantity-display">{quantity}</span>
                            <button
                              className="quantity-btn rounded-circle"
                              onClick={() =>
                                dispatch({
                                  type: "ADD_ITEM",
                                  payload: {
                                    ...item,
                                    price: surplusPrice,
                                    itemType: 'surplus', // 標記為惜福品
                                    original_price: originalPrice // 保留原價資訊
                                  },
                                })
                              }
                              disabled={item.remaining_quantity <= quantity}
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="add-btn rounded-circle"
                            onClick={() =>
                              dispatch({
                                type: "ADD_ITEM",
                                payload: {
                                  ...item,
                                  price: surplusPrice,
                                  itemType: 'surplus', // 標記為惜福品
                                  original_price: originalPrice // 保留原價資訊
                                },
                              })
                            }
                            disabled={item.remaining_quantity <= 0}
                          >
                            <FaPlus size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            categories.map((category) => {
              const categoryItems = surplusItems.filter(item => item.category === category.id);
              if (categoryItems.length === 0) return null;

              return (
                <div
                  key={category.id}
                  ref={(el) => (categoryRefs.current[category.id] = el)}
                  className="category-section card shadow-sm mb-4 takeout-card"
                >
                  <div className="card-header takeout-card-header">
                    <strong>{category.name}</strong>
                    {category.description && (
                      <small className="ms-2 text-white-50">{category.description}</small>
                    )}
                  </div>
                  <div className="card-body">
                    {categoryItems.map((item) => {
                      const cartItem = cart.items.find((ci) => ci.id === item.id);
                      const quantity = cartItem ? cartItem.quantity : 0;
                      // 修復：直接使用 surplus_price 和 original_price，不用 || 逻輯
                      const surplusPrice = Number(item.surplus_price) || 0;
                      const originalPrice = Number(item.original_price) || 0;
                      const hasDiscount = originalPrice > 0 && surplusPrice > 0 && originalPrice > surplusPrice;

                      return (
                        <div
                          key={item.id}
                          className="menu-item d-flex justify-content-between align-items-center border-bottom py-3"
                        >
                          {item.image && (
                            <div className="me-3">
                              <img
                                src={item.image.startsWith('http') ? item.image : `http://127.0.0.1:8000${item.image}`}
                                alt={item.title}
                                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                              />
                            </div>
                          )}
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2">
                              <h5 className="mb-1">{item.title}</h5>
                              {item.condition && (
                                <span className="badge bg-warning text-dark condition-badge">
                                  {item.condition === 'near_expiry' ? '即期品' : item.condition === 'surplus' ? '剩餘品' : '外包裝損傷'}
                                </span>
                              )}
                              <span className="badge bg-info text-dark">剩餘 {item.remaining_quantity}</span>
                            </div>
                            <p className="text-muted mb-1 small">{item.description}</p>
                            {item.condition === 'near_expiry' && item.expiry_date && (
                              <p className="text-danger mb-1 small">
                                <strong>到期日：{new Date(item.expiry_date).toLocaleDateString('zh-TW')}</strong>
                              </p>
                            )}
                            <div className="price-container">
                              {hasDiscount && (
                                <span className="original-price">
                                  原價 NT$ {formatPrice(originalPrice)}
                                </span>
                              )}
                              <strong className="surplus-price">惜福價 NT$ {formatPrice(surplusPrice)}</strong>
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            {quantity > 0 ? (
                              <div className="quantity-control d-flex align-items-center gap-2">
                                <button
                                  className="quantity-btn rounded-circle"
                                  onClick={() => dispatch({ type: "DECREMENT_ITEM", payload: item.id })}
                                >
                                  <FaMinus size={12} />
                                </button>
                                <span className="quantity-display">{quantity}</span>
                                <button
                                  className="quantity-btn rounded-circle"
                                  onClick={() =>
                                    dispatch({
                                      type: "ADD_ITEM",
                                      payload: {
                                        ...item,
                                        price: surplusPrice,
                                        itemType: 'surplus', // 標記為惜福品
                                        original_price: originalPrice // 保留原價資訊
                                      },
                                    })
                                  }
                                  disabled={item.remaining_quantity <= quantity}
                                >
                                  <FaPlus size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="add-btn rounded-circle"
                                onClick={() =>
                                  dispatch({
                                    type: "ADD_ITEM",
                                    payload: {
                                      ...item,
                                      price: surplusPrice,
                                      itemType: 'surplus', // 標記為惜福品
                                      original_price: originalPrice // 保留原價資訊
                                    },
                                  })
                                }
                                disabled={item.remaining_quantity <= 0}
                              >
                                <FaPlus size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default SurplusZonePage;