import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getPublishedStores } from '../../api/storeApi';
import { getRecommendedStores, getUserPreferences } from '../../api/recommendationApi';
import { useAuth } from '../../store/AuthContext';
import { getStoreBusinessStatus } from '../../utils/storeBusinessStatus';
import { MagicBentoCard, MagicBentoSpotlight } from '../../components/common/MagicBentoCard';
import styles from './CustomerHomePage.module.css';

const categories = [
  { id: 'all', name: '全部', icon: 'grid-3x3-gap-fill' },
  { id: 'recommended', name: '推薦', icon: 'heart-fill', requiresAuth: true },
  { id: 'japanese', name: '日式', icon: 'circle' },
  { id: 'korean', name: '韓式', icon: 'fire' },
  { id: 'american', name: '美式', icon: 'shop' },
  { id: 'taiwanese', name: '台式', icon: 'egg-fried' },
  { id: 'western', name: '西式', icon: 'cup-hot-fill' },
  { id: 'beverages', name: '飲品', icon: 'cup-straw' },
  { id: 'desserts', name: '甜點', icon: 'cake2-fill' },
  { id: 'other', name: '其他', icon: 'three-dots' }
];

const copy = {
  heroBadge: 'DineVerse 顧客端',
  heroTitle: '探索你附近的風格餐廳',
  heroText: '用分類篩選、個人化推薦與快速訂位，找到最適合你的下一餐。',
  loyaltyCenter: '會員中心',
  viewStorePrefix: '查看',
  loginRequiredForRecommendations: '請先登入才能使用個人化推薦',
  preferenceTag: '偏好標籤',
  topPick: '精選推薦',
  allStores: '所有店家',
  clearFilters: '清除篩選',
  openNow: '營業中',
  reservation: '訂位',
  loyalty: '會員',
  surplus: '惜食',
  loginRequiredTitle: '需要登入才能查看個人化推薦',
  noMatchedStoresTitle: '目前沒有符合條件的店家',
  loginRequiredDescription: '登入後即可解鎖推薦清單。',
  noMatchedStoresDescription: '請嘗試其他分類、關鍵字或功能篩選。',
  login: '登入',
  reset: '重設',
  fallbackStoreAlt: 'DineVerse 店家',
  switchToStorePrefix: '切換到',
  uncategorized: '未分類',
  defaultStoreDescription: '探索店家招牌菜與特色氛圍。',
  defaultAddress: '暫無地址資訊'
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80';

function normalizeStore(store) {
  return {
    id: store.id,
    name: store.name,
    description: store.description || copy.defaultStoreDescription,
    address: store.address || copy.defaultAddress,
    cuisine_type: store.cuisine_type,
    rating: 4.5,
    imageUrl: store.first_image
      ? store.first_image.startsWith('http')
        ? store.first_image
        : `http://127.0.0.1:8000${store.first_image}`
      : FALLBACK_IMAGE,
    is_open: store.is_open,
    enable_reservation: store.enable_reservation,
    enable_loyalty: store.enable_loyalty,
    enable_surplus_food: store.enable_surplus_food,
    opening_hours: store.opening_hours,
    isRecommended: false
  };
}

function CustomerHomePage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userPreferences, setUserPreferences] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const cardsGridRef = useRef(null);
  const [filters, setFilters] = useState({
    has_reservation: false,
    has_loyalty: false,
    has_surplus_food: false
  });
  const searchKeyword = useMemo(
    () => new URLSearchParams(location.search).get('q')?.trim() || '',
    [location.search]
  );

  const loadStores = useCallback(async () => {
    try {
      setLoading(true);

      if (selectedCategory === 'recommended') {
        if (!user) {
          setStores([]);
          return;
        }

        try {
          const preferencesResponse = await getUserPreferences();
          setUserPreferences(preferencesResponse.data);

          const preferredTags = preferencesResponse.data?.favorite_tags || [];
          if (selectedTags.length === 0 && preferredTags.length > 0) {
            setSelectedTags([preferredTags[0].tag]);
          }

          const response = await getRecommendedStores(12, selectedTags.length > 0 ? selectedTags : null);
          let nextStores = response.data.map((store) => ({
            ...normalizeStore(store),
            isRecommended: true
          }));
          if (searchKeyword) {
            const normalizedKeyword = searchKeyword.toLowerCase();
            nextStores = nextStores.filter((store) =>
              `${store.name} ${store.cuisine_type} ${store.address}`.toLowerCase().includes(normalizedKeyword)
            );
          }
          setStores(nextStores);
        } catch (error) {
          console.error('載入推薦店家失敗，改為載入公開店家。', error);
          const response = await getPublishedStores({ cuisine_type: 'all', search: searchKeyword, ...filters });
          setStores(response.data.slice(0, 12).map(normalizeStore));
        }
      } else {
        const response = await getPublishedStores({
          cuisine_type: selectedCategory,
          search: searchKeyword,
          ...filters
        });
        setStores(response.data.map(normalizeStore));
      }
    } catch (error) {
      console.error('載入店家失敗：', error);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [filters, searchKeyword, selectedCategory, selectedTags, user]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const heroStores = useMemo(() => stores.slice(0, Math.min(4, stores.length)), [stores]);
  const showcaseStores = useMemo(() => stores.slice(0, Math.min(5, stores.length)), [stores]);

  useEffect(() => {
    if (heroStores.length <= 1) return undefined;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroStores.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroStores.length]);

  useEffect(() => {
    setHeroIndex(0);
  }, [stores]);

  const getCuisineTypeName = (type) => {
    const category = categories.find((cat) => cat.id === type);
    return category ? category.name : type || copy.uncategorized;
  };

  const handleFilterChange = (filterName) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedTags([]);
    setFilters({
      has_reservation: false,
      has_loyalty: false,
      has_surplus_food: false
    });
    navigate('/customer-home');
  };

  const currentHero = heroStores[heroIndex];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.heroMedia}>
            <img
              src={currentHero?.imageUrl || FALLBACK_IMAGE}
              alt={currentHero?.name || copy.fallbackStoreAlt}
              className={styles.heroImage}
            />
            <div className={styles.heroOverlay} />
            <div className={styles.heroDots}>
              {heroStores.map((store, index) => (
                <button
                  key={store.id}
                  type="button"
                  className={`${styles.heroDot} ${index === heroIndex ? styles.activeDot : ''}`}
                  onClick={() => setHeroIndex(index)}
                  aria-label={`${copy.switchToStorePrefix} ${store.name}`}
                />
              ))}
            </div>
          </div>

          <div className={styles.heroContent}>
            <span className={styles.heroBadge}>{copy.heroBadge}</span>
            <h1 className={styles.heroTitle}>{copy.heroTitle}</h1>
            <p className={styles.heroText}>{copy.heroText}</p>
            <div className={styles.heroActions}>
              <Link to="/customer/loyalty" className={styles.primaryBtn}>
                {copy.loyaltyCenter}
              </Link>
              {currentHero && (
                <Link to={`/store/${currentHero.id}`} className={styles.secondaryBtn}>
                  {copy.viewStorePrefix} {currentHero.name}
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className={styles.searchPanel}>
          <div className={styles.pillNavWrap}>
            {categories.map((category) => {
              const isLocked = category.requiresAuth && !user;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.pillCategory} ${selectedCategory === category.id ? styles.pillCategoryActive : ''}`}
                  onClick={() => {
                    if (isLocked) {
                      alert(copy.loginRequiredForRecommendations);
                      return;
                    }
                    setSelectedCategory(category.id);
                  }}
                >
                  <span className={styles.pillHoverCircle} aria-hidden="true" />
                  <span className={styles.pillLabelStack}>
                    <span className={styles.pillLabel}>
                      <i className={`bi bi-${category.icon}`} />
                      {category.name}
                      {isLocked && <i className="bi bi-lock-fill" />}
                    </span>
                    <span className={styles.pillLabelHover} aria-hidden="true">
                      <i className={`bi bi-${category.icon}`} />
                      {category.name}
                      {isLocked && <i className="bi bi-lock-fill" />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.chipGroup}>
            <button
              type="button"
              className={`${styles.filterChip} ${filters.has_reservation ? styles.filterChipActive : ''}`}
              onClick={() => handleFilterChange('has_reservation')}
            >
              <i className="bi bi-calendar-check" /> {copy.reservation}
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${filters.has_loyalty ? styles.filterChipActive : ''}`}
              onClick={() => handleFilterChange('has_loyalty')}
            >
              <i className="bi bi-award" /> {copy.loyalty}
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${filters.has_surplus_food ? styles.filterChipActive : ''}`}
              onClick={() => handleFilterChange('has_surplus_food')}
            >
              <i className="bi bi-recycle" /> {copy.surplus}
            </button>
          </div>

          {selectedCategory === 'recommended' && user && userPreferences?.favorite_tags?.length > 1 && (
            <div className={styles.preferenceRow}>
              <label htmlFor="prefTag">{copy.preferenceTag}</label>
              <select
                id="prefTag"
                value={selectedTags[0] || ''}
                onChange={(e) => setSelectedTags(e.target.value ? [e.target.value] : [])}
              >
                {userPreferences.favorite_tags.map((tagData, index) => (
                  <option key={`${tagData.tag}-${index}`} value={tagData.tag}>
                    {tagData.tag} ({tagData.count})
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {!loading && showcaseStores.length >= 3 && (
          <section className={styles.visualShowcase}>
            <article className={`${styles.showcaseCard} ${styles.showcasePrimary}`}>
              <img src={showcaseStores[0].imageUrl} alt={showcaseStores[0].name} />
              <div className={styles.showcaseOverlay}>
                <p>{copy.topPick}</p>
                <h3>{showcaseStores[0].name}</h3>
              </div>
            </article>

            <div className={styles.showcaseColumn}>
              {showcaseStores.slice(1, 3).map((store, index) => (
                <article
                  key={store.id}
                  className={`${styles.showcaseCard} ${index === 0 ? styles.showcaseSecondary : styles.showcaseTertiary}`}
                >
                  <img src={store.imageUrl} alt={store.name} />
                  <div className={styles.showcaseOverlay}>
                    <p>{getCuisineTypeName(store.cuisine_type)}</p>
                    <h3>{store.name}</h3>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!loading && (
          <div className={styles.listHeader}>
            <h2>{copy.allStores}</h2>
            {(selectedCategory !== 'all' || searchKeyword || Object.values(filters).some(Boolean)) && (
              <button type="button" className={styles.resetBtn} onClick={resetFilters}>
                {copy.clearFilters}
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className={`${styles.storeCard} ${styles.skeleton}`}>
                <div className={styles.skeletonImage} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLineShort} />
              </div>
            ))}
          </div>
        )}

        {!loading && stores.length > 0 && (
          <>
            <MagicBentoSpotlight
              gridRef={cardsGridRef}
              disableAnimations={false}
              enabled
              spotlightRadius={240}
              glowColor="255, 107, 53"
            />
            <div className={styles.grid} ref={cardsGridRef}>
            {stores.map((store) => {
              const businessStatus = getStoreBusinessStatus(store);
              return (
                <Link key={store.id} to={`/store/${store.id}`} className={styles.storeLink}>
                  <MagicBentoCard
                    className={styles.storeCard}
                    glowColor="255, 107, 53"
                    particleCount={9}
                    enableTilt={false}
                    clickEffect
                    enableMagnetism={false}
                  >
                    <div className={styles.storeImageWrap}>
                      <img src={store.imageUrl} alt={store.name} className={styles.storeImage} />
                      <span className={`${styles.statusBadge} ${businessStatus.isOpenNow ? styles.open : styles.closed}`}>
                        {businessStatus.isOpenNow ? copy.openNow : '\u4f11\u606f\u4e2d'}
                      </span>
                    </div>
                    <div className={styles.storeBody}>
                      <span className={styles.ratingFixed}><i className="bi bi-star-fill" /> {store.rating}</span>
                      <div className={styles.storeTitleRow}>
                        <h3>{store.name}</h3>
                      </div>
                      <p className={styles.cuisine}>{getCuisineTypeName(store.cuisine_type)}</p>
                      <p className={styles.address}>{store.address}</p>
                      <div className={styles.featureRow}>
                        {store.enable_reservation && <span>{copy.reservation}</span>}
                        {store.enable_loyalty && <span>{copy.loyalty}</span>}
                        {store.enable_surplus_food && <span>{copy.surplus}</span>}
                      </div>
                    </div>
                  </MagicBentoCard>
                </Link>
              );
            })}
            </div>
          </>
        )}

        {!loading && stores.length === 0 && (
          <section className={styles.emptyState}>
            <i className="bi bi-search" />
            <h3>
              {selectedCategory === 'recommended' && !user
                ? copy.loginRequiredTitle
                : copy.noMatchedStoresTitle}
            </h3>
            <p>
              {selectedCategory === 'recommended' && !user
                ? copy.loginRequiredDescription
                : copy.noMatchedStoresDescription}
            </p>
            {selectedCategory === 'recommended' && !user ? (
              <Link to="/login" className={styles.primaryBtn}>
                {copy.login}
              </Link>
            ) : (
              <button type="button" className={styles.primaryBtn} onClick={resetFilters}>
                {copy.reset}
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default CustomerHomePage;
