import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useStore } from '../../store/StoreContext';
import FeatureCard from './components/FeatureCard';
import { getLowStockIngredients } from '../../api/inventoryApi';
import { getMerchantPendingOrders } from '../../api/orderApi';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import styles from './MerchantDashboard.module.css';


import {
  FaStore,
  FaClipboardList,
  FaUsers,
  FaChartLine,
  FaUtensils,
  FaBullhorn,
  FaGift,
  FaBoxes,
  FaCalendarCheck,
  FaChair,
  FaLeaf,
  FaRobot,
} from 'react-icons/fa';

const MerchantDashboard = () => {
  const { user } = useAuth();
  // 使用共享的 StoreContext，避免重複 API 呼叫
  const { store, storeSettings, storeId: contextStoreId, loading: storeLoading } = useStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [featureUsage, setFeatureUsage] = useState({});
  const [lowStockItems, setLowStockItems] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [storeId, setStoreId] = useState(null);
  const [selectedFeaturedIds, setSelectedFeaturedIds] = useState([]);
  const [editingFeatured, setEditingFeatured] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState('operations');
  const [loadedFeatureTabs, setLoadedFeatureTabs] = useState({ operations: true });
  const [pendingScrollTop, setPendingScrollTop] = useState(0);
  const [pendingViewportHeight, setPendingViewportHeight] = useState(320);
  const hasLoadedRef = useRef(false);
  const pendingScrollRef = useRef(null);
  const usageStorageKey = 'merchant_feature_usage_v1';
  const selectedFeaturedStorageKey = 'merchant_selected_featured_v1';

  const refreshPendingOrders = useCallback(async () => {
    try {
      const pendingOrdersResponse = await getMerchantPendingOrders();
      if (pendingOrdersResponse?.data?.pending_orders) {
        setPendingOrders(pendingOrdersResponse.data.pending_orders);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        return;
      }
      console.error('[Dashboard] Error refreshing pending orders:', error);
    }
  }, []);

  // 當 store 資料從 context 載入完成時，更新本地 storeId
  useEffect(() => {
    if (contextStoreId) {
      setStoreId(contextStoreId);
    }
  }, [contextStoreId]);

  // 載入本機儲存的功能使用紀錄（最近使用排序）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(usageStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setFeatureUsage(parsed);
        }
      }
    } catch (error) {
      console.error('[Dashboard] Failed to read feature usage:', error);
    }
  }, []);

  // 載入用户自定义的常用功能選擇
  useEffect(() => {
    try {
      const raw = localStorage.getItem(selectedFeaturedStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedFeaturedIds(parsed);
        } else {
          // 如果 localStorage 為空，使用默認值（4個）
          setSelectedFeaturedIds(['order-management', 'product-management', 'inventory-management', 'store-settings']);
        }
      } else {
        // 第一次使用，設置默認值
        setSelectedFeaturedIds(['order-management', 'product-management', 'inventory-management', 'store-settings']);
      }
    } catch (error) {
      console.error('[Dashboard] Failed to read selected featured:', error);
      setSelectedFeaturedIds(['order-management', 'product-management', 'inventory-management', 'store-settings']);
    }
  }, []);

  // 載入其他 Dashboard 資料（庫存、待確認訂單）
  useEffect(() => {
    // 等待 store 載入完成
    if (storeLoading) return;

    // 使用 ref 確保只載入一次
    if (hasLoadedRef.current) {
      setLoading(false);
      return;
    }
    hasLoadedRef.current = true;

    const loadDashboardData = async () => {
      try {
        const loadPendingOrders = refreshPendingOrders();

        const loadLowStock = getLowStockIngredients()
          .then((lowStockData) => {
            if (Array.isArray(lowStockData)) {
              setLowStockItems(lowStockData);
            }
          })
          .catch((error) => {
            if (error.response?.status === 404) {
              return;
            }
            console.error('[Dashboard] Error loading low stock items:', error);
          });

        await Promise.allSettled([loadPendingOrders, loadLowStock]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [refreshPendingOrders, storeLoading]);

  // Firestore 即時監聽訂單變更（包含一般訂單和惜福品訂單）
  useEffect(() => {
    if (!storeId) return;

    let isOrdersInitialLoad = true;
    let isSurplusInitialLoad = true;
    let refreshTimeout = null;

    // 刷新待確認訂單（有防抖，等待兩個集合都有變更後再刷新）
    const scheduleRefreshPendingOrders = () => {
      // 清除之前的計時器
      if (refreshTimeout) clearTimeout(refreshTimeout);

      // 設置新的計時器，等待 300ms 確保兩個集合的變更都接收到
      refreshTimeout = setTimeout(() => {
        refreshPendingOrders();
      }, 300);
    };

    // 監聽一般訂單（外帶、內用）
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, where('store_id', '==', storeId));

    const unsubscribeOrders = onSnapshot(ordersQuery, () => {
      if (isOrdersInitialLoad) {
        isOrdersInitialLoad = false;
        return;
      }
      scheduleRefreshPendingOrders();
    }, (error) => {
      console.error('[Dashboard] Orders Firestore listener error:', error);
    });

    // 監聽惜福品訂單
    const surplusOrdersRef = collection(db, 'surplus_orders');
    const surplusQuery = query(surplusOrdersRef, where('store_id', '==', String(storeId)));

    const unsubscribeSurplus = onSnapshot(surplusQuery, () => {
      if (isSurplusInitialLoad) {
        isSurplusInitialLoad = false;
        return;
      }
      scheduleRefreshPendingOrders();
    }, (error) => {
      console.error('[Dashboard] Surplus orders Firestore listener error:', error);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeSurplus();
      if (refreshTimeout) clearTimeout(refreshTimeout);
    };
  }, [refreshPendingOrders, storeId]);

  useEffect(() => {
    if (!storeId) return undefined;

    const intervalId = setInterval(() => {
      refreshPendingOrders();
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshPendingOrders, storeId]);

  const handleCardClick = (path, isDisabled, featureId) => {
    if (isDisabled) {
      return; // 如果功能被禁用，不執行導航
    }

    if (featureId) {
      setFeatureUsage((prev) => {
        const now = Date.now();
        const next = {
          ...prev,
          [featureId]: {
            count: (prev[featureId]?.count || 0) + 1,
            lastUsedAt: now,
          },
        };

        try {
          localStorage.setItem(usageStorageKey, JSON.stringify(next));
        } catch (error) {
          console.error('[Dashboard] Failed to save feature usage:', error);
        }

        return next;
      });
    }

    navigate(path);
  };

  const getUsageScore = (featureId) => {
    const usage = featureUsage[featureId];
    if (!usage) return 0;
    return (usage.count || 0) * 10 + (usage.lastUsedAt || 0) / 100000000000;
  };

  const getOrderTypeBadgeClass = (orderType) => {
    switch (orderType) {
      case 'takeout':
        return styles.badgeTakeout;
      case 'dine_in':
        return styles.badgeDinein;
      case 'surplus':
        return styles.badgeSurplus;
      default:
        return '';
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  };

  const features = [
    {
      id: 'product-management',
      name: '商品管理',
      description: '新增與維護商品',
      icon: FaStore,
      path: '/merchant/products',
    },

    {
      id: 'dine-in-settings',
      name: '內用設定',
      description: '調整菜單與座位',
      icon: FaChair,
      path: '/merchant/dine-in',
    },

    {
      id: 'store-settings',
      name: '餐廳設定',
      description: '管理餐廳資訊與營業',
      icon: FaUtensils,
      path: '/merchant/settings',
    },

    {
      id: 'schedule-management',
      name: '排班管理',
      description: '班表與人力調度',
      icon: FaCalendarCheck,
      path: '/merchant/schedule',
    },

    {
      id: 'inventory-management',
      name: '原物料管理',
      description: '進出貨與庫存追蹤',
      icon: FaBoxes,
      path: '/merchant/inventory',
    },

    {
      id: 'reports',
      name: '營運報表',
      description: '銷售與營運分析',
      icon: FaChartLine,
      path: '/merchant/reports',
    },

    {
      id: 'order-management',
      name: '訂單管理',
      description: '即時接單與出餐',
      icon: FaClipboardList,
      path: '/merchant/orders',
    },

    {
      id: 'reviews',
      name: '顧客回饋',
      description: '評論查看與回覆',
      icon: FaBullhorn,
      path: '/merchant/reviews',
    },



    {
      id: 'line-bot-settings',
      name: '餐廳助手 (LINE BOT)',
      description: '自動回覆與通知',
      icon: FaRobot,
      path: '/merchant/line-bot',
    },

    {
      id: 'reservation-management',
      name: '訂位管理',
      description: '處理訂位請求',
      icon: FaUsers,
      path: '/merchant/reservations',
      requiresFeature: 'enable_reservation',
    },

    {
      id: 'loyalty',
      name: '會員制度',
      description: '點數與會員等級',
      icon: FaGift,
      path: '/merchant/loyalty',
      requiresFeature: 'enable_loyalty',
    },

    {
      id: 'surplus-food',
      name: '惜福品',
      description: '即期食材優惠設定',
      icon: FaLeaf,
      path: '/merchant/surplus-food',
      requiresFeature: 'enable_surplus_food',
    },


  ];

  const featureTabs = [
    {
      id: 'operations',
      label: '接單中',
      items: ['order-management', 'inventory-management', 'product-management'],
    },
    {
      id: 'store',
      label: '店務設定',
      items: ['store-settings', 'dine-in-settings', 'schedule-management', 'reservation-management'],
    },
    {
      id: 'growth',
      label: '成長工具',
      items: ['reports', 'reviews', 'loyalty', 'line-bot-settings', 'surplus-food'],
    },
  ];

  // 使用用戶自定義的選擇，如果為空則使用全部功能
  const effectiveFeaturedIds = selectedFeaturedIds.length > 0 ? selectedFeaturedIds : features.map(f => f.id);

  const featuredFeatures = useMemo(() => (
    effectiveFeaturedIds
      .map((id) => features.find((feature) => feature.id === id))
      .filter(Boolean)
      .sort((a, b) => getUsageScore(b.id) - getUsageScore(a.id))
  ), [effectiveFeaturedIds, featureUsage]);

  const featuredFeaturesSafe = featuredFeatures.length > 0 ? featuredFeatures : features.slice(0, 4);

  // 保存用戶選擇的常用功能
  const handleSaveFeaturedSelection = (newSelectedIds) => {
    try {
      setSelectedFeaturedIds(newSelectedIds);
      localStorage.setItem(selectedFeaturedStorageKey, JSON.stringify(newSelectedIds));
    } catch (error) {
      console.error('[Dashboard] Failed to save featured selection:', error);
    }
  };

  // 處理常用功能的選擇/取消選擇
  const toggleFeaturedSelection = (featureId) => {
    const newSelected = selectedFeaturedIds.includes(featureId)
      ? selectedFeaturedIds.filter(id => id !== featureId)
      : [...selectedFeaturedIds, featureId];
    handleSaveFeaturedSelection(newSelected);
  };

  useEffect(() => {
    setLoadedFeatureTabs((prev) => (prev[activeFeatureTab] ? prev : { ...prev, [activeFeatureTab]: true }));
  }, [activeFeatureTab]);

  useEffect(() => {
    const syncPendingViewport = () => {
      if (pendingScrollRef.current) {
        setPendingViewportHeight(pendingScrollRef.current.clientHeight || 320);
      }
    };

    syncPendingViewport();
    window.addEventListener('resize', syncPendingViewport);
    return () => window.removeEventListener('resize', syncPendingViewport);
  }, []);

  const todayPriorityCount = (loading ? 0 : pendingOrders.length) + (loading ? 0 : lowStockItems.length);
  const selectedFeatureCount = featuredFeaturesSafe.length;
  const activeTab = featureTabs.find((tab) => tab.id === activeFeatureTab) || featureTabs[0];
  const tabbedFeatures = useMemo(() => {
    if (!loadedFeatureTabs[activeFeatureTab]) return [];
    return featuredFeaturesSafe
      .filter((feature) => activeTab.items.includes(feature.id))
      .sort((a, b) => activeTab.items.indexOf(a.id) - activeTab.items.indexOf(b.id));
  }, [activeFeatureTab, activeTab.items, featuredFeaturesSafe, loadedFeatureTabs]);
  const visibleFeatureCount = tabbedFeatures.length;

  const cardDensityMode = todayPriorityCount >= 8
    ? 'tight'
    : todayPriorityCount >= 4
      ? 'balanced'
      : 'spacious';

  const useCompactCards = cardDensityMode !== 'spacious' || selectedFeatureCount >= 6;

  const featureColumns = activeFeatureTab === 'store'
    ? 2
    : visibleFeatureCount <= 1
      ? 1
      : visibleFeatureCount <= 4
        ? 2
        : visibleFeatureCount <= 6
          ? 3
          : 4;

  const nextAction = pendingOrders.length > 0
    ? {
      title: '先處理待確認訂單',
      description: `目前有 ${pendingOrders.length} 筆待確認，先完成可避免出餐延遲。`,
      actionLabel: '前往訂單管理',
      path: '/merchant/orders',
      tone: 'urgent',
    }
    : lowStockItems.length > 0
      ? {
        title: '優先安排補貨',
        description: `目前有 ${lowStockItems.length} 項低庫存，建議先補足關鍵原料。`,
        actionLabel: '前往庫存管理',
        path: '/merchant/inventory',
        tone: 'warning',
      }
      : {
        title: '營運狀態良好',
        description: '目前沒有緊急任務，可直接進入常用功能執行日常管理。',
        actionLabel: '前往商品管理',
        path: '/merchant/products',
        tone: 'stable',
      };

  const enabledFeatureCount = ['enable_reservation', 'enable_loyalty', 'enable_surplus_food']
    .filter((key) => storeSettings?.[key]).length;

  const kpiCards = [
    {
      label: '待確認訂單',
      value: loading ? '...' : pendingOrders.length,
      tone: 'primary',
    },
    {
      label: '低庫存品項',
      value: loading ? '...' : lowStockItems.length,
      tone: 'danger',
    },
    {
      label: '已啟用加值功能',
      value: `${enabledFeatureCount}/3`,
      tone: 'primary',
    },
    {
      label: '可用管理模組',
      value: features.length,
      tone: 'neutral',
    },
  ];

  const pendingRowHeight = 56;
  const pendingOverscan = 4;

  const pendingVirtualRange = useMemo(() => {
    const start = Math.max(0, Math.floor(pendingScrollTop / pendingRowHeight) - pendingOverscan);
    const end = Math.min(
      pendingOrders.length,
      Math.ceil((pendingScrollTop + pendingViewportHeight) / pendingRowHeight) + pendingOverscan
    );

    return {
      start,
      end,
      topSpacer: start * pendingRowHeight,
      bottomSpacer: Math.max(0, (pendingOrders.length - end) * pendingRowHeight),
    };
  }, [pendingOrders.length, pendingScrollTop, pendingViewportHeight]);

  const pendingOrdersVisible = useMemo(
    () => pendingOrders.slice(pendingVirtualRange.start, pendingVirtualRange.end),
    [pendingOrders, pendingVirtualRange]
  );

  // 只在 store 載入中時顯示完整載入畫面
  if (storeLoading) {
    return (
      <div className={styles.merchantDashboard}>
        <div className={styles.loadingContainer}>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.merchantDashboard}>
      <header className={styles.dashboardHeader}>
        <h1>歡迎，{user?.username || '店家老闆'}！</h1>
        <p>這裡是您的管理後台，請選擇一項功能開始。</p>
      </header>

      <section className={styles.todayFocusPanel}>
        <div className={styles.todayFocusHeader}>
          <h2>今日重點</h2>
          <p>先處理需要立即行動的任務，再進入常用功能。</p>
        </div>
        <div className={styles.todayFocusGrid}>
          <article className={`${styles.focusCard} ${styles.focusUrgent}`}>
            <p className={styles.focusLabel}>待確認訂單</p>
            <p className={styles.focusValue}>{loading ? '...' : pendingOrders.length}</p>
            <p className={styles.focusDescription}>新單會即時更新，建議優先確認。</p>
            <button className={styles.focusActionBtn} onClick={() => navigate('/merchant/orders')}>
              立即處理訂單
            </button>
          </article>

          <article className={`${styles.focusCard} ${styles.focusWarning}`}>
            <p className={styles.focusLabel}>低庫存品項</p>
            <p className={styles.focusValue}>{loading ? '...' : lowStockItems.length}</p>
            <p className={styles.focusDescription}>避免缺料影響出餐，優先安排補貨。</p>
            <button className={styles.focusActionBtn} onClick={() => navigate('/merchant/inventory')}>
              前往補貨管理
            </button>
          </article>

          <article className={`${styles.focusCard} ${styles.focusSummary}`}>
            <p className={styles.focusLabel}>今日任務量</p>
            <p className={styles.focusValue}>{loading ? '...' : todayPriorityCount}</p>
            <p className={styles.focusDescription}>含待確認訂單與低庫存提醒。</p>
            <div className={styles.focusMetaRow}>
              <span>加值功能：{enabledFeatureCount}/3</span>
              <span>可用模組：{features.length}</span>
            </div>
          </article>
        </div>
      </section>

      <section className={`${styles.nextActionPanel} ${styles[`nextAction${nextAction.tone[0].toUpperCase()}${nextAction.tone.slice(1)}`]}`}>
        <div>
          <h3>{nextAction.title}</h3>
          <p>{nextAction.description}</p>
        </div>
        <button className={styles.nextActionBtn} onClick={() => navigate(nextAction.path)}>
          {nextAction.actionLabel}
        </button>
      </section>

      <section className={styles.kpiRow}>
        {kpiCards.map((kpi) => (
          <article key={kpi.label} className={`${styles.kpiCard} ${styles[`kpi${kpi.tone[0].toUpperCase()}${kpi.tone.slice(1)}`]} ${styles.kpiCompact}`}>
            <p className={styles.kpiLabel}>{kpi.label}</p>
            <p className={styles.kpiValue}>{kpi.value}</p>
          </article>
        ))}
      </section>

      <section className={styles.workArea}>
        <div className={styles.dashboardStatsContainer}>
          <div className={styles.statsCard}>
            <h3>🔔 待確認訂單 {!loading && `(${pendingOrders.length})`}</h3>
            {loading ? (
              <div className={styles.allGood}>
                <p>載入中...</p>
              </div>
            ) : pendingOrders.length > 0 ? (
              <div className={styles.pendingOrdersList}>
                <div
                  className={styles.pendingOrdersScroll}
                  ref={pendingScrollRef}
                  onScroll={(event) => setPendingScrollTop(event.currentTarget.scrollTop)}
                >
                  <div style={{ height: pendingVirtualRange.topSpacer }} />
                  {pendingOrdersVisible.map((order, index) => (
                    <div key={`${order.order_type}-${order.id}-${pendingVirtualRange.start + index}`} className={styles.pendingOrderItem}>
                      <div className={styles.orderInfo}>
                        <span className={`${styles.orderTypeBadge} ${getOrderTypeBadgeClass(order.order_type)}`}>
                          {order.order_type_display}
                        </span>
                        <span className={styles.orderNumber}>#{order.order_number}</span>
                        {order.table_label && <span className={styles.tableLabel}>桌號: {order.table_label}</span>}
                      </div>
                      <span className={styles.orderTime}>{formatTime(order.created_at)}</span>
                    </div>
                  ))}
                  <div style={{ height: pendingVirtualRange.bottomSpacer }} />
                </div>
                {pendingOrders.length > pendingOrdersVisible.length && (
                  <div className={styles.moreItems}>共 {pendingOrders.length} 筆待確認，清單已啟用效能模式</div>
                )}
                <button className={styles.viewOrdersBtn} onClick={() => navigate('/merchant/orders')}>
                  前往訂單管理
                </button>
              </div>
            ) : (
              <div className={styles.allGood}>
                <p>目前沒有待確認訂單！</p>
              </div>
            )}
          </div>

          <div className={styles.statsCard}>
            <h3>⚠️ 庫存不足提醒 {!loading && `(${lowStockItems.length})`}</h3>
            {loading ? (
              <div className={styles.allGood}>
                <p>載入中...</p>
              </div>
            ) : lowStockItems.length > 0 ? (
              <div className={styles.lowStockList}>
                {lowStockItems.slice(0, 5).map(item => (
                  <div key={item.id} className={styles.lowStockItem}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemQty}>剩餘: {item.quantity} {item.unit_display}</span>
                  </div>
                ))}
                {lowStockItems.length > 5 && <div className={styles.moreItems}>還有 {lowStockItems.length - 5} 項...</div>}
                <button className={styles.restockBtn} onClick={() => navigate('/merchant/inventory')}>
                  前往補貨
                </button>
              </div>
            ) : (
              <div className={styles.allGood}>
                <p>目前庫存狀況良好！</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.featuresPanel}>
        <div className={styles.featuresPanelHeader}>
          <div>
            <h2>常用功能</h2>
            <p className={styles.featuresPanelHint}>快速行動區 · 已選擇 {selectedFeatureCount} 個 · 版面密度：{cardDensityMode === 'tight' ? '緊湊' : cardDensityMode === 'balanced' ? '平衡' : '寬鬆'}</p>
          </div>
          <button
            className={styles.editFeaturedBtn}
            onClick={() => setEditingFeatured(!editingFeatured)}
            title="編輯常用功能選擇"
          >
            ⚙️ {editingFeatured ? '完成' : '編輯'}
          </button>
        </div>

        {editingFeatured ? (
          <div className={styles.featureSelectorWrap}>
            <p className={styles.selectorHint}>選擇您經常使用的功能，最多選擇 12 個</p>
            <div className={styles.featureSelectorGrid}>
              {features.map((feature) => (
                <label key={feature.id} className={styles.featureSelectorItem}>
                  <input
                    type="checkbox"
                    checked={selectedFeaturedIds.includes(feature.id)}
                    onChange={() => {
                      if (selectedFeaturedIds.includes(feature.id)) {
                        // 允許取消選擇
                        toggleFeaturedSelection(feature.id);
                      } else if (selectedFeaturedIds.length < 12) {
                        // 只允許最多選擇 12 個
                        toggleFeaturedSelection(feature.id);
                      }
                    }}
                    disabled={selectedFeaturedIds.length >= 12 && !selectedFeaturedIds.includes(feature.id)}
                  />
                  <span className={styles.featureSelectorLabel}>
                    <span className={styles.featureName}>{feature.name}</span>
                    <span className={styles.featureDesc}>{feature.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.featuresGridWrapper}>
            <div className={styles.featureTabs}>
              {featureTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`${styles.featureTabBtn} ${activeFeatureTab === tab.id ? styles.featureTabBtnActive : ''}`}
                  onClick={() => setActiveFeatureTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {tabbedFeatures.length === 0 && (
              <div className={styles.featureTabEmpty}>
                這個分類目前沒有已加入的常用功能，請按「編輯」加入。
              </div>
            )}

            <main
              className={`${styles.featuresGrid} ${styles[`density${cardDensityMode[0].toUpperCase()}${cardDensityMode.slice(1)}`]} ${activeFeatureTab === 'store' ? styles.storeTabGrid : ''}`}
              style={{ gridTemplateColumns: `repeat(${featureColumns}, minmax(0, 1fr))` }}
            >
              {tabbedFeatures.map((feature) => {
                // 檢查此功能是否需要特定的功能開關
                const isDisabled = feature.requiresFeature && !storeSettings[feature.requiresFeature];

                return (
                  <FeatureCard
                    key={feature.id}
                    icon={feature.icon}
                    name={feature.name}
                    description={feature.description}
                    path={feature.path}
                    onClick={(path, disabled) => handleCardClick(path, disabled, feature.id)}
                    compact={useCompactCards}
                    isDisabled={isDisabled}
                    disabledMessage={isDisabled ? '此功能已在餐廳設定中關閉' : ''}
                  />
                );
              })}
            </main>
          </div>
        )}
      </section>
    </div>
  );
};

export default MerchantDashboard;
