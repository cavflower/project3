import React, { useEffect, useMemo, useReducer, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaPlus, FaMinus, FaShoppingCart, FaArrowLeft } from "react-icons/fa";
import { getStore } from "../../api/storeApi";
import api from "../../api/api";
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
  
  const initialCartState = location.state?.cart || initialCart;
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

  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.price || item.discounted_price) * item.quantity, 0),
    [cart.items]
  );

  const handleGoToCart = () => {
    navigate(`/takeout/${storeId}/cart`, {
      state: { 
        cart: cart,
        store: store,
        storeId: storeId 
      }
    });
  };

  const handleBackToMenu = () => {
    navigate(`/store/${storeId}/takeout`, {
      state: { 
        cart: cart,
        returnFromSurplus: true // 標記從惜福專區返回
      }
    });
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
              <div className="d-flex flex-wrap gap-3">
                <span>
                  <i className="bi bi-telephone me-1" />
                  {store?.phone}
                </span>
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
             {/* 返回外帶菜單按鈕 */}
              <button
                className="back-to-menu-btn"
                onClick={handleBackToMenu}
              >
                外帶菜單
              </button>
            </div>
          </div>

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
