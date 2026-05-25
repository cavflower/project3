import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getPublishedStores } from '../../api/storeApi';
import { getRecommendedStores, getUserPreferences } from '../../api/recommendationApi';
import { useAuth } from '../../store/AuthContext';
import { getStoreBusinessStatus } from '../../utils/storeBusinessStatus';
import taiwanesePorkRiceImage from '../../assets/category-taiwanese-pork-rice.png';
import styles from './CustomerHomePage.module.css';

const categories = [
  {
    id: 'all',
    name: '全部',
    icon: 'grid-3x3-gap-fill',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'recommended',
    name: '為你推薦',
    icon: 'heart-fill',
    requiresAuth: true,
    image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'japanese',
    name: '日式料理',
    icon: 'circle',
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'korean',
    name: '韓式料理',
    icon: 'fire',
    image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=700&q=80',
    objectPosition: 'center 62%',
  },
  {
    id: 'american',
    name: '美式料理',
    icon: 'shop',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'taiwanese',
    name: '台式料理',
    icon: 'egg-fried',
    image: taiwanesePorkRiceImage,
    objectPosition: 'center 56%',
  },
  {
    id: 'western',
    name: '西式料理',
    icon: 'cup-hot-fill',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'beverages',
    name: '飲品咖啡',
    icon: 'cup-straw',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'desserts',
    name: '甜點蛋糕',
    icon: 'cake2-fill',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 'other',
    name: '其他料理',
    icon: 'three-dots',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=700&q=80',
  }
];

const regionOptions = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '宜蘭縣', '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣',
  '嘉義縣', '屏東縣', '花蓮縣', '臺東縣', '澎湖縣',
  '基隆市', '新竹市', '嘉義市'
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
  spotlightTitle: '本日精選',
  spotlightSubtitle: '精選人氣餐廳，為你推薦最棒的用餐選擇',
  spotlightLead: '查看更多',
  spotlightNew: '本日精選',
  spotlightPopular: '人氣餐廳',
  spotlightDessert: '今日推薦',
  reserveNow: '立即訂位',
  allStores: '所有店家',
  clearFilters: '清除篩選',
  region: '地區',
  allRegions: '全部地區',
  sortBy: '排序方式',
  sortNewest: '最新上架',
  sortDonationDesc: '公益點數由高到低',
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
    region: store.region || '',
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
    surplus_donation_amount: Number(store.surplus_donation_amount || 0),
    plan: store.plan || '',
    budget_lunch: store.budget_lunch,
    budget_dinner: store.budget_dinner,
    averageBudget: getAverageBudget(store),
    opening_hours: store.opening_hours,
    isRecommended: false
  };
}

function getAverageBudget(store) {
  const budgets = [store.budget_lunch, store.budget_dinner]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (budgets.length === 0) return null;
  return budgets.reduce((sum, value) => sum + value, 0) / budgets.length;
}

function sortStoresByMode(list, sortBy) {
  if (sortBy === 'donation_desc') {
    return [...list].sort((a, b) => {
      if (b.surplus_donation_amount !== a.surplus_donation_amount) {
        return b.surplus_donation_amount - a.surplus_donation_amount;
      }
      return (b.id || 0) - (a.id || 0);
    });
  }

  if (sortBy === 'rating_desc') {
    return [...list].sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return (b.id || 0) - (a.id || 0);
    });
  }

  if (sortBy === 'price_asc' || sortBy === 'price_desc') {
    return [...list].sort((a, b) => {
      const priceA = a.averageBudget ?? Number.POSITIVE_INFINITY;
      const priceB = b.averageBudget ?? Number.POSITIVE_INFINITY;
      if (priceA !== priceB) {
        return sortBy === 'price_asc' ? priceA - priceB : priceB - priceA;
      }
      return (b.id || 0) - (a.id || 0);
    });
  }

  return list;
}

function formatBenefitPoints(value) {
  const amount = Number(value || 0);
  const isInteger = Number.isInteger(amount);
  return amount.toLocaleString('zh-TW', {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: isInteger ? 0 : 2,
  });
}

function normalizeRegionSearchText(value) {
  return String(value || '').trim().toLowerCase().replaceAll('台', '臺');
}

function storeMatchesRegion(store, region) {
  const normalizedRegion = normalizeRegionSearchText(region);
  if (!normalizedRegion) return true;

  return [store.region, store.address]
    .map(normalizeRegionSearchText)
    .some((value) => value.includes(normalizedRegion));
}

const SPOTLIGHT_PLAN_IDS = new Set(['premium', 'enterprise']);

function isSpotlightEligible(store) {
  return SPOTLIGHT_PLAN_IDS.has(String(store.plan || '').toLowerCase());
}

