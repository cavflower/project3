import React, { useEffect, useMemo, useReducer, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaPlus, FaMinus, FaShoppingCart, FaCoins } from "react-icons/fa";
import { getStore } from "../../api/storeApi";
import { getTakeoutProducts } from "../../api/orderApi";
import { getPublicProductCategories, getPublicSpecificationGroups } from "../../api/productApi";
import surplusFoodApi from "../../api/surplusFoodApi";
import { useAuth } from "../../store/AuthContext";
import ProductSpecificationModal from "../../components/common/ProductSpecificationModal";
import styles from './TakeoutOrderPage.module.css';

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
      // 如果商品有規格，使用 specKey 來區分不同規格組合
      const itemKey = action.payload.specKey
        ? `${action.payload.id}_${action.payload.specKey}`
        : action.payload.id.toString();

      const existing = state.items.find((item) => {
        const existingKey = item.specKey
          ? `${item.id}_${item.specKey}`
          : item.id.toString();
        return existingKey === itemKey;
      });

      const items = existing
        ? state.items.map((item) => {
          const existingKey = item.specKey
            ? `${item.id}_${item.specKey}`
            : item.id.toString();
          return existingKey === itemKey
            ? { ...item, quantity: item.quantity + 1 }
            : item;
        })
        : [...state.items, { ...action.payload, quantity: 1, cartKey: itemKey }];
      return { ...state, items };
    }
    case "DECREMENT_ITEM": {
      const items = state.items
        .map((item) =>
          item.cartKey === action.payload
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

function TakeoutOrderPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState("");
  const categoryRefs = useRef({});
  const [greenPoints, setGreenPoints] = useState(null);
  const [redemptionRules, setRedemptionRules] = useState([]);
  const [showGreenPointSection, setShowGreenPointSection] = useState(false);
  const greenPointRef = useRef(null);

  // 規格選擇 Modal 狀態
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSpecMap, setProductSpecMap] = useState({});

  // 如果從購物車頁面返回，恢復購物車狀態
  const initialCartState = location.state?.cart || initialCart;
  const [cart, dispatch] = useReducer(cartReducer, initialCartState);

  // 處理商品點擊：檢查是否有規格
  const handleProductClick = async (product) => {
    if (product.is_orderable === false || product.is_sold_out_by_ingredients) {
      return;
    }

    try {
      const response = await getPublicSpecificationGroups(product.id);
      const specs = response.data || [];
      const hasSpecs = specs.length > 0 && specs.some(g => g.options && g.options.length > 0);
      setProductSpecMap(prev => ({ ...prev, [product.id]: hasSpecs }));

      if (hasSpecs) {
        // 有規格，顯示 Modal
        setSelectedProduct(product);
        setShowSpecModal(true);
      } else {
        // 無規格，直接加入購物車
        dispatch({ type: "ADD_ITEM", payload: { ...product, itemType: 'regular' } });
      }
    } catch (err) {
      console.error('檢查規格失敗:', err);
      // 失敗時直接加入
      dispatch({ type: "ADD_ITEM", payload: { ...product, itemType: 'regular' } });
    }
  };

  // 規格選擇完成
  const handleSpecConfirm = (productWithSpecs) => {
    dispatch({ type: "ADD_ITEM", payload: { ...productWithSpecs, itemType: 'regular' } });
    setShowSpecModal(false);
    setSelectedProduct(null);
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const storeRes = await getStore(storeId);
        setStore(storeRes.data);

        if (storeRes.data.enable_takeout === false) {
          setMenuItems([]);
          setCategories([]);
          setError('店家目前已關閉外帶點餐功能。');
          return;
        }

        const [productsRes, categoriesRes] = await Promise.all([
          getTakeoutProducts(storeId),
          getPublicProductCategories(storeId)
        ]);

        setMenuItems(productsRes.data);
        setCategories(categoriesRes.data || []);

        // 預設選中第一個類別
        if (categoriesRes.data && categoriesRes.data.length > 0) {
          setSelectedCategory(categoriesRes.data[0].id);
        }
      } catch (err) {
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
          console.log('線色點數查詢失敗:', err);
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

  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cart.items]
  );

  const handleGoToCart = () => {
    // 只傳遞可序列化的資料，不傳遞 dispatch 函數
    navigate(`/takeout/${storeId}/cart`, {
      state: {
        cart: cart,
        store: store,
        storeId: storeId,
        greenPoints: greenPoints
      }
    });
  };

  // 選擇兌換規則
  const handleSelectRedemption = (rule) => {
    if (greenPoints === null || greenPoints < rule.required_points) {
      alert(`您的點數不足，需要 ${rule.required_points} 點`);
      return;
    }
    // 將兌換規則加入購物車
    dispatch({
      type: "ADD_ITEM",
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

  const renderMenuItemCard = (item) => {
    const cartItemsForProduct = cart.items.filter((ci) => ci.id === item.id);
    const quantity = cartItemsForProduct.reduce((sum, ci) => sum + ci.quantity, 0);
    const lastCartItem = cartItemsForProduct[cartItemsForProduct.length - 1];
    const isLinkedToSurplus = item.is_linked_to_surplus || false;
    const isSoldOutByIngredients = item.is_sold_out_by_ingredients || false;
    const isOrderable = item.is_orderable !== false;
    const isUnavailable = isLinkedToSurplus || !isOrderable;
    const imageUrl = item.image
      ? (item.image.startsWith('http') ? item.image : `http://127.0.0.1:8000${item.image}`)
      : '';
    const hasSpecs = productSpecMap[item.id] === true || cartItemsForProduct.some(ci => ci.specKey);
    const subtitle = item.category_name || item.category?.name || store?.name || 'DineVerse';
    const metaText = item.description
      ? item.description
      : (isSoldOutByIngredients ? '原物料不足，暫時無法供應' : '精選餐點');

    return (
      <article
        key={item.id}
        className={`${styles['menu-product-card']} ${isUnavailable ? styles['menu-product-card-disabled'] : ''}`}
      >
        <span className={styles['card-shine']} aria-hidden="true" />
        <span className={styles['card-glow']} aria-hidden="true" />
        {!isUnavailable && <span className={styles['card-badge']}>HOT</span>}

        <div className={styles['menu-product-content']}>
          <div className={styles['menu-product-image-wrap']}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.name}
                className={styles['menu-product-image']}
              />
            ) : (
              <div className={styles['menu-product-image-fallback']} aria-hidden="true">DV</div>
            )}
          </div>

          <div className={styles['menu-product-info']}>
            <h5 className={styles['menu-product-title']}>{item.name}</h5>
            <p className={styles['menu-product-subtitle']}>{subtitle}</p>
            <p className={styles['menu-product-description']}>{metaText}</p>
            {isLinkedToSurplus && <span className={styles['menu-product-meta']}>(已轉為惜福品)</span>}
            {!isLinkedToSurplus && isSoldOutByIngredients && <span className="badge bg-secondary ms-2">已售完</span>}
            <div className={styles['menu-product-footer']}>
              <strong className={styles['menu-product-price']}>NT$ {formatPrice(item.price)}</strong>
              {!isUnavailable && (
                hasSpecs ? (
                  <div className={styles['spec-action-wrap']}>
                    <button
                      className={`btn ${styles['spec-action-btn']}`}
                      onClick={() => handleProductClick(item)}
                      title="選擇"
                    >
                      <FaShoppingCart className={styles['spec-action-icon']} />
                      選擇
                    </button>
                    {quantity > 0 && <span className={styles['spec-selected-count']}>已選 {quantity}</span>}
                  </div>
                ) : quantity === 0 ? (
                  <button
                    className={`btn rounded-circle ${styles['card-action-btn']}`}
                    onClick={() => handleProductClick(item)}
                    title="加入購物車"
                  >
                    <FaPlus />
                  </button>
                ) : (
                  <div className={`${styles['product-qty-control']} d-flex align-items-center gap-2`}>
                    <button
                      className={`btn rounded-circle ${styles['product-qty-btn']}`}
                      onClick={() => dispatch({ type: "DECREMENT_ITEM", payload: lastCartItem?.cartKey })}
                    >
                      <FaMinus />
                    </button>
                    <span className={styles['quantity-display']}>{quantity}</span>
                    <button
                      className={`btn rounded-circle ${styles['product-qty-btn']}`}
                      onClick={() => handleProductClick(item)}
                    >
                      <FaPlus />
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  if (loading) {
    return (
      <div className={`${styles['takeout-page']} container py-5 text-center`}>
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-3">載入中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles['takeout-page']} container py-5`}>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className={`${styles['takeout-page']} container`} style={{ marginTop: "8px" }}>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="mb-1">{store?.name}</h2>
              <p className="text-muted mb-2">{store?.address}</p>
              <div className="d-flex flex-wrap gap-3 align-items-center">
                <span>
                  <i className="bi bi-telephone me-1" />
                  {store?.phone}
                </span>
                {user && greenPoints !== null && (
                  <span className={styles['green-points-badge']}>
                    <FaCoins style={{ color: '#4CAF50', marginRight: '4px' }} />
                    線色點數：{greenPoints} 點
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12">
          {/* 類別導航標籤 + 購物車按鈕 */}
          {categories.length > 0 && (
            <div className={`${styles['category-nav-tabs']} mb-3`}>
              <div className={styles['nav-tabs-scroll']}>
                {categories.map((category) => {
                  const categoryProducts = menuItems.filter(item => item.category === category.id);
                  return (
                    <button
                      key={category.id}
                      className={`${styles['category-nav-btn']} ${selectedCategory === category.id ? styles.active : ''}`}
                      onClick={() => {
                        setSelectedCategory(category.id);
                        categoryRefs.current[category.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      {category.name}
                      {categoryProducts.length > 0 && (
                        <span className={styles['category-count']}>{categoryProducts.length}</span>
                      )}
                    </button>
                  );
                })}


                {/* 購物車按鈕 */}
                <button
                  className={styles['cart-nav-btn']}
                  onClick={handleGoToCart}
                >
                  <FaShoppingCart size={18} />
                  {cart.items.length > 0 && (
                    <span className={styles['cart-badge']}>{cart.items.length}</span>
                  )}
                </button>

                {/* 綠色點數按鈕 */}
                {redemptionRules.length > 0 && (
                  <button
                    className={`${styles['category-nav-btn']} ${styles['green-points-nav-btn']} ${showGreenPointSection ? styles.active : ''}`}
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

                {/* 惜福專區按鈕 */}
                <button
                  className={`${styles['surplus-zone-nav-btn']} ${!store?.enable_surplus_food ? 'disabled' : ''}`}
                  onClick={() => store?.enable_surplus_food && navigate(`/store/${storeId}/surplus`, {
                    state: { cart: cart }
                  })}
                  disabled={!store?.enable_surplus_food}
                  style={!store?.enable_surplus_food ? { cursor: 'not-allowed', opacity: 0.5, backgroundColor: '#ccc' } : {}}
                >
                  惜福專區
                </button>
              </div>
            </div>
          )}

          {/* 綠色點數兌換區 */}
          {showGreenPointSection && redemptionRules.length > 0 && (
            <div ref={greenPointRef} className={`card shadow-sm mb-4 ${styles['takeout-card']} ${styles['category-section']}`}>
              <div className={`card-header ${styles['takeout-card-header']}`} style={{ background: 'linear-gradient(135deg, #4CAF50, #2E7D32)' }}>
                <strong>綠色點數兌換</strong>
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
                          <div className={`${styles['quantity-control']} d-flex align-items-center gap-2`}>
                            <button
                              className={`${styles['quantity-btn']} rounded-circle`}
                              onClick={() => dispatch({ type: "DECREMENT_ITEM", payload: `redemption_${rule.id}` })}
                            >
                              <FaMinus size={12} />
                            </button>
                            <span className={styles['quantity-display']}>{quantity}</span>
                            <button
                              className={`${styles['quantity-btn']} rounded-circle`}
                              onClick={() => handleSelectRedemption(rule)}
                              disabled={quantity >= maxQty || !canRedeem}
                              style={(quantity >= maxQty || !canRedeem) ? { opacity: 0.5 } : {}}
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className={`${styles['add-btn']} rounded-circle`}
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

          {/* 按類別分組顯示商品 */}
          {categories.length === 0 ? (
            <div className={`card shadow-sm mb-4 ${styles['takeout-card']}`}>
              <div className={`card-header ${styles['takeout-card-header']}`}>
                <strong>餐點列表</strong>
              </div>
              <div className="card-body">
                {menuItems.length === 0 && (
                  <p className="text-muted">目前尚無外帶餐點。</p>
                )}
                <div className={styles['menu-product-grid']}>
                  {menuItems.map(renderMenuItemCard)}
                </div>
              </div>
            </div>
          ) : (
            categories.map((category) => {
              const categoryProducts = menuItems.filter(item => item.category === category.id);
              if (categoryProducts.length === 0) return null;

              return (
                <div
                  key={category.id}
                  ref={el => categoryRefs.current[category.id] = el}
                  className={`card shadow-sm mb-4 ${styles['takeout-card']} ${styles['category-section']}`}
                >
                  <div className={`card-header ${styles['takeout-card-header']}`}>
                    <strong>{category.name}</strong>
                    {category.description && (
                      <small className="d-block mt-1" style={{ opacity: 0.9 }}>{category.description}</small>
                    )}
                  </div>
                  <div className="card-body">
                    <div className={styles['menu-product-grid']}>
                      {categoryProducts.map(renderMenuItemCard)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* 規格選擇 Modal */}
      {showSpecModal && selectedProduct && (
        <ProductSpecificationModal
          product={selectedProduct}
          onConfirm={handleSpecConfirm}
          onCancel={() => {
            setShowSpecModal(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}

export default TakeoutOrderPage;
