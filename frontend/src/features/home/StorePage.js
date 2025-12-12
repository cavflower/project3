
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import { useAuth } from '../../store/AuthContext';
import { getTakeoutProducts } from '../../api/orderApi';
import './StorePage.css';

function StorePage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
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
      <div className="container store-loading-container">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">載入中...</span>
        </div>
        <p className="mt-4" style={{ fontSize: '1.1rem', color: '#6c757d' }}>載入店家資訊中...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="container store-error-container">
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

  // 計算平均預算
  const budgets = [];
  if (store.budget_lunch) budgets.push(parseFloat(store.budget_lunch));
  if (store.budget_dinner) budgets.push(parseFloat(store.budget_dinner));
  if (store.budget_banquet) budgets.push(parseFloat(store.budget_banquet));
  const avgBudget = budgets.length > 0 
    ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length)
    : null;

  return (
    <div className="store-page-container" style={{ marginTop: '70px', paddingBottom: '50px' }}>
      <div className="container">
        {/* 返回按鈕和會員中心 */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <button 
            className="btn-back-store"
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
        <div className="store-header-section mb-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
    <div>
              <h1 className="store-main-title">{store.name}</h1>
              <div className="store-basic-info mt-2">
                {store.address && (
                  <span className="store-info-item">
                    <i className="bi bi-geo-alt"></i>
                    {store.address}
                  </span>
                )}
                {avgBudget && (
                  <span className="store-info-item">
                    <i className="bi bi-currency-dollar"></i>
                    平均價格 NT$ {avgBudget.toLocaleString()}
                  </span>
                )}
                <span className="store-info-item">
                  <i className="bi bi-star-fill text-warning"></i>
                  4.5 (123 評論)
                </span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button className="btn-favorite">
                <i className="bi bi-heart"></i>
              </button>
              <span className={`store-status-badge ${store.is_open ? 'bg-success' : 'bg-secondary'}`}>
                <i className="bi bi-clock"></i>
                {store.is_open ? '營業中' : '休息中'}
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
              <div className="store-gallery mb-4">
                <div className="row g-2">
                  <div className="col-8">
                    <div 
                      className="store-main-image"
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
                      <div className="image-zoom-hint">
                        <i className="bi bi-zoom-in"></i>
                        <span>點擊放大</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="store-thumbnail-grid">
                      {store.images.slice(1, 5).map((image, index) => (
                        <div 
                          key={image.id} 
                          className="store-thumbnail"
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
                          <div className="thumbnail-zoom-hint">
                            <i className="bi bi-zoom-in"></i>
                          </div>
                        </div>
                      ))}
                      {store.images.length > 5 && (
                        <div className="store-thumbnail store-thumbnail-more">
                          <div className="thumbnail-overlay">
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
            <div className="store-tabs mb-4">
              <button 
                className={`store-tab ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => setActiveTab('about')}
              >
                關於
              </button>
              <button 
                className={`store-tab ${activeTab === 'menu' ? 'active' : ''}`}
                onClick={() => setActiveTab('menu')}
              >
                菜單
              </button>
              <button 
                className={`store-tab ${activeTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setActiveTab('reviews')}
              >
                評論
              </button>
            </div>

            {/* 標籤頁內容 */}
            <div className="store-tab-content">
              {activeTab === 'about' && (
                <div className="store-about-section">
                  {store.description && (
                    <div className="store-section-card mb-4">
                      <h3 className="store-section-title">餐廳介紹</h3>
                      <p className="store-description-text">{store.description}</p>
                    </div>
                  )}

                  {/* 營業時間 */}
                  {openingHoursList && openingHoursList.length > 0 && (
                    <div className="store-section-card mb-4">
                      <h3 className="store-section-title">
                        <i className="bi bi-clock-history me-2"></i>營業時間
                      </h3>
                      <ul className="opening-hours-list">
                        {openingHoursList.map((item, index) => (
                          <li key={index} className="opening-hours-item">
                            <span className="opening-hours-day">{item.day}</span>
                            {item.isClosed ? (
                              <span className="opening-hours-closed">休息</span>
                            ) : (
                              <span className="opening-hours-time">{item.time}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {store.fixed_holidays && (
                        <div className="fixed-holidays mt-3">
                          <strong>固定休息日：</strong>
                          <p className="mb-0">{store.fixed_holidays}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 平均預算 */}
                  {(store.budget_lunch || store.budget_dinner || store.budget_banquet) && (
                    <div className="store-section-card mb-4">
                      <h3 className="store-section-title">
                        <i className="bi bi-currency-dollar me-2"></i>平均預算
                      </h3>
                      <div className="budget-list">
                        {store.budget_lunch && (
                          <div className="budget-item">
                            <span className="budget-label">午餐</span>
                            <span className="budget-amount">NT$ {parseFloat(store.budget_lunch).toLocaleString()}</span>
                          </div>
                        )}
                        {store.budget_dinner && (
                          <div className="budget-item">
                            <span className="budget-label">晚餐</span>
                            <span className="budget-amount">NT$ {parseFloat(store.budget_dinner).toLocaleString()}</span>
                          </div>
                        )}
                        {store.budget_banquet && (
                          <div className="budget-item">
                            <span className="budget-label">宴會</span>
                            <span className="budget-amount">NT$ {parseFloat(store.budget_banquet).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 交通方式 */}
                  {store.transportation && (
                    <div className="store-section-card mb-4">
                      <h3 className="store-section-title">
                        <i className="bi bi-bus-front me-2"></i>交通方式
                      </h3>
                      <p className="store-text-content">{store.transportation}</p>
                    </div>
                  )}

                  {/* 設施與服務 */}
                  <div className="store-section-card mb-4">
                    <h3 className="store-section-title">
                      <i className="bi bi-info-circle me-2"></i>設施與服務
                    </h3>
                    <div className="facilities-grid">
                      {store.has_wifi && (
                        <span className="facility-badge">
                          <i className="bi bi-wifi"></i>
                          Wi-Fi
                        </span>
                      )}
                      {store.has_english_menu && (
                        <span className="facility-badge">
                          <i className="bi bi-translate"></i>
                          英文菜單
                        </span>
                      )}
                      {store.suitable_for_children && (
                        <span className="facility-badge">
                          <i className="bi bi-heart"></i>
                          適合帶小孩
                        </span>
                      )}
                    </div>
                    {store.credit_cards && (
                      <div className="facility-info-item mt-3">
                        <strong>接受的信用卡：</strong>
                        <p className="mb-0">{store.credit_cards}</p>
                      </div>
                    )}
                    {store.parking_info && (
                      <div className="facility-info-item mt-3">
                        <strong>停車資訊：</strong>
                        <p className="mb-0">{store.parking_info}</p>
                      </div>
                    )}
                    {store.smoking_policy && (
                      <div className="facility-info-item mt-3">
                        <strong>吸菸政策：</strong>
                        <span className="smoking-policy-badge">
                          {store.smoking_policy === 'no_smoking' ? '完全禁煙' :
                           store.smoking_policy === 'smoking_allowed' ? '可吸菸' :
                           store.smoking_policy === 'separate_room' ? '有專用吸菸室' : store.smoking_policy}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 聯絡資訊 */}
                  <div className="store-section-card mb-4">
                    <h3 className="store-section-title">
                      <i className="bi bi-telephone me-2"></i>聯絡資訊
                    </h3>
                    <div className="contact-info-list">
                      {store.phone && (
                        <div className="contact-info-item">
                          <i className="bi bi-telephone"></i>
                          <a href={`tel:${store.phone}`}>{store.phone}</a>
                        </div>
                      )}
                      {store.email && (
                        <div className="contact-info-item">
                          <i className="bi bi-envelope"></i>
                          <a href={`mailto:${store.email}`}>{store.email}</a>
                        </div>
                      )}
                      {store.website && (
                        <div className="contact-info-item">
                          <i className="bi bi-globe"></i>
                          <a href={store.website} target="_blank" rel="noopener noreferrer">
                            {store.website}
                          </a>
                        </div>
                      )}
                    </div>
      </div>

                  {/* 備註 */}
                  {store.remarks && (
                    <div className="store-section-card">
                      <h3 className="store-section-title">
                        <i className="bi bi-sticky me-2"></i>備註
                      </h3>
                      <p className="store-text-content">{store.remarks}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'menu' && (
                <div className="store-menu-section">

                  {productsLoading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">載入菜單中...</span>
                      </div>
                      <p className="mt-3 text-muted">載入菜單資料中...</p>
                    </div>
                  ) : store.menu_type === 'text' && store.menu_text ? (

                    <div className="store-section-card">
                      <div className="menu-header">
                        <h3 className="store-section-title">菜單</h3>
                        <span className="menu-tax-note">(含稅價格)</span>

                        {menuItems.length > 0 && (
                          <span className="menu-count-badge">共 {menuItems.length} 項商品</span>
                        )}
                      </div>
                      <div className="menu-text-content">
                          {visibleProducts.length > 0 ? (
                            <>
                              {visibleProducts
                                .filter(item => item.service_type !== 'takeaway') // 內用顯示 dine_in 或 both
                                .map(item => (
                                  <div key={item.id} className="menu-item-card">
                                    <div className="menu-item-header">
                                      <h4 className="menu-item-title">{item.name}</h4>
                                      <span className="menu-item-price">NT$ {Number(item.price).toFixed(0)}</span>
                                    </div>
                                    {item.description && (
                                      <p className="menu-item-description">{item.description}</p>
                                    )}
                                    {item.category_name && (
                                      <span className="menu-item-category-badge">{item.category_name}</span>
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
                    <div className="store-section-card">
                      <h3 className="store-section-title">菜單</h3>
                      <div className="menu-images-grid">
                        {store.menu_images.map((image, index) => (
                          <div 
                            key={image.id} 
                            className="menu-image-item"
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
                            <div className="image-overlay">
                              <i className="bi bi-zoom-in"></i>
                              <span>點擊放大</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="store-section-card">
                      <h3 className="store-section-title">菜單</h3>
                      <p className="text-muted">店家尚未設定菜單</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="store-reviews-section">
                  <div className="store-section-card">
                    <h3 className="store-section-title">評論</h3>
                    <p className="text-muted">評論功能開發中...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右側：預訂/點餐卡片 */}
          <div className="col-lg-4">
            <div className="store-booking-card">
              <div className="booking-card-header">
                <h3 className="booking-title">開始點餐</h3>
                <span className="booking-free-badge">免費</span>
              </div>
              <div className="booking-card-body">
                <Link 
                  to={`/store/${storeId}/options`}
                  className="store-action-btn w-100 text-center"
                >
                  <i className="bi bi-cart me-2"></i>
                  立即點餐
      </Link>
                <div className="booking-info mt-3">
                  <div className="booking-info-item">
                    <i className="bi bi-clock"></i>
                    <span>營業時間：{store.is_open ? '營業中' : '休息中'}</span>
                  </div>
                  {store.phone && (
                    <div className="booking-info-item">
                      <i className="bi bi-telephone"></i>
                      <a href={`tel:${store.phone}`}>{store.phone}</a>
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
          className="image-modal"
          onClick={() => {
            setSelectedImage(null);
            setImageType(null);
          }}
        >
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="image-modal-close"
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

export default StorePage;