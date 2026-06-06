
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import api from '../../api/api';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import { getStoreBusinessStatus } from '../../utils/storeBusinessStatus';
import styles from './StorePage.module.css';

const getCuisineTypeName = (type) => {
  const cuisineTypes = {
    japanese: '日式',
    korean: '韓式',
    american: '美式',
    taiwanese: '台式',
    western: '西式',
    beverages: '飲料',
    desserts: '甜點',
    other: '其他',
  };

  return cuisineTypes[type] || type || '其他';
};

function StorePage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);


  const loadStoreData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [storeResult, reviewsResult] = await Promise.allSettled([
        getStore(storeId),
        api.get(`/reviews/store-reviews/?store_id=${storeId}&summary=1`)
      ]);

      if (storeResult.status !== 'fulfilled') {
        throw storeResult.reason;
      }

      setStore(storeResult.value.data);
      // ?郊??摨振閰?蝯梯?嚗?潮?擐＊蝷?
      try {
        if (reviewsResult.status !== 'fulfilled') {
          throw reviewsResult.reason;
        }

        setReviewStats({
          avg: reviewsResult.value.data?.avg || 0,
          count: reviewsResult.value.data?.count || 0
        });
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
  }, [storeId]);

  useEffect(() => {
    loadStoreData();
  }, [loadStoreData]);

  const handleJumpToReviews = useCallback(() => {
    navigate(`/store/${storeId}/reviews`);
  }, [navigate, storeId]);

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
      const openTime = info.open || info.start || info.open_time || info.start_time;
      const closeTime = info.close || info.end || info.close_time || info.end_time;
      return {
        day: dayNames[day],
        isClosed: info.is_closed || (!openTime && !closeTime),
        time: info.is_closed
          ? null
          : openTime && closeTime
            ? `${openTime} - ${closeTime}`
            : '尚未提供'
      };
    }).filter(item => item !== null);
  };


  if (loading) {
    return <SkeletonLoader rows={8} sidebar />;
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
  const cuisineTypeName = getCuisineTypeName(store.cuisine_type);
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
  const storeImages = Array.isArray(store.images)
    ? store.images.map((image) => ({
      ...image,
      image: image.image?.startsWith('http')
        ? image.image
        : `http://127.0.0.1:8000${image.image}`,
    }))
    : [];
  const primaryImageUrl = storeImages[0]?.image || null;
  const mapQuery = encodeURIComponent(store.address || store.name || '');
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const serviceItems = Array.from(new Map([
    store.has_wifi && { icon: 'bi-wifi', label: '免費 Wi-Fi', detail: '免費提供' },
    store.suitable_for_children && { icon: 'bi-person-hearts', label: '兒童座椅', detail: '親子適合' },
    store.has_english_menu && { icon: 'bi-translate', label: '英文菜單', detail: '外語友善' },
    store.credit_cards && { icon: 'bi-credit-card', label: '刷卡服務', detail: '支援信用卡' },
    smokingPolicyText && { icon: 'bi-flower1', label: smokingPolicyText, detail: '店內規範' },
    store.parking_info && { icon: 'bi-car-front', label: '停車資訊', detail: store.parking_info },
    { icon: 'bi-snow', label: '冷氣開放', detail: '舒適用餐' },
    { icon: 'bi-phone', label: '行動支付', detail: '快速結帳' },
    { icon: 'bi-columns-gap', label: '包廂座位', detail: '聚餐適合' },
    { icon: 'bi-universal-access', label: '無障礙空間', detail: '友善動線' },
    { icon: 'bi-paw', label: '寵物友善', detail: '依現場規範' },
  ].filter(Boolean).map((item) => [item.label, item])).values()).slice(0, 8);
  const benefitPoints = Number(store.surplus_donation_amount || 0);
  const benefitPointsText = benefitPoints.toLocaleString('zh-TW', {
    maximumFractionDigits: Number.isInteger(benefitPoints) ? 0 : 2,
  });
  const signatureItems = [
    {
      title: `${cuisineTypeName || '主廚'}精選`,
      tag: '人氣推薦',
      price: avgBudget ? `$${avgBudget.toLocaleString()}` : '依現場為準',
      image: storeImages[1]?.image || null,
    },
    {
      title: '招牌套餐',
      tag: '必點',
      price: avgBudget ? `$${Math.max(0, Math.round(avgBudget * 0.8)).toLocaleString()}` : '依現場為準',
      image: storeImages[2]?.image || null,
    },
    {
      title: '人氣小點',
      tag: '人氣推薦',
      price: avgBudget ? `$${Math.max(0, Math.round(avgBudget * 0.45)).toLocaleString()}` : '依現場為準',
      image: storeImages[3]?.image || null,
    },
    {
      title: '季節時蔬',
      tag: '清爽搭配',
      price: avgBudget ? `$${Math.max(0, Math.round(avgBudget * 0.35)).toLocaleString()}` : '依現場為準',
      image: storeImages[4]?.image || storeImages[0]?.image || null,
    },
  ];
  const galleryImages = storeImages.slice(0, 4);
  const heroStyle = primaryImageUrl
    ? { '--store-hero-image': `url("${primaryImageUrl}")` }
    : undefined;
  const shareUrl = window.location.href;
  const shareText = `${store.name} - DineVerse`;
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(shareText);
  const orderPath = `/store/${storeId}/takeout`;

  const handleShare = async () => {
    const shareData = {
      title: store.name,
      text: shareText,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    setShowShareMenu((visible) => !visible);
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (err) {
      console.warn('Copy share link failed:', err);
    }
    setShowShareMenu(false);
  };

  return (
    <div className={styles['store-page-container']} style={heroStyle}>
      <section className={styles['soft-store-shell']}>
        <div className={styles['soft-toolbar']}>
          <button className={styles['soft-back-btn']} onClick={() => navigate('/customer-home')} type="button">
            <i className="bi bi-arrow-left"></i>
            返回
          </button>
          <div className={styles['soft-toolbar-actions']}>
            <button type="button" onClick={handleShare} aria-expanded={showShareMenu}>
              <i className="bi bi-share"></i>分享
            </button>
            {showShareMenu && (
              <div className={styles['soft-share-menu']}>
                <a href={`https://social-plugins.line.me/lineit/share?url=${encodedShareUrl}`} target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-chat-dots"></i>LINE
                </a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`} target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-facebook"></i>Facebook
                </a>
                <a href={`https://www.instagram.com/direct/inbox/?text=${encodedShareText}%20${encodedShareUrl}`} target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-instagram"></i>Instagram
                </a>
                <button type="button" onClick={handleCopyShareLink}>
                  <i className="bi bi-link-45deg"></i>複製連結
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles['soft-hero-layout']}>
          <div className={styles['soft-hero-info']}>
            <div className={styles['soft-title-row']}>
              <h1>{store.name}</h1>
              {store.cuisine_type && <span>{cuisineTypeName}</span>}
            </div>
            <div className={styles['soft-meta-row']}>
              <span className={businessStatus.isOpenNow ? styles['soft-open'] : styles['soft-closed']}>
                <i className="bi bi-circle-fill"></i>
                {businessStatus.statusText}
              </span>
              <button type="button" onClick={handleJumpToReviews}><i className="bi bi-star-fill"></i>{reviewStats.avg} ({reviewStats.count} 則評論)</button>
              {avgBudget && <span>$ $　中價位</span>}
            </div>
            {store.address && <p className={styles['soft-address']}><i className="bi bi-geo-alt"></i>{store.address}</p>}
            <div className={styles['soft-contact-row']}>
              {store.phone && <a href={`tel:${store.phone}`}><i className="bi bi-telephone"></i>{store.phone}</a>}
              {store.line_friend_url && <a href={store.line_friend_url} target="_blank" rel="noopener noreferrer"><i className="bi bi-chat-dots"></i>Line</a>}
              {store.website && <a href={store.website} target="_blank" rel="noopener noreferrer"><i className="bi bi-globe"></i>官方網站</a>}
            </div>
            <div className={styles['soft-action-row']}>
              <Link to={orderPath} className={styles['soft-primary-action']}><i className="bi bi-bag"></i>立即點餐</Link>
              {store.enable_reservation && <Link to={`/reservation/new/${storeId}`} className={styles['soft-secondary-action']}><i className="bi bi-calendar-check"></i>預約訂位</Link>}
            </div>
          </div>

          <div className={styles['soft-gallery-strip']}>
            {Array.from({ length: 4 }, (_, index) => galleryImages[index] || null).map((image, index) => (
              <div key={image ? `${image.image}-${index}` : `placeholder-${index}`} className={styles['soft-gallery-thumb']}>
                {image ? <img src={image.image} alt={`${store.name} ${index + 1}`} /> : <i className="bi bi-image"></i>}
              </div>
            ))}
            <button type="button" className={styles['soft-gallery-more']}>
              <i className="bi bi-images"></i>
              查看全部
              <strong>{storeImages.length || 1}+</strong>
            </button>
          </div>
        </div>

        <div className={styles['soft-card-grid']}>
          <section className={styles['soft-card']}>
            <h2><i className="bi bi-clock"></i>營業時間</h2>
            {openingHoursList && openingHoursList.length > 0 ? (
              <ul className={styles['soft-hours-list']}>
                {openingHoursList.map((item, index) => (
                  <li key={index}><span>{item.day}</span><span>{item.isClosed ? '公休' : item.time}</span></li>
                ))}
              </ul>
            ) : <p>店家尚未提供營業時間。</p>}
          </section>

          <section className={styles['soft-card']}>
            <h2><i className="bi bi-journal-text"></i>餐廳介紹</h2>
            <p>{store.description || '店家尚未提供介紹。'}</p>
          </section>

          <section className={styles['soft-card']}>
            <h2><i className="bi bi-shop"></i>設施與服務</h2>
            <div className={styles['soft-service-grid']}>
              {serviceItems.length > 0 ? serviceItems.map((item) => (
                <span key={item.label}><i className={`bi ${item.icon}`}></i>{item.label}</span>
              )) : <span>店家尚未提供</span>}
            </div>
          </section>

          <section className={styles['soft-card']}>
            <div className={styles['soft-card-title-row']}>
              <h2><i className="bi bi-award"></i>招牌推薦</h2>
              <Link to={orderPath}>查看全部<i className="bi bi-chevron-right"></i></Link>
            </div>
            <div className={styles['soft-menu-list']}>
              {signatureItems.map((item, index) => (
                <article key={`${item.title}-${index}`}>
                  <div>{item.image ? <img src={item.image} alt={item.title} /> : <i className="bi bi-image"></i>}</div>
                  <strong>{item.title}</strong>
                  <span><i className="bi bi-star-fill"></i>{item.tag}</span>
                  <em>{item.price}</em>
                </article>
              ))}
            </div>
          </section>

          <section className={`${styles['soft-card']} ${styles['soft-benefit-card']}`}>
            <h2><i className="bi bi-heart"></i>公益點數</h2>
            <strong>{benefitPointsText}</strong>
            <p>公益點數等同店家累積捐款金額，反映惜食訂單帶來的公益貢獻。</p>
          </section>

          <section className={`${styles['soft-card']} ${styles['soft-map-card']}`}>
            <h2><i className="bi bi-geo-alt"></i>地圖位置</h2>
            <div className={styles['soft-map-content']}>
              <div className={styles['soft-map-preview']}><span><i className="bi bi-geo-alt-fill"></i></span></div>
              <div className={styles['soft-map-side']}>
                {store.address && <p className={styles['soft-map-address']}><i className="bi bi-geo-alt"></i>{store.address}</p>}
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={styles['soft-map-link']}>以地圖查看<i className="bi bi-box-arrow-up-right"></i></a>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );

}

export default StorePage;
