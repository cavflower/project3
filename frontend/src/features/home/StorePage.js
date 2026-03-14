
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import { useAuth } from '../../store/AuthContext';
import { getTakeoutProducts } from '../../api/orderApi';
import api from '../../api/api';
import { getStoreBusinessStatus } from '../../utils/storeBusinessStatus';
import styles from './StorePage.module.css';

function StorePage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('about');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageType, setImageType] = useState(null); // 'store' or 'menu'

  // 商品分頁狀態
  const [displayedProducts, setDisplayedProducts] = useState(20); // 初始顯示20個
  const PRODUCTS_PER_PAGE = 20;


  useEffect(() => {
    loadStoreData();
  }, [storeId]);

  // 當切換到菜單頁籤時才載入商品
  useEffect(() => {
    if (activeTab === 'menu' && menuItems.length === 0 && !productsLoading) {
      loadMenuItems(storeId);
    }
  }, [activeTab, storeId]);

  const loadStoreData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getStore(storeId);
      setStore(response.data);
      // 同步抓取店家評論統計，用於頁首顯示
      try {
        const reviewsRes = await api.get(`/reviews/store-reviews/?store_id=${storeId}`);
        const reviews = reviewsRes.data || [];
        const avg = reviews.length > 0
          ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : 0;
        setReviewStats({ avg, count: reviews.length });
      } catch (e) {
        console.warn('載入店家評論統計失敗', e);
        setReviewStats({ avg: 0, count: 0 });
      }
      // 移除這裡的自動載入商品
      // await loadMenuItems(storeId);

    } catch (err) {
      console.error('Failed to load store:', err);
      setError('載入店家資訊失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async (id) => {
    try {
      setProductsLoading(true);
      const productRes = await getTakeoutProducts(id);
      setMenuItems(productRes.data);
    } catch (err) {
      console.error('Failed to load menu items:', err);

    } finally {
      setProductsLoading(false);
    }
  };

  // 載入更多商品
  const loadMoreProducts = useCallback(() => {
    setDisplayedProducts(prev => prev + PRODUCTS_PER_PAGE);
  }, []);

  // 顯示的商品列表（分頁）
  const visibleProducts = useMemo(() => {
    return menuItems.slice(0, displayedProducts);
  }, [menuItems, displayedProducts]);

  // 是否還有更多商品
  const hasMoreProducts = displayedProducts < menuItems.length;


  const formatOpeningHours = (hours) => {
    if (!hours || typeof hours !== 'object') return null;

    const dayNames = {
      monday: '星期一',
      tuesday: '星期二',
      wednesday: '星期三',
      thursday: '星期四',
      friday: '星期五',
      saturday: '星期六',
      sunday: '星期日',
    };

    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return dayOrder.map(day => {
      if (!hours[day]) return null;
      const info = hours[day];
      return {
        day: dayNames[day],
        isClosed: info.is_closed,
        time: info.is_closed ? null : `${info.open} - ${info.close}`
      };
    }).filter(item => item !== null);
  };


  if (loading) {
    return (
      <div className={`container ${styles['store-loading-container']}`}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">載入中...</span>
        </div>
        <p className="mt-4" style={{ fontSize: '1.1rem', color: '#6c757d' }}>載入店家資訊中...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className={`container ${styles['store-error-container']}`}>
        <div className="alert alert-danger">
          <h4 style={{ marginBottom: '15px' }}>無法載入店家資訊</h4>
          <p style={{ marginBottom: '20px' }}>{error || '店家不存在或已下架'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/customer-home')}>
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  const openingHoursList = formatOpeningHours(store.opening_hours);
  const businessStatus = getStoreBusinessStatus(store);

  // 計算平均預算
  const budgets = [];
  if (store.budget_lunch) budgets.push(parseFloat(store.budget_lunch));
  if (store.budget_dinner) budgets.push(parseFloat(store.budget_dinner));
  if (store.budget_banquet) budgets.push(parseFloat(store.budget_banquet));
  const avgBudget = budgets.length > 0
    ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length)
    : null;

  return (
    <div className={styles['store-page-container']} style={{ marginTop: '70px', paddingBottom: '50px' }}>
      <div className="container">
        {/* 返回按鈕和會員中心 */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <button
            className={styles['btn-back-store']}
            onClick={() => navigate('/customer-home')}
          >
            <i className="bi bi-arrow-left me-2"></i>
            返回店家列表
          </button>

          <Link
            to={`/customer/loyalty/${storeId}`}
            className="btn btn-outline-primary"
            style={{
              textDecoration: 'none',
              padding: '0.5rem 1.5rem',
              borderRadius: '20px',
              border: '1px solid var(--primary-color)',
              color: 'var(--primary-color)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--primary-color)';
              e.target.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = 'var(--primary-color)';
            }}
          >
            會員中心
          </Link>
        </div>

        {/* 餐廳標題和基本資訊 */}
        <div className={`${styles['store-header-section']} mb-4`}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
            <div>
              <h1 className={styles['store-main-title']}>{store.name}</h1>
              <div className={`${styles['store-basic-info']} mt-2`}>
                {store.address && (
                  <span className={styles['store-info-item']}>
                    <i className="bi bi-geo-alt"></i>
                    {store.address}
                  </span>
                )}
                {avgBudget && (
                  <span className={styles['store-info-item']}>
                    <i className="bi bi-currency-dollar"></i>
                    平均價格 NT$ {avgBudget.toLocaleString()}
                  </span>
                )}
                <span className="store-info-item">
                  <i className="bi bi-star-fill text-warning"></i>
                  {reviewStats.avg} ({reviewStats.count} 評論)
                </span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button className="btn-favorite">
                <i className="bi bi-heart"></i>
              </button>
              <span className={`store-status-badge ${businessStatus.isOpenNow ? 'bg-success' : 'bg-secondary'}`}>
                <i className="bi bi-clock"></i>
                {businessStatus.statusText}
              </span>
            </div>
          </div>
        </div>

        {/* 主要內容區域 */}
        <div className="row g-4">
          {/* 左側：圖片和詳細資訊 */}
          <div className="col-lg-8">
            {/* 圖片畫廊 */}
            {store.images && store.images.length > 0 && (
              <div className={`${styles['store-gallery']} mb-4`}>
                <div className="row g-2">
                  <div className="col-8">
                    <div
                      className={styles['store-main-image']}
                      onClick={() => {
                        setSelectedImage(store.images[0].image.startsWith('http')
                          ? store.images[0].image
                          : `http://127.0.0.1:8000${store.images[0].image}`);
                        setImageType('store');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <img
                        src={store.images[0].image.startsWith('http')
                          ? store.images[0].image
                          : `http://127.0.0.1:8000${store.images[0].image}`}
                        alt={store.name}
                      />
                      <div className={styles['image-zoom-hint']}>
                        <i className="bi bi-zoom-in"></i>
                        <span>點擊放大</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className={styles['store-thumbnail-grid']}>
                      {store.images.slice(1, 5).map((image, index) => (
                        <div
                          key={image.id}
                          className={styles['store-thumbnail']}
                          onClick={() => {
                            setSelectedImage(image.image.startsWith('http')
                              ? image.image
                              : `http://127.0.0.1:8000${image.image}`);
                            setImageType('store');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <img
                            src={image.image.startsWith('http')
                              ? image.image
                              : `http://127.0.0.1:8000${image.image}`}
                            alt={`${store.name} - ${index + 2}`}
                          />
                          <div className={styles['thumbnail-zoom-hint']}>
                            <i className="bi bi-zoom-in"></i>
                          </div>
                        </div>
                      ))}
                      {store.images.length > 5 && (
                        <div className={`${styles['store-thumbnail']} ${styles['store-thumbnail-more']}`}>
                          <div className={styles['thumbnail-overlay']}>
                            <span>查看其他 {store.images.length - 5} 張照片</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 標籤頁導航 */}
            <div className={`${styles['store-tabs']} mb-4`}>
              <button
                className={`${styles['store-tab']} ${activeTab === 'about' ? styles.active : ''}`}
                onClick={() => setActiveTab('about')}
              >
                關於
              </button>
              <button
                className={`${styles['store-tab']} ${activeTab === 'menu' ? styles.active : ''}`}
                onClick={() => setActiveTab('menu')}
              >
                菜單
              </button>
              <button
                className={`${styles['store-tab']} ${activeTab === 'reviews' ? styles.active : ''}`}
                onClick={() => setActiveTab('reviews')}
              >
                評論
              </button>
            </div>

            {/* 標籤頁內容 */}
            <div className={styles['store-tab-content']}>
              {activeTab === 'about' && (
                <div className={styles['store-about-section']}>
                  {store.description && (
                    <div className={`${styles['store-section-card']} mb-4`}>
                      <h3 className={styles['store-section-title']}>餐廳介紹</h3>
                      <p className={styles['store-description-text']}>{store.description}</p>
                    </div>
                  )}

                  {/* 營業時間 */}
                  {openingHoursList && openingHoursList.length > 0 && (
                    <div className={`${styles['store-section-card']} mb-4`}>
                      <h3 className={styles['store-section-title']}>
                        <i className="bi bi-clock-history me-2"></i>營業時間
                      </h3>
                      <ul className={styles['opening-hours-list']}>
                        {openingHoursList.map((item, index) => (
                          <li key={index} className={styles['opening-hours-item']}>
                            <span className={styles['opening-hours-day']}>{item.day}</span>
                            {item.isClosed ? (
                              <span className={styles['opening-hours-closed']}>休息</span>
                            ) : (
                              <span className={styles['opening-hours-time']}>{item.time}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {store.fixed_holidays && (
                        <div className={`${styles['fixed-holidays']} mt-3`}>
                          <strong>固定休息日：</strong>
                          <p className="mb-0">{store.fixed_holidays}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 平均預算 */}
                  {(store.budget_lunch || store.budget_dinner || store.budget_banquet) && (
                    <div className={`${styles['store-section-card']} mb-4`}>
                      <h3 className={styles['store-section-title']}>
                        <i className="bi bi-currency-dollar me-2"></i>平均預算
                      </h3>
                      <div className={styles['budget-list']}>
                        {store.budget_lunch && (
                          <div className={styles['budget-item']}>
                            <span className={styles['budget-label']}>午餐</span>
                            <span className={styles['budget-amount']}>NT$ {parseFloat(store.budget_lunch).toLocaleString()}</span>
                          </div>
                        )}
                        {store.budget_dinner && (
                          <div className={styles['budget-item']}>
                            <span className={styles['budget-label']}>晚餐</span>
                            <span className={styles['budget-amount']}>NT$ {parseFloat(store.budget_dinner).toLocaleString()}</span>
                          </div>
                        )}
                        {store.budget_banquet && (
                          <div className={styles['budget-item']}>
                            <span className={styles['budget-label']}>宴會</span>
                            <span className={styles['budget-amount']}>NT$ {parseFloat(store.budget_banquet).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 交通方式 */}
                  {store.transportation && (
                    <div className={`${styles['store-section-card']} mb-4`}>
                      <h3 className={styles['store-section-title']}>
                        <i className="bi bi-bus-front me-2"></i>交通方式
                      </h3>
                      <p className={styles['store-text-content']}>{store.transportation}</p>
                    </div>
                  )}

                  {/* 設施與服務 */}
                  <div className={`${styles['store-section-card']} mb-4`}>
                    <h3 className={styles['store-section-title']}>
                      <i className="bi bi-info-circle me-2"></i>設施與服務
                    </h3>
                    <div className={styles['facilities-grid']}>
                      {store.has_wifi && (
                        <span className={styles['facility-badge']}>
                          <i className="bi bi-wifi"></i>
                          Wi-Fi
                        </span>
                      )}
                      {store.has_english_menu && (
                        <span className={styles['facility-badge']}>
                          <i className="bi bi-translate"></i>
                          英文菜單
                        </span>
                      )}
                      {store.suitable_for_children && (
                        <span className={styles['facility-badge']}>
                          <i className="bi bi-heart"></i>
                          適合帶小孩
                        </span>
                      )}
                    </div>
                    {store.credit_cards && (
                      <div className={`${styles['facility-info-item']} mt-3`}>
                        <strong>接受的信用卡：</strong>
                        <p className="mb-0">{store.credit_cards}</p>
                      </div>
                    )}
                    {store.parking_info && (
                      <div className={`${styles['facility-info-item']} mt-3`}>
                        <strong>停車資訊：</strong>
                        <p className="mb-0">{store.parking_info}</p>
                      </div>
                    )}
                    {store.smoking_policy && (
                      <div className={`${styles['facility-info-item']} mt-3`}>
                        <strong>吸菸政策：</strong>
                        <span className={styles['smoking-policy-badge']}>
                          {store.smoking_policy === 'no_smoking' ? '完全禁煙' :
                            store.smoking_policy === 'smoking_allowed' ? '可吸菸' :
                              store.smoking_policy === 'separate_room' ? '有專用吸菸室' : store.smoking_policy}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 聯絡資訊 */}
                  <div className={`${styles['store-section-card']} mb-4`}>
                    <h3 className={styles['store-section-title']}>
                      <i className="bi bi-telephone me-2"></i>聯絡資訊
                    </h3>
                    <div className={styles['contact-info-list']}>
                      {store.phone && (
                        <div className={styles['contact-info-item']}>
                          <i className="bi bi-telephone"></i>
                          <a href={`tel:${store.phone}`}>{store.phone}</a>
                        </div>
                      )}
                      {store.email && (
                        <div className={styles['contact-info-item']}>
                          <i className="bi bi-envelope"></i>
                          <a href={`mailto:${store.email}`}>{store.email}</a>
                        </div>
                      )}
                      {store.website && (
                        <div className={styles['contact-info-item']}>
                          <i className="bi bi-globe"></i>
                          <a href={store.website} target="_blank" rel="noopener noreferrer">
                            {store.website}
                          </a>
                        </div>
                      )}
                      {store.line_friend_url && (
                        <div className={styles['contact-info-item']}>
                          <i className="bi bi-line" style={{ color: '#00B900' }}></i>
                          <a href={store.line_friend_url} target="_blank" rel="noopener noreferrer">
                            加入 LINE 好友
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 備註 */}
                  {store.remarks && (
                    <div className={styles['store-section-card']}>
                      <h3 className={styles['store-section-title']}>
                        <i className="bi bi-sticky me-2"></i>備註
                      </h3>
                      <p className={styles['store-text-content']}>{store.remarks}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'menu' && (
                <div className={styles['store-menu-section']}>

                  {productsLoading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">載入菜單中...</span>
                      </div>
                      <p className="mt-3 text-muted">載入菜單資料中...</p>
                    </div>
                  ) : menuItems.length > 0 ? (

                    <div className={styles['store-section-card']}>
                      <div className={styles['menu-header']}>
                        <h3 className={styles['store-section-title']}>菜單</h3>
                        <span className={styles['menu-tax-note']}>(含稅價格)</span>

                        <span className={styles['menu-count-badge']}>共 {menuItems.length} 項商品</span>
                      </div>
                      <div className={styles['menu-text-content']}>
                        {visibleProducts.length > 0 ? (
                          <>
                            {visibleProducts.map(item => (
                              <div key={item.id} className={styles['menu-item-card']}>
                                <div className={styles['menu-item-header']}>
                                  <div>
                                    <h4 className={styles['menu-item-title']}>{item.name}</h4>
                                    {item.category_name && (
                                      <span className={styles['menu-item-category-badge']}>{item.category_name}</span>
                                    )}
                                  </div>
                                  <span className={styles['menu-item-price']}>NT$ {Number(item.price).toFixed(0)}</span>
                                </div>
                                {item.description && (
                                  <p className={styles['menu-item-description']}>{item.description}</p>
                                )}
                              </div>
                            ))}

                            {/* 載入更多按鈕 */}
                            {hasMoreProducts && (
                              <div className="text-center mt-4">
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={loadMoreProducts}
                                  style={{
                                    padding: '0.75rem 2rem',
                                    borderRadius: '25px',
                                    fontSize: '1rem'
                                  }}
                                >
                                  <i className="bi bi-arrow-down-circle me-2"></i>
                                  載入更多 ({menuItems.length - displayedProducts} 項商品)
                                </button>
                              </div>
                            )}
                          </>

                        ) : (
                          <p className="text-muted">目前尚無菜單資料</p>
                        )}

                      </div>
                    </div>
                  ) : store.menu_type === 'image' && store.menu_images && store.menu_images.length > 0 ? (
                    <div className={styles['store-section-card']}>
                      <h3 className={styles['store-section-title']}>菜單</h3>
                      <div className={styles['menu-images-grid']}>
                        {store.menu_images.map((image, index) => (
                          <div
                            key={image.id}
                            className={styles['menu-image-item']}
                            onClick={() => {
                              setSelectedImage(image.image.startsWith('http') ? image.image : `http://127.0.0.1:8000${image.image}`);
                              setImageType('menu');
                            }}
                          >
                            <img
                              src={image.image.startsWith('http')
                                ? image.image
                                : `http://127.0.0.1:8000${image.image}`}
                              alt={`菜單 ${index + 1}`}
                            />
                            <div className={styles['image-overlay']}>
                              <i className="bi bi-zoom-in"></i>
                              <span>點擊放大</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={styles['store-section-card']}>
                      <h3 className={styles['store-section-title']}>菜單</h3>
                      <p className="text-muted">店家尚未設定菜單</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <StoreReviews storeId={storeId} />
              )}
            </div>
          </div>

          {/* 右側：預訂/點餐卡片 */}
          <div className="col-lg-4">
            <div className={styles['store-booking-card']}>
              <div className={styles['booking-card-header']}>
                <h3 className={styles['booking-title']}>開始點餐</h3>
                <span className={styles['booking-free-badge']}>免費</span>
              </div>
              <div className={styles['booking-card-body']}>
                <Link
                  to={`/store/${storeId}/options`}
                  className={`${styles['store-action-btn']} w-100 text-center`}
                >
                  <i className="bi bi-cart me-2"></i>
                  立即點餐
                </Link>
                <div className={`${styles['booking-info']} mt-3`}>
                  <div className={styles['booking-info-item']}>
                    <i className="bi bi-clock"></i>
                    <span>營業時間：{businessStatus.statusText}</span>
                  </div>
                  {store.phone && (
                    <div className={styles['booking-info-item']}>
                      <i className="bi bi-telephone"></i>
                      <a href={`tel:${store.phone}`}>{store.phone}</a>
                    </div>
                  )}
                  {store.line_friend_url && (
                    <div className={styles['booking-info-item']}>
                      <i className="bi bi-line" style={{ color: '#00B900' }}></i>
                      <a href={store.line_friend_url} target="_blank" rel="noopener noreferrer">
                        加入 LINE 好友
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 圖片放大 Modal */}
      {selectedImage && (
        <div
          className={styles['image-modal']}
          onClick={() => {
            setSelectedImage(null);
            setImageType(null);
          }}
        >
          <div className={styles['image-modal-content']} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles['image-modal-close']}
              onClick={() => {
                setSelectedImage(null);
                setImageType(null);
              }}
            >
              <i className="bi bi-x-lg"></i>
            </button>
            <img src={selectedImage} alt="放大檢視" />
          </div>
        </div>
      )}
    </div>
  );
}

// 評論組件
function StoreReviews({ storeId }) {
  const [storeReviews, setStoreReviews] = useState([]);
  const [productReviews, setProductReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReviewTab, setActiveReviewTab] = useState('store');
  const [stats, setStats] = useState({
    avgStoreRating: 0,
    totalStoreReviews: 0,
    avgProductRating: 0,
    totalProductReviews: 0
  });

  useEffect(() => {
    loadReviews();
  }, [storeId]);

  const loadReviews = async () => {
    try {
      setLoading(true);

      // 載入店家評論
      const storeRes = await api.get(`/reviews/store-reviews/?store_id=${storeId}`);
      setStoreReviews(storeRes.data);

      // 載入菜品評論
      const productRes = await api.get(`/reviews/product-reviews/?store_id=${storeId}`);
      setProductReviews(productRes.data);

      // 計算統計數據
      const avgStoreRating = storeRes.data.length > 0
        ? (storeRes.data.reduce((sum, r) => sum + r.rating, 0) / storeRes.data.length).toFixed(1)
        : 0;

      const avgProductRating = productRes.data.length > 0
        ? (productRes.data.reduce((sum, r) => sum + r.rating, 0) / productRes.data.length).toFixed(1)
        : 0;

      setStats({
        avgStoreRating,
        totalStoreReviews: storeRes.data.length,
        avgProductRating,
        totalProductReviews: productRes.data.length
      });
    } catch (error) {
      console.error('載入評論失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className={styles['review-stars']}>
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={star <= rating ? `${styles.star} ${styles.filled}` : styles.star}>
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="store-section-card">
        <div className={styles['reviews-loading']}>載入評論中...</div>
      </div>
    );
  }

  return (
    <div className={styles['store-reviews-container']}>
      {/* 統計卡片 */}
      <div className={styles['reviews-stats-row']}>
        <div className={styles['review-stat-card']}>
          <div className={`${styles['stat-icon']} ${styles['icon-shop']}`}>
            <i className="bi bi-shop"></i>
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats.avgStoreRating} ⭐</div>
            <div className={styles['stat-label']}>店家評分</div>
            <div className={styles['stat-count']}>{stats.totalStoreReviews} 則評論</div>
          </div>
        </div>

        <div className={styles['review-stat-card']}>
          <div className={`${styles['stat-icon']} ${styles['icon-dish']}`}>
            <i className="bi bi-egg-fried"></i>
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats.avgProductRating} ⭐</div>
            <div className={styles['stat-label']}>菜品評分</div>
            <div className={styles['stat-count']}>{stats.totalProductReviews} 則評論</div>
          </div>
        </div>
      </div>

      {/* 評論分類標籤 */}
      <div className={styles['review-tabs']}>
        <button
          className={`${styles['review-tab']} ${activeReviewTab === 'store' ? styles.active : ''}`}
          onClick={() => setActiveReviewTab('store')}
        >
          店家評論 ({stats.totalStoreReviews})
        </button>
        <button
          className={`${styles['review-tab']} ${activeReviewTab === 'product' ? styles.active : ''}`}
          onClick={() => setActiveReviewTab('product')}
        >
          菜品評論 ({stats.totalProductReviews})
        </button>
      </div>

      {/* 店家評論列表 */}
      {activeReviewTab === 'store' && (
        <div className={styles['reviews-list']}>
          {storeReviews.length === 0 ? (
            <div className={styles['no-reviews']}>
              <p>暫無店家評論</p>
            </div>
          ) : (
            storeReviews.map(review => (
              <div key={review.id} className={styles['review-item']}>
                <div className={styles['review-header']}>
                  <div className={styles['reviewer-info']}>
                    {review.user_avatar ? (
                      <img
                        src={review.user_avatar}
                        alt={review.user_name}
                        className={styles['reviewer-avatar']}
                      />
                    ) : (
                      <div className={styles['reviewer-avatar-placeholder']}>{review.user_name[0]}</div>
                    )}
                    <div>
                      <div className={styles['reviewer-name']}>{review.user_name}</div>
                      <div className={styles['review-date']}>{formatDate(review.created_at)}</div>
                    </div>
                  </div>
                  {renderStars(review.rating)}
                </div>

                {review.tags && review.tags.length > 0 && (
                  <div className={styles['review-tags']}>
                    {review.tags.map((tag, index) => (
                      <span key={index} className={styles['review-tag']}>{tag}</span>
                    ))}
                  </div>
                )}

                {review.comment && (
                  <p className={styles['review-comment']}>{review.comment}</p>
                )}

                {review.merchant_reply && (
                  <div className={styles['merchant-reply-box']}>
                    <div className={styles['reply-header']}>
                      <strong>商家回覆</strong>
                      <span className={styles['reply-date']}>{formatDate(review.replied_at)}</span>
                    </div>
                    <p className={styles['reply-text']}>{review.merchant_reply}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 菜品評論列表 */}
      {activeReviewTab === 'product' && (
        <div className={styles['reviews-list']}>
          {productReviews.length === 0 ? (
            <div className={styles['no-reviews']}>
              <p>暫無菜品評論</p>
            </div>
          ) : (
            productReviews.map(review => (
              <div key={review.id} className={`${styles['review-item']} ${styles['product-review-item']}`}>
                <div className={styles['product-review-header']}>
                  {review.product_image && (
                    <img
                      src={review.product_image}
                      alt={review.product_name}
                      className={styles['product-thumb']}
                    />
                  )}
                  <div className={styles['product-review-info']}>
                    <h4 className={styles['product-review-name']}>{review.product_name}</h4>
                    {renderStars(review.rating)}
                  </div>
                </div>

                <div className="review-header">
                  <div className="reviewer-info">
                    {review.user_avatar ? (
                      <img
                        src={review.user_avatar}
                        alt={review.user_name}
                        className={styles['reviewer-avatar']}
                      />
                    ) : (
                      <div className={styles['reviewer-avatar-placeholder']}>{review.user_name[0]}</div>
                    )}
                    <div>
                      <div className={styles['reviewer-name']}>{review.user_name}</div>
                      <div className={styles['review-date']}>{formatDate(review.created_at)}</div>
                    </div>
                  </div>
                </div>

                {review.comment && (
                  <p className={styles['review-comment']}>{review.comment}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default StorePage;