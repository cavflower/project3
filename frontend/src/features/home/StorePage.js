
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

  // ???????
  const [displayedProducts, setDisplayedProducts] = useState(20); // ??憿舐內20??
  const PRODUCTS_PER_PAGE = 20;


  useEffect(() => {
    loadStoreData();
  }, [storeId]);

  // ?嗅????惜??頛??
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
      // ?郊??摨振閰?蝯梯?嚗?潮?擐＊蝷?
      try {
        const reviewsRes = await api.get(`/reviews/store-reviews/?store_id=${storeId}`);
        const reviews = reviewsRes.data || [];
        const avg = reviews.length > 0
          ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : 0;
        setReviewStats({ avg, count: reviews.length });
      } catch (e) {
        console.warn('頛摨振閰?蝯梯?憭望?', e);
        setReviewStats({ avg: 0, count: 0 });
      }
      // 蝘駁?ㄐ????亙???
      // await loadMenuItems(storeId);

    } catch (err) {
      console.error('Failed to load store:', err);
      setError('載入店家資料失敗，請稍後再試。');
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

  // 頛?游???
  const loadMoreProducts = useCallback(() => {
    setDisplayedProducts(prev => prev + PRODUCTS_PER_PAGE);
  }, []);

  // 憿舐內????銵剁???嚗?
  const visibleProducts = useMemo(() => {
    return menuItems.slice(0, displayedProducts);
  }, [menuItems, displayedProducts]);

  // ?臬???游???
  const hasMoreProducts = displayedProducts < menuItems.length;

  const handleJumpToReviews = useCallback(() => {
    navigate(`/store/${storeId}/reviews`);
  }, [navigate, storeId]);

  const formatBenefitPoints = (value) => {
    const amount = Number(value || 0);
    const isInteger = Number.isInteger(amount);
    return amount.toLocaleString('zh-TW', {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: isInteger ? 0 : 2,
    });
  };


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
        <p className="mt-4" style={{ fontSize: '1.1rem', color: '#6c757d' }}>載入店家資料中...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className={`container ${styles['store-error-container']}`}>
        <div className="alert alert-danger">
          <h4 style={{ marginBottom: '15px' }}>無法載入店家頁面</h4>
          <p style={{ marginBottom: '20px' }}>{error || '店家資料不存在或已下架。'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/customer-home')}>
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  const openingHoursList = formatOpeningHours(store.opening_hours);
  const businessStatus = getStoreBusinessStatus(store);
  const smokingPolicyText = store.smoking_policy === 'no_smoking'
    ? '全面禁菸'
    : store.smoking_policy === 'smoking_allowed'
      ? '可吸菸'
      : store.smoking_policy === 'separate_room'
        ? '設有吸菸區'
        : store.smoking_policy;

  // 閮?撟喳???
  const budgets = [];
  if (store.budget_lunch) budgets.push(parseFloat(store.budget_lunch));
  if (store.budget_dinner) budgets.push(parseFloat(store.budget_dinner));
  if (store.budget_banquet) budgets.push(parseFloat(store.budget_banquet));
  const avgBudget = budgets.length > 0
    ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length)
    : null;

  return (
    <div className={styles['store-page-container']} style={{ paddingBottom: '50px' }}>
      <div className="container">
        <section className={styles['store-shell']}>
          {/* 餈??????∩葉敹?*/}
          <div className={styles['store-shell-toolbar']}>
            <button
              className={styles['btn-back-store']}
              onClick={() => navigate('/customer-home')}
              type="button"
            >
              <span className={styles['btn-back-slider']} aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 1024 1024"
                  width="22"
                  height="22"
                >
                  <path
                    d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z"
                    fill="currentColor"
                  />
                  <path
                    d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className={styles['btn-back-text']}>返回</span>
            </button>

            <Link to={`/customer/loyalty/${storeId}`} className={styles['btn-shell-loyalty']}>
              會員中心
            </Link>
          </div>

          {/* 擗輒璅???祈?閮?*/}
          <div className={`${styles['store-header-section']} mb-4`}>
            <div className={styles['store-header-card']}>
            <div className={styles['store-header-media']}>
              {store.images && store.images.length > 0 ? (
                <img
                  src={store.images[0].image.startsWith('http')
                    ? store.images[0].image
                    : `http://127.0.0.1:8000${store.images[0].image}`}
                  alt={store.name}
                />
              ) : (
                <div className={styles['store-header-media-fallback']}>DineVerse</div>
              )}
            </div>

            <div className={styles['store-header-right']}>
              <div className={styles['store-header-top']}>
                <h1 className={styles['store-main-title']}>{store.name}</h1>
                <div className={styles['store-header-actions']}>
                  <span
                    className={`${styles['store-status-badge']} ${
                      businessStatus.isOpenNow ? styles['status-open'] : styles['status-closed']
                    }`}
                  >
                    <i className="bi bi-clock"></i>
                    {businessStatus.statusText}
                  </span>
                </div>
              </div>

              <div className={styles['store-basic-info']}>
                {store.address && (
                  <span className={styles['store-info-item']}>
                    <i className="bi bi-geo-alt"></i>
                    {store.address}
                  </span>
                )}
                <button
                  type="button"
                  className={`${styles['store-info-item']} ${styles['store-review-jump-btn']}`}
                  onClick={handleJumpToReviews}
                >
                  <i className="bi bi-star-fill text-warning"></i>
                  {reviewStats.avg} ({reviewStats.count} 則評論)
                </button>
              </div>

              <div className={styles['store-header-bottom']}>
                {avgBudget && (
                  <span className={styles['store-header-pill']}>
                    <i className="bi bi-currency-dollar"></i>
                    平均價格 NT$ {avgBudget.toLocaleString()}
                  </span>
                )}
                {store.phone && (
                  <span className={styles['store-header-pill']}>
                    <i className="bi bi-telephone"></i>
                    {store.phone}
                  </span>
                )}
                {store.has_wifi && (
                  <span className={styles['store-header-pill']}>
                    <i className="bi bi-wifi"></i>
                    Wi-Fi
                  </span>
                )}
                <span className={`${styles['store-header-pill']} ${styles['store-header-pill-impact']}`}>
                  <i className="bi bi-heart-fill"></i>
                  公益點數 {formatBenefitPoints(store.surplus_donation_amount)}
                </span>
              </div>

              <div className={styles['store-header-detail-grid']}>
                <section className={`${styles['store-header-detail-card']} ${styles['store-header-booking-card']}`}>
                  <div className={styles['store-header-booking-top']}>
                    <h4 className={styles['store-header-booking-title']}>開始點餐</h4>
                    <span className={styles['store-header-booking-badge']}>免費</span>
                  </div>
                  <Link
                    to={`/store/${storeId}/options`}
                    className={styles['store-header-booking-btn']}
                  >
                    <i className="bi bi-cart me-2"></i>
                    立即點餐
                  </Link>
                  <div className={styles['store-header-booking-meta']}>
                    <span>{`營業狀態：${businessStatus.statusText}`}</span>
                    {store.phone && <a href={`tel:${store.phone}`}>{store.phone}</a>}
                  </div>
                </section>

                <section className={styles['store-header-detail-card']}>
                  <h4 className={styles['store-header-detail-title']}>餐廳介紹</h4>
                  <p className={styles['store-header-detail-text']}>{store.description || '店家尚未提供介紹。'}</p>
                </section>

                <section className={styles['store-header-detail-card']}>
                  <h4 className={styles['store-header-detail-title']}>營業時間</h4>
                  {openingHoursList && openingHoursList.length > 0 ? (
                    <ul className={styles['store-header-hours-list']}>
                      {openingHoursList.map((item, index) => (
                        <li key={index}>
                          <span>{item.day}</span>
                          <span>{item.isClosed ? '公休' : item.time}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles['store-header-detail-text']}>尚未提供營業時間</p>
                  )}
                </section>

                <section className={styles['store-header-detail-card']}>
                  <h4 className={styles['store-header-detail-title']}>設施與服務</h4>
                  <div className={styles['store-header-detail-tags']}>
                    {store.has_wifi && <span>Wi-Fi</span>}
                    {store.has_english_menu && <span>英文菜單</span>}
                    {store.suitable_for_children && <span>親子友善</span>}
                    {smokingPolicyText && <span>{smokingPolicyText}</span>}
                  </div>
                  {store.credit_cards && (
                    <p className={styles['store-header-inline-text']}>信用卡：{store.credit_cards}</p>
                  )}
                </section>

                <section className={styles['store-header-detail-card']}>
                  <h4 className={styles['store-header-detail-title']}>聯絡資訊</h4>
                  <div className={styles['store-header-contact-list']}>
                    {store.phone && <a href={`tel:${store.phone}`}>{store.phone}</a>}
                    {store.email && <a href={`mailto:${store.email}`}>{store.email}</a>}
                    {store.website && <a href={store.website} target="_blank" rel="noopener noreferrer">{store.website}</a>}
                    {store.line_friend_url && (
                      <a href={store.line_friend_url} target="_blank" rel="noopener noreferrer">加入 LINE 好友</a>
                    )}
                  </div>
                </section>

                <section className={styles['store-header-detail-card']}>
                  <h4 className={styles['store-header-detail-title']}>公益點數</h4>
                  <div className={styles['store-impact-card']}>
                    <strong>{formatBenefitPoints(store.surplus_donation_amount)}</strong>
                    <p className={styles['store-header-detail-text']}>
                      公益點數等同店家累積捐款金額，反映惜食訂單帶來的公益貢獻。
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default StorePage;

