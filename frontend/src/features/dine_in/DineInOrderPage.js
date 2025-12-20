import React, { useEffect, useMemo, useReducer, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FaPlus, FaMinus, FaShoppingCart } from "react-icons/fa";
import { getStore } from '../../api/storeApi';
import { createDineInOrder, getDineInProducts } from '../../api/orderApi';
import { getPublicProductCategories, getPublicSpecificationGroups } from '../../api/productApi';
import { useAuth } from "../../store/AuthContext";
import ProductSpecificationModal from '../../components/common/ProductSpecificationModal';
import '../takeout/TakeoutOrderPage.css';

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
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
    case 'DECREMENT_ITEM': {
      const items = state.items
        .map((item) =>
          item.cartKey === action.payload ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0);
      return { ...state, items };
    }
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'UPDATE_NOTE':
      return { ...state, notes: action.payload };
    default:
      return state;
  }
};

const paymentOptions = [
  { value: 'cash', label: '現金' },
  { value: 'credit_card', label: '信用卡' },
  { value: 'line_pay', label: 'LINE Pay' },
];

const formatPrice = (value) => Math.round(Number(value) || 0);

function DineInOrderPage() {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const tableLabel = searchParams.get('table') || '';

  const navigate = useNavigate();
  const { user } = useAuth();

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0].value);
  const [useEcoTableware, setUseEcoTableware] = useState('no');
  const [pickupNumber, setPickupNumber] = useState('');
  const categoryRefs = useRef({});

  // 規格選擇 Modal 狀態
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [cart, dispatch] = useReducer(cartReducer, {
    items: [],
    notes: '',
  });

  // 處理商品點擊：檢查是否有規格
  const handleProductClick = async (product) => {
    try {
      const response = await getPublicSpecificationGroups(product.id);
      const specs = response.data || [];

      if (specs.length > 0 && specs.some(g => g.options && g.options.length > 0)) {
        setSelectedProduct(product);
        setShowSpecModal(true);
      } else {
        dispatch({ type: 'ADD_ITEM', payload: { ...product, itemType: 'regular' } });
      }
    } catch (err) {
      console.error('檢查規格失敗:', err);
      dispatch({ type: 'ADD_ITEM', payload: { ...product, itemType: 'regular' } });
    }
  };

  const handleSpecConfirm = (productWithSpecs) => {
    dispatch({ type: 'ADD_ITEM', payload: { ...productWithSpecs, itemType: 'regular' } });
    setShowSpecModal(false);
    setSelectedProduct(null);
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const [storeRes, productsRes, categoriesRes] = await Promise.all([
          getStore(storeId),
          getDineInProducts(storeId),
          getPublicProductCategories(storeId)
        ]);

        setStore(storeRes.data);
        const dineInMenu = (productsRes.data || []).filter(
          (item) => item.service_type === 'dine_in' || item.service_type === 'both'
        );
        setMenuItems(dineInMenu);
        setCategories(categoriesRes.data || []);

        // 預設選中第一個類別
        if (categoriesRes.data && categoriesRes.data.length > 0) {
          setSelectedCategory(categoriesRes.data[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('載入資料失敗，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [storeId]);

  const total = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cart.items]
  );

  const handleGoToCart = () => {
    // 導向內用專用購物車頁面
    navigate(`/dinein/${storeId}/cart`, {
      state: {
        cart: cart,
        store: store,
        storeId: storeId,
        tableLabel: tableLabel
      }
    });
  };

  const handleSubmit = async () => {
    if (!cart.items.length) {
      alert('請先選擇餐點。');
      return;
    }
    try {
      setSubmitting(true);
      const notesWithTable = tableLabel
        ? `桌號：${tableLabel}${cart.notes ? ` / ${cart.notes}` : ''}`
        : cart.notes;
      const payload = {
        store: storeId,
        customer_name: tableLabel ? `桌號 ${tableLabel}` : '內用顧客',
        customer_phone: '0000000000',
        pickup_at: new Date().toISOString(),
        payment_method: paymentMethod,
        table_label: tableLabel,
        service_channel: 'dine_in',
        use_eco_tableware: useEcoTableware === 'yes',
        notes: notesWithTable,
        items: cart.items.map((item) => ({
          product: item.id,
          quantity: item.quantity,
        })),
      };
      const response = await createDineInOrder(payload);
      const pickupNo = response.data?.pickup_number;
      setPickupNumber(pickupNo || '');
      dispatch({ type: 'CLEAR_CART' });
      const paymentLabel =
        paymentOptions.find((o) => o.value === paymentMethod)?.label || paymentMethod;
      alert(
        `桌號：${tableLabel || '未提供'}\n付款方式：${paymentLabel}\n取單號碼：${pickupNo || '待通知'
        }\n環保餐具：${useEcoTableware === 'yes' ? '需要' : '不需要'}\n請等待服務人員確認。`
      );
      const orderId = response.data?.id || 'pending';
      navigate(`/confirmation/${orderId}`, {
        state: {
          pickupNumber: pickupNo || null,
          paymentMethod: paymentLabel,
        },
      });
    } catch (err) {
      console.error(err);
      alert('送出失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
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

  if (error || !store) {
    return (
      <div className="takeout-page container py-5">
        <div className="alert alert-danger">{error || '店家不可用。'}</div>
      </div>
    );
  }

  return (
    <div className="takeout-page container" style={{ marginTop: '70px' }}>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="mb-1">{store?.name}</h2>
              <p className="text-muted mb-2">{store?.address}</p>
              <div className="d-flex flex-wrap gap-3">
                <span>
                  <i className="bi bi-telephone me-1" />
                  {store?.phone}
                </span>
                {tableLabel && (
                  <span>
                    <i className="bi bi-geo-alt me-1" />
                    桌號：{tableLabel}
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
            <div className="category-nav-tabs mb-3">
              <div className="nav-tabs-scroll">
                {categories.map((category) => {
                  const categoryProducts = menuItems.filter(item => item.category === category.id);
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

                {/* 惜福專區按鈕 */}
                <button
                  className={`surplus-zone-nav-btn ${!store?.enable_surplus_food ? 'disabled' : ''}`}
                  onClick={() => store?.enable_surplus_food && navigate(`/store/${storeId}/surplus`, {
                    state: {
                      cart: cart,
                      tableLabel: tableLabel
                    }
                  })}
                  disabled={!store?.enable_surplus_food}
                  style={!store?.enable_surplus_food ? { cursor: 'not-allowed', opacity: 0.5, backgroundColor: '#ccc' } : {}}
                >
                  惜福專區
                </button>
              </div>
            </div>
          )}

          {/* 按類別分組顯示商品 */}
          {categories.length === 0 ? (
            <div className="card shadow-sm mb-4 takeout-card">
              <div className="card-header takeout-card-header">
                <strong>餐點列表</strong>
              </div>
              <div className="card-body">
                {menuItems.length === 0 && (
                  <p className="text-muted">目前尚無餐點，請洽服務人員。</p>
                )}
                {menuItems.map((item) => {
                  // 計算該商品的總數量（所有規格組合加總）
                  const cartItemsForProduct = cart.items.filter(ci => ci.id === item.id);
                  const quantity = cartItemsForProduct.reduce((sum, ci) => sum + ci.quantity, 0);
                  const lastCartItem = cartItemsForProduct[cartItemsForProduct.length - 1];
                  const isLinkedToSurplus = item.is_linked_to_surplus || false;

                  return (
                    <div
                      key={item.id}
                      className="d-flex justify-content-between align-items-center border-bottom py-3"
                      style={isLinkedToSurplus ? { opacity: 0.5, pointerEvents: 'none' } : {}}
                    >
                      <div className="flex-grow-1">
                        <h5 className="mb-1">
                          {item.name}
                          {isLinkedToSurplus && (
                            <span className="text-muted ms-2" style={{ fontSize: '0.85rem' }}>
                              (已轉為惜福品)
                            </span>
                          )}
                        </h5>
                        <p className="text-muted mb-1">{item.description}</p>
                        <strong className="text-dark">NT$ {formatPrice(item.price)}</strong>
                      </div>
                      {!isLinkedToSurplus && (
                        quantity === 0 ? (
                          <button
                            className="btn rounded-circle add-btn"
                            onClick={() => handleProductClick(item)}
                            title="加入購物車"
                          >
                            <FaPlus />
                          </button>
                        ) : (
                          <div className="quantity-control d-flex align-items-center gap-2">
                            <button
                              className="btn rounded-circle quantity-btn"
                              onClick={() => dispatch({ type: 'DECREMENT_ITEM', payload: lastCartItem?.cartKey })}
                            >
                              <FaMinus />
                            </button>
                            <span className="quantity-display">{quantity}</span>
                            <button
                              className="btn rounded-circle quantity-btn"
                              onClick={() => handleProductClick(item)}
                            >
                              <FaPlus />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
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
                  className="card shadow-sm mb-4 takeout-card category-section"
                >
                  <div className="card-header takeout-card-header">
                    <strong>{category.name}</strong>
                    {category.description && (
                      <small className="d-block mt-1" style={{ opacity: 0.9 }}>{category.description}</small>
                    )}
                  </div>
                  <div className="card-body">
                    {categoryProducts.map((item) => {
                      // 計算該商品的總數量（所有規格組合加總）
                      const cartItemsForProduct = cart.items.filter(ci => ci.id === item.id);
                      const quantity = cartItemsForProduct.reduce((sum, ci) => sum + ci.quantity, 0);
                      const lastCartItem = cartItemsForProduct[cartItemsForProduct.length - 1];
                      const isLinkedToSurplus = item.is_linked_to_surplus || false;

                      return (
                        <div
                          key={item.id}
                          className="d-flex justify-content-between align-items-center border-bottom py-3"
                          style={isLinkedToSurplus ? { opacity: 0.5, pointerEvents: 'none' } : {}}
                        >
                          {item.image && (
                            <div className="me-3">
                              <img
                                src={item.image.startsWith('http') ? item.image : `http://127.0.0.1:8000${item.image}`}
                                alt={item.name}
                                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                              />
                            </div>
                          )}
                          <div className="flex-grow-1">
                            <h5 className="mb-1">
                              {item.name}
                              {isLinkedToSurplus && (
                                <span className="text-muted ms-2" style={{ fontSize: '0.85rem' }}>
                                  (已轉為惜福品)
                                </span>
                              )}
                            </h5>
                            <p className="text-muted mb-1">{item.description}</p>
                            <strong className="text-dark">NT$ {formatPrice(item.price)}</strong>
                          </div>
                          {!isLinkedToSurplus && (
                            quantity === 0 ? (
                              <button
                                className="btn rounded-circle add-btn"
                                onClick={() => handleProductClick(item)}
                                title="加入購物車"
                              >
                                <FaPlus />
                              </button>
                            ) : (
                              <div className="quantity-control d-flex align-items-center gap-2">
                                <button
                                  className="btn rounded-circle quantity-btn"
                                  onClick={() => dispatch({ type: 'DECREMENT_ITEM', payload: lastCartItem?.cartKey })}
                                >
                                  <FaMinus />
                                </button>
                                <span className="quantity-display">{quantity}</span>
                                <button
                                  className="btn rounded-circle quantity-btn"
                                  onClick={() => handleProductClick(item)}
                                >
                                  <FaPlus />
                                </button>
                              </div>
                            )
                          )}
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

export default DineInOrderPage;
