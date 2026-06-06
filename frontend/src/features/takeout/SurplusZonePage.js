import React, { useEffect, useMemo, useReducer, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaPlus, FaMinus, FaShoppingCart, FaCoins } from "react-icons/fa";
import { getStore } from "../../api/storeApi";
import api from "../../api/api";
import surplusFoodApi from "../../api/surplusFoodApi";
import { useAuth } from "../../store/AuthContext";
import SkeletonLoader from '../../components/common/SkeletonLoader';
import takeoutStyles from './TakeoutOrderPage.module.css';
import styles from './SurplusZonePage.module.css';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState("");
  const categoryRefs = useRef({});
  const menuScrollRef = useRef(null);
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

  const totalQuantity = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart.items]
  );

  const filteredSurplusItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return surplusItems;

    return surplusItems.filter((item) => {
      const category = categories.find((cat) => cat.id === item.category);
      const searchableText = [
        item.title,
        item.name,
        item.description,
        item.category_name,
        category?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [categories, searchTerm, surplusItems]);

  const displayCategories = useMemo(() => {
    if (!categories.length) {
      return filteredSurplusItems.length
        ? [{ id: 'all-surplus', name: '全部', description: '所有惜福商品' }]
        : [];
    }

    return categories.filter((category) =>
      filteredSurplusItems.some((item) => item.category === category.id)
    );
  }, [categories, filteredSurplusItems]);

  useEffect(() => {
    if (!displayCategories.length) return;
    setSelectedCategory((current) =>
      displayCategories.some((category) => category.id === current)
        ? current
        : displayCategories[0].id
    );
  }, [displayCategories]);

  const scrollToCategory = (categoryId) => {
    const scrollContainer = menuScrollRef.current;
    const target = categoryRefs.current[categoryId];
    if (!scrollContainer || !target) return;
    setSelectedCategory(categoryId);
    setShowGreenPointSection(false);
    scrollContainer.scrollTo({
      top: target.offsetTop - 14,
      behavior: 'smooth',
    });
  };

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
    return <SkeletonLoader variant="cards" cards={8} />;
  }

  if (error) {
    return (
      <div className={`${takeoutStyles['takeout-page']} container py-5`}>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const storeImageSource = store?.first_image || store?.images?.[0]?.image || store?.images?.[0]?.image_url || '';
  const storeImageUrl = storeImageSource
    ? (storeImageSource.startsWith('http') ? storeImageSource : `http://127.0.0.1:8000${storeImageSource}`)
    : '';

  const renderSurplusItemCard = (item) => {
    const cartItem = cart.items.find((ci) => ci.id === item.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    const surplusPrice = Number(item.surplus_price) || 0;
    const originalPrice = Number(item.original_price) || 0;
    const hasDiscount = originalPrice > 0 && surplusPrice > 0 && originalPrice > surplusPrice;
    const imageUrl = item.image
      ? (item.image.startsWith('http') ? item.image : `http://127.0.0.1:8000${item.image}`)
      : '';
    const conditionText = item.condition === 'near_expiry'
      ? '即期品'
      : item.condition === 'surplus'
        ? '剩餘品'
        : item.condition
          ? '外包裝損傷'
          : '';

    return (
      <article key={item.id} className={`${takeoutStyles['menu-product-card']} ${styles['surplus-product-card']}`}>
        <span className={takeoutStyles['card-shine']} aria-hidden="true" />
        <span className={takeoutStyles['card-glow']} aria-hidden="true" />
        {conditionText && <span className={takeoutStyles['card-badge']}>{conditionText}</span>}

        <div className={takeoutStyles['menu-product-content']}>
          <div className={takeoutStyles['menu-product-image-wrap']}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.title}
                className={takeoutStyles['menu-product-image']}
              />
            ) : (
              <div className={takeoutStyles['menu-product-image-fallback']} aria-hidden="true">DV</div>
            )}
          </div>

          <div className={takeoutStyles['menu-product-info']}>
            <h5 className={takeoutStyles['menu-product-title']}>{item.title}</h5>
            <p className={takeoutStyles['menu-product-subtitle']}>
              剩餘 {item.remaining_quantity} 份
              {item.expiry_date ? ` · ${new Date(item.expiry_date).toLocaleDateString('zh-TW')}` : ''}
            </p>
            <p className={takeoutStyles['menu-product-description']}>
              {item.description || '惜福精選餐點'}
            </p>
            <div className={takeoutStyles['menu-product-footer']}>
              <div className={styles['surplus-price-stack']}>
                {hasDiscount && (
                  <span className={styles['original-price']}>原價 NT$ {formatPrice(originalPrice)}</span>
                )}
                <strong className={`${takeoutStyles['menu-product-price']} ${styles['surplus-price']}`}>
                  惜福價 NT$ {formatPrice(surplusPrice)}
                </strong>
              </div>
              {quantity === 0 ? (
                <button
                  className={`btn rounded-circle ${takeoutStyles['card-action-btn']}`}
                  onClick={() =>
                    dispatch({
                      type: "ADD_ITEM",
                      payload: {
                        ...item,
                        price: surplusPrice,
                        itemType: 'surplus',
                        original_price: originalPrice
                      },
                    })
                  }
                  disabled={item.remaining_quantity <= 0}
                  title="加入購物車"
                >
                  <FaPlus />
                </button>
              ) : (
                <div className={`${takeoutStyles['product-qty-control']} d-flex align-items-center gap-2`}>
                  <button
                    className={`btn rounded-circle ${takeoutStyles['product-qty-btn']}`}
                    onClick={() => dispatch({ type: "DECREMENT_ITEM", payload: item.id })}
                  >
                    <FaMinus />
                  </button>
                  <span className={takeoutStyles['quantity-display']}>{quantity}</span>
                  <button
                    className={`btn rounded-circle ${takeoutStyles['product-qty-btn']}`}
                    onClick={() =>
                      dispatch({
                        type: "ADD_ITEM",
                        payload: {
                          ...item,
                          price: surplusPrice,
                          itemType: 'surplus',
                          original_price: originalPrice
                        },
                      })
                    }
                    disabled={item.remaining_quantity <= quantity}
                  >
                    <FaPlus />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className={`${takeoutStyles['takeout-page']} ${styles['surplus-zone-page']}`}>
      <section className={takeoutStyles['takeout-store-card']}>
        <div className={takeoutStyles['takeout-store-image']}>
          {storeImageUrl ? (
            <img src={storeImageUrl} alt={store?.name} />
          ) : (
            <span>DV</span>
          )}
        </div>
        <div className={takeoutStyles['takeout-store-copy']}>
          <h1>{store?.name} - 惜福專區</h1>
          <p><i className="bi bi-geo-alt" aria-hidden="true"></i>{store?.address}</p>
          <div>
            {store?.phone && <span><i className="bi bi-telephone" aria-hidden="true"></i>{store.phone}</span>}
            {user && greenPoints !== null && (
              <span className={takeoutStyles['green-points-badge']}>
                <FaCoins />
                綠色點數：{greenPoints} 點
              </span>
            )}
          </div>
        </div>
      </section>

      <section className={takeoutStyles['takeout-menu-shell']}>
        <aside className={takeoutStyles['takeout-category-sidebar']}>
          {displayCategories.map((category) => {
            const categoryProducts = category.id === 'all-surplus'
              ? filteredSurplusItems
              : filteredSurplusItems.filter((item) => item.category === category.id);
            return (
              <button
                key={category.id}
                type="button"
                className={`${takeoutStyles['side-category-btn']} ${selectedCategory === category.id ? takeoutStyles.active : ''}`}
                onClick={() => scrollToCategory(category.id)}
              >
                <i className="bi bi-grid" aria-hidden="true"></i>
                <span>
                  <strong>{category.name}</strong>
                  <small>{category.description || `${categoryProducts.length} 項商品`}</small>
                </span>
              </button>
            );
          })}

          {redemptionRules.length > 0 && (
            <button
              type="button"
              className={`${takeoutStyles['side-category-btn']} ${showGreenPointSection ? takeoutStyles.active : ''}`}
              onClick={() => {
                setShowGreenPointSection((current) => {
                  const next = !current;
                  if (next) {
                    setTimeout(() => greenPointRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
                  }
                  return next;
                });
              }}
            >
              <i className="bi bi-star" aria-hidden="true"></i>
              <span>
                <strong>點數兌換</strong>
                <small>使用綠色點數</small>
              </span>
            </button>
          )}

          <button
            type="button"
            className={takeoutStyles['side-category-btn']}
            onClick={handleBackToMenu}
          >
            <i className="bi bi-arrow-left" aria-hidden="true"></i>
            <span>
              <strong>{tableLabel ? '內用菜單' : '外帶菜單'}</strong>
              <small>返回一般菜單</small>
            </span>
          </button>
        </aside>

        <div className={takeoutStyles['takeout-menu-main']}>
          <div className={takeoutStyles['takeout-menu-toolbar']}>
            <div className={takeoutStyles['takeout-filter-pills']}>
              {displayCategories[0] && (
                <button
                  type="button"
                  className={takeoutStyles.active}
                  onClick={() => scrollToCategory(displayCategories[0].id)}
                >
                  <i className="bi bi-grid" aria-hidden="true"></i>全部
                </button>
              )}
              {displayCategories.slice(0, 2).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => scrollToCategory(category.id)}
                >
                  {category.name}
                  <span>{category.id === 'all-surplus' ? filteredSurplusItems.length : filteredSurplusItems.filter((item) => item.category === category.id).length}</span>
                </button>
              ))}
            </div>
            <label className={takeoutStyles['takeout-search-box']}>
              <i className="bi bi-search" aria-hidden="true"></i>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="搜尋惜福商品"
                aria-label="搜尋惜福商品"
              />
            </label>
            <button
              type="button"
              className={takeoutStyles['takeout-cart-button']}
              onClick={handleGoToCart}
              disabled={cart.items.length === 0}
            >
              <FaShoppingCart />
              購物車
              {totalQuantity > 0 && <span>{totalQuantity}</span>}
              <strong>共 NT$ {formatPrice(total)}</strong>
            </button>
          </div>

          <div className={takeoutStyles['takeout-scroll-area']} ref={menuScrollRef}>
            {showGreenPointSection && redemptionRules.length > 0 && (
              <section ref={greenPointRef} className={takeoutStyles['menu-category-section']}>
                <header>
                  <div>
                    <i className="bi bi-star" aria-hidden="true"></i>
                    <h2>點數兌換</h2>
                    <p>您的點數：{greenPoints !== null ? greenPoints : '請登入查看'} 點</p>
                  </div>
                </header>
                <div className={takeoutStyles['redemption-list']}>
                  {redemptionRules.map((rule) => {
                    const canRedeem = greenPoints !== null && greenPoints >= rule.required_points;
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        className={takeoutStyles['redemption-card']}
                        onClick={() => handleSelectRedemption(rule)}
                        disabled={!canRedeem}
                      >
                        <strong>{rule.name}</strong>
                        <span>{rule.required_points} 點</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {displayCategories.length === 0 ? (
              <div className={takeoutStyles['takeout-empty']}>目前尚無惜福商品。</div>
            ) : (
              displayCategories.map((category) => {
                const categoryItems = category.id === 'all-surplus'
                  ? filteredSurplusItems
                  : filteredSurplusItems.filter(item => item.category === category.id);
                if (categoryItems.length === 0) return null;

                return (
                  <section
                    key={category.id}
                    ref={(el) => { categoryRefs.current[category.id] = el; }}
                    className={takeoutStyles['menu-category-section']}
                  >
                    <header>
                      <div>
                        <i className="bi bi-basket" aria-hidden="true"></i>
                        <h2>{category.name}</h2>
                        <p>{category.description || '惜福精選，限量優惠'}</p>
                      </div>
                      <button type="button" onClick={() => scrollToCategory(category.id)}>
                        查看全部 <i className="bi bi-chevron-right" aria-hidden="true"></i>
                      </button>
                    </header>
                    <div className={takeoutStyles['menu-product-grid']}>
                      {categoryItems.map(renderSurplusItemCard)}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default SurplusZonePage;