function getWeeklyRotationSeed() {
  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor((now - firstDayOfYear) / 86400000);
  const weekNumber = Math.floor((daysSinceStart + firstDayOfYear.getDay()) / 7);
  return `${now.getFullYear()}-${weekNumber}`;
}

function getStableRotationScore(store, seed) {
  const source = `${seed}:${store.id}:${store.name}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function selectSpotlightStores(list, limit = 3) {
  if (!Array.isArray(list) || list.length === 0) return [];

  const premiumStores = list.filter(isSpotlightEligible);
  const fallbackStores = list.filter((store) => !isSpotlightEligible(store));
  const seed = getWeeklyRotationSeed();
  const byRotationScore = (a, b) => getStableRotationScore(a, seed) - getStableRotationScore(b, seed);

  return [
    ...premiumStores.sort(byRotationScore),
    ...fallbackStores.sort(byRotationScore),
  ]
    .slice(0, Math.min(limit, list.length));
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
  const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState('');
  const [draftRegions, setDraftRegions] = useState([]);
  const [categoryRailState, setCategoryRailState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });
  const categoryRailRef = useRef(null);
  const [filters, setFilters] = useState({
    regions: [],
    has_reservation: false,
    has_loyalty: false,
    has_surplus_food: false,
    sort_by: '',
  });
  const searchKeyword = useMemo(
    () => new URLSearchParams(location.search).get('q')?.trim() || '',
    [location.search]
  );
  const preferenceTags = userPreferences?.favorite_tags || [];
  const popularCategories = useMemo(
    () => categories.filter((category) => category.id !== 'all'),
    []
  );
  const selectedRegions = useMemo(() => filters.regions || [], [filters.regions]);
  const filteredRegionOptions = useMemo(() => {
    const keyword = normalizeRegionSearchText(regionSearch);
    if (!keyword) return regionOptions;
    return regionOptions.filter((region) => normalizeRegionSearchText(region).includes(keyword));
  }, [regionSearch]);
  const hasActiveFilters = useMemo(
    () => (
      selectedCategory !== 'all'
      || Boolean(searchKeyword)
      || selectedRegions.length > 0
      || filters.has_reservation
      || filters.has_loyalty
      || filters.has_surplus_food
      || Boolean(filters.sort_by)
    ),
    [filters.has_loyalty, filters.has_reservation, filters.has_surplus_food, filters.sort_by, searchKeyword, selectedCategory, selectedRegions.length]
  );

  const filterStoresByRegions = useCallback((list) => {
    if (selectedRegions.length === 0) return list;
    return list.filter((store) => selectedRegions.some((region) => storeMatchesRegion(store, region)));
  }, [selectedRegions]);

  const buildStoreQueryFilters = useCallback((baseFilters = {}) => {
    const { regions, ...nextFilters } = {
      ...filters,
      ...baseFilters,
    };
    return nextFilters;
  }, [filters]);

  const loadStores = useCallback(async () => {
    try {
      setLoading(true);

      if (selectedCategory === 'recommended') {
        if (!user) {
          setStores([]);
          return;
        }

        try {
          const preferencesResponse = userPreferences
            ? { data: userPreferences }
            : await getUserPreferences();
          if (!userPreferences) {
            setUserPreferences(preferencesResponse.data);
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
          nextStores = filterStoresByRegions(nextStores);
          setStores(sortStoresByMode(nextStores, filters.sort_by));
        } catch (error) {
          console.error('載入推薦店家失敗，改為載入公開店家。', error);
          const response = await getPublishedStores(buildStoreQueryFilters({ cuisine_type: 'all', search: searchKeyword }));
          const nextStores = filterStoresByRegions(response.data.slice(0, 12).map(normalizeStore));
          setStores(sortStoresByMode(nextStores, filters.sort_by));
        }
      } else {
        const response = await getPublishedStores(buildStoreQueryFilters({
          cuisine_type: selectedCategory,
          search: searchKeyword,
        }));
        const nextStores = filterStoresByRegions(response.data.map(normalizeStore));
        setStores(sortStoresByMode(nextStores, filters.sort_by));
      }
    } catch (error) {
      console.error('載入店家失敗：', error);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [buildStoreQueryFilters, filterStoresByRegions, filters.sort_by, searchKeyword, selectedCategory, selectedTags, user, userPreferences]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const heroStores = useMemo(() => stores.slice(0, Math.min(4, stores.length)), [stores]);
  const spotlightStores = useMemo(() => selectSpotlightStores(stores, 3), [stores]);

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

  useEffect(() => {
    if (isRegionMenuOpen) {
      setRegionSearch('');
      setDraftRegions(selectedRegions);
    }
  }, [isRegionMenuOpen, selectedRegions]);

  useEffect(() => {
    if (!isRegionMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isRegionMenuOpen]);

  const updateCategoryRailState = useCallback(() => {
    const rail = categoryRailRef.current;
    if (!rail) return;

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setCategoryRailState({
      canScrollLeft: rail.scrollLeft > 2,
      canScrollRight: rail.scrollLeft < maxScrollLeft - 2,
    });
  }, []);

  useEffect(() => {
    updateCategoryRailState();
    window.addEventListener('resize', updateCategoryRailState);

    return () => {
      window.removeEventListener('resize', updateCategoryRailState);
    };
  }, [popularCategories.length, updateCategoryRailState]);

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
      regions: [],
      has_reservation: false,
      has_loyalty: false,
      has_surplus_food: false,
      sort_by: '',
    });
    navigate('/customer-home');
  };

  const toggleRegion = (region) => {
    setDraftRegions((prev) => (
      prev.includes(region)
        ? prev.filter((item) => item !== region)
        : [...prev, region]
    ));
  };

  const clearRegions = () => {
    if (isRegionMenuOpen) {
      setDraftRegions([]);
      return;
    }

    setFilters((prev) => ({
      ...prev,
      regions: [],
    }));
  };

  const removeRegion = (region) => {
    setFilters((prev) => ({
      ...prev,
      regions: (prev.regions || []).filter((item) => item !== region),
    }));
  };

  const confirmRegionSelection = () => {
    setFilters((prev) => ({
      ...prev,
      regions: draftRegions,
    }));
    setIsRegionMenuOpen(false);
  };

  const handleSortChange = (sortBy) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: sortBy,
    }));
  };

  const handlePriceSortToggle = () => {
    setFilters((prev) => ({
      ...prev,
      sort_by: prev.sort_by === 'price_asc' ? 'price_desc' : 'price_asc',
    }));
  };

  const handleCategorySelect = (category) => {
    const isLocked = category.requiresAuth && !user;
    if (isLocked) {
      alert(copy.loginRequiredForRecommendations);
      return;
    }
    setSelectedCategory(category.id);
  };

  const scrollCategoryRail = (direction) => {
    categoryRailRef.current?.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    });
  };

  const currentHero = heroStores[heroIndex];
  const listTitle = selectedCategory === 'all'
    ? copy.allStores
    : `${getCuisineTypeName(selectedCategory)}店家`;
  const activeFilterLabels = [
    selectedCategory !== 'all' ? getCuisineTypeName(selectedCategory) : null,
    ...selectedRegions,
    filters.has_reservation ? copy.reservation : null,
    filters.has_loyalty ? copy.loyalty : null,
    filters.has_surplus_food ? copy.surplus : null,
  ].filter(Boolean);

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
          <div className={styles.categoryShowcase}>
            <div className={styles.categoryHeader}>
              <h2>熱門分類 <i className="bi bi-stars" /></h2>
            </div>

            <div className={styles.categoryRailShell}>
              <div
                className={styles.categoryRail}
                ref={categoryRailRef}
                onScroll={updateCategoryRailState}
              >
                {popularCategories.map((category) => {
                  const isActive = selectedCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`${styles.categoryPhotoCard} ${isActive ? styles.categoryPhotoCardActive : ''}`}
                      onClick={() => handleCategorySelect(category)}
                    >
                      <img
                        src={category.image}
                        alt={category.name}
                        style={category.objectPosition ? { objectPosition: category.objectPosition } : undefined}
                      />
                      <span className={styles.categoryPhotoShade} aria-hidden="true" />
                      <span className={styles.categoryPhotoLabel}>
                        {category.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {categoryRailState.canScrollLeft && (
                <button
                  type="button"
                  className={`${styles.categoryRailArrow} ${styles.categoryPrev}`}
                  onClick={() => scrollCategoryRail('left')}
                  aria-label="查看左側分類"
                >
                  <i className="bi bi-chevron-left" />
                </button>
              )}
              {categoryRailState.canScrollRight && (
                <button
                  type="button"
                  className={`${styles.categoryRailArrow} ${styles.categoryNext}`}
                  onClick={() => scrollCategoryRail('right')}
                  aria-label="查看右側分類"
                >
                  <i className="bi bi-chevron-right" />
                </button>
              )}
            </div>
          </div>

          <div className={styles.filterPanel}>
            <div className={styles.chipGroup}>
              <button
                type="button"
                className={`${styles.filterChip} ${filters.has_reservation ? styles.filterChipActive : ''}`}
                onClick={() => handleFilterChange('has_reservation')}
              >
                <span className={styles.filterChipIcon}><i className="bi bi-calendar-check" /></span>
                {copy.reservation}
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${filters.has_loyalty ? styles.filterChipActive : ''}`}
                onClick={() => handleFilterChange('has_loyalty')}
              >
                <span className={styles.filterChipIcon}><i className="bi bi-person-circle" /></span>
                {copy.loyalty}
              </button>
              <button
                type="button"
                className={`${styles.filterChip} ${filters.has_surplus_food ? styles.filterChipActive : ''}`}
                onClick={() => handleFilterChange('has_surplus_food')}
              >
                <span className={styles.filterChipIcon}><i className="bi bi-recycle" /></span>
                {copy.surplus}
              </button>
            </div>

            <div className={styles.filterControlGrid}>
              <div className={styles.filterControl}>
                <span className={styles.filterIcon} aria-hidden="true">
                  <i className="bi bi-geo-alt" />
                </span>
                <div className={styles.regionFilterRow}>
                  <label id="regionFilterLabel">{copy.region}</label>
                  <div className={styles.regionPickerAnchor}>
                    <div className={styles.regionChipRow} aria-labelledby="regionFilterLabel">
                      {selectedRegions.map((region) => (
                        <button
                          key={region}
                          type="button"
                          className={styles.selectedRegionChip}
                          onClick={() => removeRegion(region)}
                          aria-label={`移除 ${region}`}
                        >
                          {region} <i className="bi bi-x" />
                        </button>
                      ))}
                      <button
                        type="button"
                        className={styles.addRegionChip}
                        onClick={() => setIsRegionMenuOpen((prev) => !prev)}
                        aria-haspopup="dialog"
                        aria-expanded={isRegionMenuOpen}
                      >
                        <i className="bi bi-plus" /> 新增地區
                      </button>
                    </div>

                  </div>
                </div>
              </div>

              <div className={`${styles.filterControl} ${styles.sortControl}`}>
                <span className={styles.filterIcon} aria-hidden="true">
                  <i className="bi bi-sliders2" />
                </span>
                <div className={styles.regionFilterRow}>
                  <label>{copy.sortBy}</label>
                  <div className={styles.sortSegmentGroup} role="group" aria-label={copy.sortBy}>
                    <button
                      type="button"
                      className={`${styles.sortSegment} ${filters.sort_by === '' ? styles.sortSegmentActive : ''}`}
                      onClick={() => handleSortChange('')}
                    >
                      <i className="bi bi-stars" /> {copy.sortNewest}
                    </button>
                    <button
                      type="button"
                      className={`${styles.sortSegment} ${filters.sort_by === 'rating_desc' ? styles.sortSegmentActive : ''}`}
                      onClick={() => handleSortChange('rating_desc')}
                    >
                      <i className="bi bi-star-fill" /> 評分最高
                    </button>
                    <button
                      type="button"
                      className={`${styles.sortSegment} ${filters.sort_by === 'price_asc' || filters.sort_by === 'price_desc' ? styles.sortSegmentActive : ''}`}
                      onClick={handlePriceSortToggle}
                    >
                      <i className="bi bi-currency-dollar" />
                      {filters.sort_by === 'price_desc' ? '價格高到低' : '價格低到高'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedCategory === 'recommended' && user && preferenceTags.length > 0 && (
            <div className={styles.preferenceRow}>
              <label htmlFor="prefTag">{copy.preferenceTag}</label>
              <select
                id="prefTag"
                value={selectedTags[0] || ''}
                onChange={(e) => setSelectedTags(e.target.value ? [e.target.value] : [])}
              >
                <option value="">{copy.allStores}</option>
                {preferenceTags.map((tagData, index) => (
                  <option key={`${tagData.tag}-${index}`} value={tagData.tag}>
                    {tagData.tag} ({tagData.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {!loading && spotlightStores.length >= 3 && (
            <section className={styles.visualShowcase} aria-labelledby="spotlightTitle">
              <div className={styles.showcaseHeader}>
                <div className={styles.showcaseTitleGroup}>
                  <h2 id="spotlightTitle">{copy.spotlightTitle} <i className="bi bi-stars" /></h2>
                  <p>{copy.spotlightSubtitle}</p>
                </div>
                <Link to="/customer-home" className={styles.showcaseMoreLink}>
                  {copy.spotlightLead} <i className="bi bi-chevron-right" />
                </Link>
              </div>

              <Link to={`/store/${spotlightStores[0].id}`} className={`${styles.showcaseCard} ${styles.showcasePrimary}`}>
                <img src={spotlightStores[0].imageUrl} alt={spotlightStores[0].name} />
                <div className={styles.showcaseOverlay}>
                  <p className={styles.showcaseBadge}><i className="bi bi-crown-fill" /> {copy.spotlightNew}</p>
                  <div className={styles.showcaseMainContent}>
                    <h3>{spotlightStores[0].name}</h3>
                    <span className={styles.showcaseCuisine}>
                      {getCuisineTypeName(spotlightStores[0].cuisine_type)}・{spotlightStores[0].region || '精選地區'}
                    </span>
                    <div className={styles.showcaseMeta}>
                      <strong><i className="bi bi-star-fill" /> {spotlightStores[0].rating}</strong>
                      <span><i className="bi bi-geo-alt-fill" /> {spotlightStores[0].region || '地區精選'}</span>
                      <span><i className="bi bi-calendar-check-fill" /> {spotlightStores[0].enable_reservation ? '訂位熱門' : '今日推薦'}</span>
                    </div>
                  </div>
                  <span className={styles.showcaseCta}>
                    {copy.reserveNow} <i className="bi bi-chevron-right" />
                  </span>
                </div>
              </Link>

              <div className={styles.showcaseColumn}>
                {spotlightStores.slice(1, 3).map((store, index) => (
                  <Link
                    key={store.id}
                    to={`/store/${store.id}`}
                    className={`${styles.showcaseCard} ${index === 0 ? styles.showcaseSecondary : styles.showcaseTertiary}`}
                  >
                    <img src={store.imageUrl} alt={store.name} />
                    <div className={styles.showcaseOverlay}>
                      <p className={styles.showcaseBadge}>{index === 0 ? copy.spotlightPopular : copy.spotlightDessert}</p>
                      <div className={styles.showcaseMainContent}>
                        <h3>{store.name}</h3>
                        <span className={styles.showcaseCuisine}>
                          {getCuisineTypeName(store.cuisine_type)}・{store.region || '精選地區'}
                        </span>
                        <div className={styles.showcaseMeta}>
                          <strong><i className="bi bi-star-fill" /> {store.rating}</strong>
                          <span>{store.enable_reservation ? '可預約訂位' : '今日推薦'}</span>
                        </div>
                      </div>
                      <span className={styles.showcaseArrow} aria-hidden="true">
                        <i className="bi bi-chevron-right" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </section>

        {isRegionMenuOpen && (
          <div
            className={styles.regionPickerOverlay}
            role="presentation"
            onClick={() => setIsRegionMenuOpen(false)}
          >
            <section
              className={styles.regionPickerDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="regionPickerTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.regionPickerHeader}>
                <h3 id="regionPickerTitle">選擇地區</h3>
                <button type="button" onClick={clearRegions}>
                  清除全部
                </button>
              </div>
              <div className={styles.regionSearchBox}>
                <i className="bi bi-search" />
                <input
                  type="search"
                  value={regionSearch}
                  onChange={(event) => setRegionSearch(event.target.value)}
                  placeholder="搜尋縣市"
                />
              </div>
              <div className={styles.regionPickerList}>
                {filteredRegionOptions.map((region) => (
                  <label key={region} className={styles.regionPickerOption}>
                    <input
                      type="checkbox"
                      checked={draftRegions.includes(region)}
                      onChange={() => toggleRegion(region)}
                    />
                    <span>{region}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.regionConfirmButton}
                onClick={confirmRegionSelection}
              >
                確認選擇 ({draftRegions.length})
              </button>
            </section>
          </div>
        )}

        {!loading && (
          <div className={styles.listHeader}>
            <div>
              <h2>{listTitle}</h2>
              {activeFilterLabels.length > 0 && (
                <p className={styles.activeFilterHint}>
                  目前套用：{activeFilterLabels.join('、')}
                </p>
              )}
            </div>
            {hasActiveFilters && (
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
          <div className={styles.grid}>
            {stores.map((store) => {
              const businessStatus = getStoreBusinessStatus(store);
              return (
                <Link key={store.id} to={`/store/${store.id}`} className={styles.storeLink}>
                  <article className={styles.storeCard}>
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
                      <div className={styles.impactRow}>
                        <span className={styles.impactLabel}>
                          <i className="bi bi-heart-fill" /> 公益點數
                        </span>
                        <strong>{formatBenefitPoints(store.surplus_donation_amount)}</strong>
                      </div>
                      <div className={styles.featureRow}>
                        {store.enable_reservation && <span>{copy.reservation}</span>}
                        {store.enable_loyalty && <span>{copy.loyalty}</span>}
                        {store.enable_surplus_food && <span>{copy.surplus}</span>}
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
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
