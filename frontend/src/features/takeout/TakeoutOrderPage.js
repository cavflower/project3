import React, { useEffect, useMemo, useReducer, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaPlus, FaMinus, FaShoppingCart, FaCoins } from "react-icons/fa";
import { getStore } from "../../api/storeApi";
import { getTakeoutProducts } from "../../api/orderApi";
import { getPublicProductCategories, getPublicSpecificationGroups } from "../../api/productApi";
import surplusFoodApi from "../../api/surplusFoodApi";
import { useAuth } from "../../store/AuthContext";
import ProductSpecificationModal from "../../components/common/ProductSpecificationModal";
import SkeletonLoader from "../../components/common/SkeletonLoader";
import styles from './TakeoutOrderPage.module.css';

const initialCart = {
  items: [],
  notes: "",
  pickupAt: "",
  contact: { name: "", phone: "" },
};

const formatPrice = (value) => Math.round(Number(value) || 0);

const getUserDisplayName = (user) => (
  user?.name ||
  user?.username ||
  (user?.email ? user.email.split('@')[0] : '') ||
  ''
);

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
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState("");
  const categoryRefs = useRef({});
  const menuScrollRef = useRef(null);
  const [greenPoints, setGreenPoints] = useState(null);
  const [redemptionRules, setRedemptionRules] = useState([]);
  const [showGreenPointSection, setShowGreenPointSection] = useState(false);
  const greenPointRef = useRef(null);

  // 規格選擇 Modal 狀態
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSpecMap, setProductSpecMap] = useState({});
  const [productSpecGroups, setProductSpecGroups] = useState({});

  // 如果從購物車頁面返回，恢復購物車狀態
  const initialCartState = useMemo(() => {
    const savedCart = location.state?.cart || initialCart;
    return {
      ...savedCart,
      contact: {
        ...savedCart.contact,
        name: savedCart.contact?.name || getUserDisplayName(user),
        phone: savedCart.contact?.phone || user?.phone_number || '',
      },
    };
  }, [location.state?.cart, user]);
  const [cart, dispatch] = useReducer(cartReducer, initialCartState);

  useEffect(() => {
    if (!user) return;

    dispatch({
      type: "UPDATE_CONTACT",
      payload: {
        name: cart.contact?.name || getUserDisplayName(user),
        phone: cart.contact?.phone || user.phone_number || '',
      },
    });
  }, [cart.contact?.name, cart.contact?.phone, user]);

  // 處理商品點擊：檢查是否有規格
  const handleProductClick = async (product) => {
    if (product.is_orderable === false || product.is_sold_out_by_ingredients) {
      return;
    }

    try {
      const cachedSpecs = productSpecGroups[product.id];
      const specs = Array.isArray(cachedSpecs)
        ? cachedSpecs
        : (await getPublicSpecificationGroups(product.id)).data || [];
      const hasSpecs = specs.length > 0 && specs.some(g => g.options && g.options.length > 0);
      setProductSpecMap(prev => ({ ...prev, [product.id]: hasSpecs }));
      setProductSpecGroups(prev => ({ ...prev, [product.id]: specs }));

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
        const [storeRes, productsRes, categoriesRes] = await Promise.all([
          getStore(storeId),
          getTakeoutProducts(storeId),
          getPublicProductCategories(storeId)
        ]);
        setStore(storeRes.data);

        if (storeRes.data.enable_takeout === false) {
          setMenuItems([]);
          setCategories([]);
          setError('店家目前已關閉外帶點餐功能。');
          return;
        }

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

  const totalQuantity = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart.items]
  );

  const filteredMenuItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return menuItems;

    return menuItems.filter((item) => {
      const category = categories.find((cat) => cat.id === item.category);
      const searchableText = [
        item.name,
        item.description,
        item.category_name,
        item.category?.name,
        category?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [categories, menuItems, searchTerm]);

  const displayCategories = useMemo(() => {
    if (!categories.length) {
      return filteredMenuItems.length
        ? [{ id: 'all-products', name: '全部', description: '所有商品' }]
        : [];
    }
    return categories.filter((category) =>
      filteredMenuItems.some((item) => item.category === category.id)
    );
  }, [categories, filteredMenuItems]);

  useEffect(() => {
    if (!displayCategories.length) return;
    setSelectedCategory((current) =>
      displayCategories.some((category) => category.id === current)
        ? current
        : displayCategories[0].id
    );
  }, [displayCategories]);

  useEffect(() => {
    const scrollContainer = menuScrollRef.current;
    if (!scrollContainer || displayCategories.length === 0) return undefined;

    let ticking = false;
    const updateActiveCategory = () => {
      ticking = false;
      const containerTop = scrollContainer.getBoundingClientRect().top;
      let activeId = displayCategories[0].id;

      displayCategories.forEach((category) => {
        const section = categoryRefs.current[category.id];
        if (!section) return;
        const sectionTop = section.getBoundingClientRect().top - containerTop;
        if (sectionTop <= 130) {
          activeId = category.id;
        }
      });

      setSelectedCategory((current) => (current === activeId ? current : activeId));
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveCategory);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    updateActiveCategory();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [displayCategories]);

  const scrollToCategory = (categoryId) => {
    const scrollContainer = menuScrollRef.current;
    const target = categoryRefs.current[categoryId];
    if (!scrollContainer || !target) return;
    setSelectedCategory(categoryId);
    scrollContainer.scrollTo({
      top: target.offsetTop - 14,
      behavior: 'smooth',
    });
  };

  const handleGoToCart = () => {
    const cartWithContact = {
      ...cart,
      contact: {
        ...cart.contact,
        name: cart.contact?.name || getUserDisplayName(user),
        phone: cart.contact?.phone || user?.phone_number || '',
      },
    };

    // 只傳遞可序列化的資料，不傳遞 dispatch 函數
    navigate(`/takeout/${storeId}/cart`, {
      state: {
        cart: cartWithContact,
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
    return <SkeletonLoader variant="cards" cards={8} />;
  }

  if (error) {
    return (
      <div className={`${styles['takeout-page']} container py-5`}>
        <div className="alert alert-danger">{error}</div>
      </div>
    );
  }

  const storeImageSource = store?.first_image || store?.images?.[0]?.image || store?.images?.[0]?.image_url || '';
  const storeImageUrl = storeImageSource
    ? (storeImageSource.startsWith('http') ? storeImageSource : `http://127.0.0.1:8000${storeImageSource}`)
    : '';

  return (
    <div className={styles['takeout-page']}>
      <section className={styles['takeout-store-card']}>
        <div className={styles['takeout-store-image']}>
          {storeImageUrl ? (
            <img src={storeImageUrl} alt={store?.name} />
          ) : (
            <span>DV</span>
          )}
        </div>
        <div className={styles['takeout-store-copy']}>
          <h1>{store?.name}</h1>
          <p><i className="bi bi-geo-alt" aria-hidden="true"></i>{store?.address}</p>
          <div>
            {store?.phone && <span><i className="bi bi-telephone" aria-hidden="true"></i>{store.phone}</span>}
            {user && greenPoints !== null && (
              <span className={styles['green-points-badge']}>
                <FaCoins />
                綠色點數：{greenPoints} 點
              </span>
            )}
          </div>
        </div>
      </section>

      <section className={styles['takeout-menu-shell']}>
        <aside className={styles['takeout-category-sidebar']}>
          {displayCategories.map((category) => {
            const categoryProducts = category.id === 'all-products'
              ? filteredMenuItems
              : filteredMenuItems.filter((item) => item.category === category.id);
            return (
              <button
                key={category.id}
                type="button"
                className={`${styles['side-category-btn']} ${selectedCategory === category.id ? styles.active : ''}`}
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
              className={`${styles['side-category-btn']} ${showGreenPointSection ? styles.active : ''}`}
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
                <small>點數兌換優惠</small>
              </span>
            </button>
          )}

          <button
            type="button"
            className={`${styles['side-category-btn']} ${!store?.enable_surplus_food ? styles.disabled : ''}`}
            onClick={() => store?.enable_surplus_food && navigate(`/store/${storeId}/surplus`, { state: { cart } })}
            disabled={!store?.enable_surplus_food}
          >
            <i className="bi bi-basket" aria-hidden="true"></i>
            <span>
              <strong>惜福專區</strong>
              <small>即期餐點優惠</small>
            </span>
          </button>
        </aside>

        <div className={styles['takeout-menu-main']}>
          <div className={styles['takeout-menu-toolbar']}>
            <div className={styles['takeout-filter-pills']}>
              <button
                type="button"
                className={styles.active}
                onClick={() => displayCategories[0] && scrollToCategory(displayCategories[0].id)}
              >
                <i className="bi bi-grid" aria-hidden="true"></i>全部
              </button>
              {displayCategories.slice(0, 2).map((category) => (
                <button key={category.id} type="button" onClick={() => scrollToCategory(category.id)}>
                  {category.name}
                  <span>{category.id === 'all-products' ? filteredMenuItems.length : filteredMenuItems.filter((item) => item.category === category.id).length}</span>
                </button>
              ))}
            </div>
            <label className={styles['takeout-search-box']}>
              <i className="bi bi-search" aria-hidden="true"></i>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="搜尋餐點名稱"
                aria-label="搜尋餐點名稱"
              />
            </label>
            <button
              type="button"
              className={styles['takeout-cart-button']}
              onClick={handleGoToCart}
              disabled={cart.items.length === 0}
            >
              <FaShoppingCart />
              購物車
              {totalQuantity > 0 && <span>{totalQuantity}</span>}
              <strong>共 NT$ {formatPrice(total)}</strong>
            </button>
          </div>

          <div className={styles['takeout-scroll-area']} ref={menuScrollRef}>
            {showGreenPointSection && redemptionRules.length > 0 && (
              <section ref={greenPointRef} className={styles['menu-category-section']}>
                <header>
                  <div>
                    <i className="bi bi-star" aria-hidden="true"></i>
                    <h2>點數兌換</h2>
                    <p>使用綠色點數兌換優惠</p>
                  </div>
                </header>
                <div className={styles['redemption-list']}>
                  {redemptionRules.map((rule) => {
                    const canRedeem = greenPoints !== null && greenPoints >= rule.required_points;
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        className={styles['redemption-card']}
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
              <div className={styles['takeout-empty']}>目前沒有可供點選的商品</div>
            ) : (
              displayCategories.map((category) => {
                const categoryProducts = category.id === 'all-products'
                  ? filteredMenuItems
                  : filteredMenuItems.filter((item) => item.category === category.id);
                if (categoryProducts.length === 0) return null;

                return (
                  <section
                    key={category.id}
                    ref={(el) => { categoryRefs.current[category.id] = el; }}
                    className={styles['menu-category-section']}
                  >
                    <header>
                      <div>
                        <i className="bi bi-tag" aria-hidden="true"></i>
                        <h2>{category.name}</h2>
                        <p>{category.description || '精選商品，美味滿分'}</p>
                      </div>
                      <button type="button" onClick={() => scrollToCategory(category.id)}>
                        查看全部 <i className="bi bi-chevron-right" aria-hidden="true"></i>
                      </button>
                    </header>
                    <div className={styles['menu-product-grid']}>
                      {categoryProducts.map(renderMenuItemCard)}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </section>

      <button
        type="button"
        className={styles['floating-cart-btn']}
        onClick={handleGoToCart}
        disabled={cart.items.length === 0}
      >
        <FaShoppingCart />
        {totalQuantity > 0 && <span>{totalQuantity}</span>}
        <strong>NT$ {formatPrice(total)}</strong>
      </button>

      {showSpecModal && selectedProduct && (
        <ProductSpecificationModal
          product={selectedProduct}
          initialSpecGroups={productSpecGroups[selectedProduct.id]}
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
