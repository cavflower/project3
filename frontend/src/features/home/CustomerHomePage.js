import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublishedStores } from '../../api/storeApi';
import { getRecommendedStores, getUserPreferences } from '../../api/recommendationApi';
import { useAuth } from '../../store/AuthContext';
import './CustomerHomePage.css';

const categories = [
  { id: 'all', name: '全部', icon: 'grid-3x3-gap-fill', emoji: '🍽️' },
  { id: 'recommended', name: '為你推薦', icon: 'heart-fill', emoji: '❤️', requiresAuth: true },
  { id: 'japanese', name: '日式', icon: 'circle', emoji: '🍣' },
  { id: 'korean', name: '韓式', icon: 'fire', emoji: '🔥' },
  { id: 'american', name: '美式', icon: 'shop', emoji: '🍔' },
  { id: 'taiwanese', name: '台式', icon: 'egg-fried', emoji: '🥢' },
  { id: 'western', name: '西式', icon: 'cup-hot-fill', emoji: '☕' },
  { id: 'beverages', name: '飲料', icon: 'cup-straw', emoji: '🥤' },
  { id: 'desserts', name: '甜點', icon: 'cake2-fill', emoji: '🍰' },
  { id: 'other', name: '其他', icon: 'three-dots', emoji: '🍴' },
];

function CustomerHomePage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPreferences, setUserPreferences] = useState(null);
  const [filters, setFilters] = useState({
    has_reservation: false,
    has_loyalty: false,
    has_surplus_food: false,
  });
  
  useEffect(() => {
    loadStores();
  }, [selectedCategory, filters, user]);

  const loadStores = async () => {
    try {
      setLoading(true);
      
      // 如果選擇"為你推薦"且用戶已登入，調用推薦API
      if (selectedCategory === 'recommended') {
        if (!user) {
          // 未登入用戶，顯示提示
          setStores([]);
          setLoading(false);
          return;
        }
        
        try {
          // 獲取用戶偏好
          const preferencesResponse = await getUserPreferences();
          console.log('[CustomerHome] 用戶偏好數據:', preferencesResponse.data);
          setUserPreferences(preferencesResponse.data);
          
          // 獲取推薦店家
          const response = await getRecommendedStores(10);
          const formattedStores = response.data.map(store => ({
            id: store.id,
            name: store.name,
            description: store.description || '',
            address: store.address || '',
            phone: store.phone || '',
            cuisine_type: store.cuisine_type,
            rating: 4.5,
            imageUrl: store.first_image 
              ? (store.first_image.startsWith('http') 
                  ? store.first_image 
                  : `http://127.0.0.1:8000${store.first_image}`)
              : '/images/default-store.jpg',
            tags: [],
            is_open: store.is_open,
            enable_reservation: store.enable_reservation,
            enable_loyalty: store.enable_loyalty,
            enable_surplus_food: store.enable_surplus_food,
            isRecommended: true,
          }));
          setStores(formattedStores);
        } catch (err) {
          console.error('Failed to load recommended stores:', err);
          
          // 即使推薦失敗，也嘗試獲取用戶偏好
          try {
            const preferencesResponse = await getUserPreferences();
            console.log('[CustomerHome] 用戶偏好數據（降級）:', preferencesResponse.data);
            setUserPreferences(preferencesResponse.data);
          } catch (prefErr) {
            console.error('Failed to load user preferences:', prefErr);
          }
          // 推薦失敗時，顯示熱門店家
          const response = await getPublishedStores({ cuisine_type: 'all' });
          const formattedStores = response.data.slice(0, 10).map(store => ({
            id: store.id,
            name: store.name,
            description: store.description || '',
            address: store.address || '',
            phone: store.phone || '',
            cuisine_type: store.cuisine_type,
            rating: 4.5,
            imageUrl: store.first_image 
              ? (store.first_image.startsWith('http') 
                  ? store.first_image 
                  : `http://127.0.0.1:8000${store.first_image}`)
              : '/images/default-store.jpg',
            tags: [],
            is_open: store.is_open,
            enable_reservation: store.enable_reservation,
            enable_loyalty: store.enable_loyalty,
            enable_surplus_food: store.enable_surplus_food,
          }));
          setStores(formattedStores);
        }
      } else {
        // 一般類別篩選
        const filterParams = {
          cuisine_type: selectedCategory,
          search: searchTerm,
          ...filters
        };
        const response = await getPublishedStores(filterParams);
        const formattedStores = response.data.map(store => ({
          id: store.id,
          name: store.name,
          description: store.description || '',
          address: store.address || '',
          phone: store.phone || '',
          cuisine_type: store.cuisine_type,
          rating: 4.5,
          imageUrl: store.first_image 
            ? (store.first_image.startsWith('http') 
                ? store.first_image 
                : `http://127.0.0.1:8000${store.first_image}`)
            : '/images/default-store.jpg',
          tags: [],
          is_open: store.is_open,
          enable_reservation: store.enable_reservation,
          enable_loyalty: store.enable_loyalty,
          enable_surplus_food: store.enable_surplus_food,
        }));
        setStores(formattedStores);
      }
    } catch (err) {
      console.error('Failed to load stores:', err);
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadStores();
  };

  const handleFilterChange = (filterName) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const getCuisineTypeName = (type) => {
    const category = categories.find(cat => cat.id === type);
    return category ? category.name : type;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setFilters({
      has_reservation: false,
      has_loyalty: false,
      has_surplus_food: false,
    });
  };

  return (
    <div className="customer-home-page">
      <div className="container" style={{ marginTop: '70px', paddingBottom: '40px' }}>
        {/* 會員快速入口 */}
        <div className="row mb-4">
          <div className="col-12">
            <Link 
              to="/customer/loyalty" 
              className="loyalty-link-card"
            >
              <i className="bi bi-award me-2"></i>
              我的會員中心
            </Link>
          </div>
        </div>

        {/* 搜尋區 */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="search-card">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-orange"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="搜尋店家名稱、地址或料理類型..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button 
                  className="btn btn-orange"
                  onClick={handleSearch}
                >
                  搜尋
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 分類選擇 */}
        <div className="row g-2 mb-4">
          <div className="col-12">
            <h6 className="mb-3 fw-bold">
              <i className="bi bi-grid-3x3-gap me-2 text-orange"></i>
              餐廳類別
            </h6>
          </div>
          {categories.map(category => {
            // 如果是需要登入的類別且用戶未登入，顯示登入提示樣式
            const isLocked = category.requiresAuth && !user;
            
            return (
              <div key={category.id} className="col-4 col-md-3 col-lg-2">
                <button
                  className={`category-btn ${
                    selectedCategory === category.id ? 'active' : ''
                  } ${isLocked ? 'locked' : ''} ${category.id === 'recommended' ? 'recommended-category' : ''}`}
                  onClick={() => {
                    if (isLocked) {
                      alert('請先登入會員以查看個人化推薦');
                      return;
                    }
                    setSelectedCategory(category.id);
                  }}
                  title={isLocked ? '請先登入查看推薦' : category.name}
                >
                  {category.emoji ? (
                    <span className="fs-4 mb-1" style={{ display: 'block' }}>{category.emoji}</span>
                  ) : (
                    <i className={`bi bi-${category.icon} fs-5 mb-1`}></i>
                  )}
                  <span className="d-block small">{category.name}</span>
                  {isLocked && (
                    <i className="bi bi-lock-fill position-absolute top-0 end-0 m-1 text-muted" style={{ fontSize: '0.7rem' }}></i>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* 功能篩選 */}
        <div className="row mb-4">
          <div className="col-12">
            <h6 className="mb-3 fw-bold">
              <i className="bi bi-funnel me-2 text-orange"></i>
              特殊功能篩選
            </h6>
            <div className="d-flex flex-wrap gap-2">
              <button
                className={`feature-filter-btn ${filters.has_reservation ? 'active' : ''}`}
                onClick={() => handleFilterChange('has_reservation')}
              >
                <i className="bi bi-calendar-check me-1"></i>
                可訂位
                {filters.has_reservation && <i className="bi bi-check-circle-fill ms-1"></i>}
              </button>
              <button
                className={`feature-filter-btn ${filters.has_loyalty ? 'active' : ''}`}
                onClick={() => handleFilterChange('has_loyalty')}
              >
                <i className="bi bi-award me-1"></i>
                有會員制度
                {filters.has_loyalty && <i className="bi bi-check-circle-fill ms-1"></i>}
              </button>
              <button
                className={`feature-filter-btn ${filters.has_surplus_food ? 'active' : ''}`}
                onClick={() => handleFilterChange('has_surplus_food')}
              >
                <i className="bi bi-recycle me-1"></i>
                有惜福品
                {filters.has_surplus_food && <i className="bi bi-check-circle-fill ms-1"></i>}
              </button>
            </div>
          </div>
        </div>

        {/* 結果統計 */}
        {!loading && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center">
                <p className="text-muted mb-0">
                  找到 <span className="fw-bold text-orange">{stores.length}</span> 間店家
                </p>
                {(selectedCategory !== 'all' || filters.has_reservation || filters.has_loyalty || filters.has_surplus_food || searchTerm) && (
                  <button 
                    className="btn btn-sm btn-outline-orange"
                    onClick={resetFilters}
                  >
                    <i className="bi bi-x-circle me-1"></i>
                    清除篩選
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 載入中 - 骨架屏 */}
        {loading && (
          <div className="row g-4">
            {[1, 2, 3, 4, 5, 6].map(index => (
              <div key={index} className="col-md-6 col-lg-4">
                <div className="store-card skeleton-loading">
                  <div className="skeleton-image"></div>
                  <div className="store-card-body">
                    <div className="skeleton-title"></div>
                    <div className="skeleton-text"></div>
                    <div className="skeleton-text short"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 店家列表 */}
        {!loading && (
          <>
            {selectedCategory === 'recommended' && stores.length > 0 && user && (
              <div className="row mb-3">
                <div className="col-12">
                  <div className="recommendation-banner">
                    <i className="bi bi-heart-fill me-2"></i>
                    {userPreferences && userPreferences.favorite_tags && userPreferences.favorite_tags.length > 0 ? (
                      <>
                        因為您喜歡
                        <strong className="mx-2">
                          {userPreferences.favorite_tags.slice(0, 3).map(t => t.tag).join('、')}
                        </strong>
                        類型的美食，為您推薦以下店家
                      </>
                    ) : (
                      <>
                        根據您的點餐喜好，為您精選以下店家
                        {console.log('[Debug] userPreferences:', userPreferences)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="row g-4">
              {stores.map(store => (
                <div key={store.id} className="col-md-6 col-lg-4">
                  <Link 
                    to={`/store/${store.id}`} 
                    className="text-decoration-none"
                  >
                    <div className={`store-card ${store.isRecommended ? 'recommended-store' : ''}`}>
                      <div className="store-image" style={{
                        backgroundImage: `url(${store.imageUrl})`,
                      }}>
                        {store.isRecommended && (
                          <span className="badge-recommended">
                            <i className="bi bi-heart-fill me-1"></i>
                            為你推薦
                          </span>
                        )}
                        {store.is_open ? (
                          <span className="badge-status open">營業中</span>
                        ) : (
                          <span className="badge-status closed">休息中</span>
                        )}
                      </div>
                      <div className="store-card-body">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 className="store-name mb-0">{store.name}</h5>
                          <span className="badge-rating">
                            <i className="bi bi-star-fill me-1"></i>
                            {store.rating}
                          </span>
                        </div>
                        <p className="store-category mb-2">
                          <i className="bi bi-tag me-1"></i>
                          {getCuisineTypeName(store.cuisine_type)}
                        </p>
                        <div className="store-features mb-3">
                          {store.enable_reservation && (
                            <span className="feature-badge">
                              <i className="bi bi-calendar-check"></i> 可訂位
                            </span>
                          )}
                          {store.enable_loyalty && (
                            <span className="feature-badge">
                              <i className="bi bi-award"></i> 會員
                            </span>
                          )}
                          {store.enable_surplus_food && (
                            <span className="feature-badge">
                              <i className="bi bi-recycle"></i> 惜福
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="store-card-footer">
                        <button className="btn-view-store">
                          查看店家
                          <i className="bi bi-arrow-right ms-2"></i>
                        </button>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 無結果提示 */}
        {!loading && stores.length === 0 && (
          <div className="text-center py-5">
            {selectedCategory === 'recommended' && !user ? (
              <>
                <i className="bi bi-lock display-1 text-muted"></i>
                <p className="lead mt-3">請先登入會員</p>
                <p className="text-muted">登入後即可查看根據您的喜好推薦的店家</p>
                <Link to="/login" className="btn btn-orange mt-3">
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  立即登入
                </Link>
              </>
            ) : selectedCategory === 'recommended' ? (
              <>
                <i className="bi bi-heart display-1 text-muted"></i>
                <p className="lead mt-3">還沒有足夠的資料產生推薦</p>
                <p className="text-muted">多訂購幾次餐點，我們就能為您推薦更適合的店家！</p>
                <button 
                  className="btn btn-orange mt-3"
                  onClick={() => setSelectedCategory('all')}
                >
                  <i className="bi bi-shop me-2"></i>
                  瀏覽所有店家
                </button>
              </>
            ) : (
              <>
                <i className="bi bi-search display-1 text-muted"></i>
                <p className="lead mt-3">找不到符合條件的店家</p>
                <button 
                  className="btn btn-orange"
                  onClick={resetFilters}
                >
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  重設搜尋條件
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerHomePage;