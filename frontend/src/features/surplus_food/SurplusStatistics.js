import React, { useState, useEffect } from 'react';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import styles from './SurplusFoodManagement.module.css';

const SurplusStatistics = () => {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await surplusFoodApi.getStatistics();
      setStatistics(data);
    } catch (error) {
      console.error('載入統計資料失敗:', error);
      alert('載入統計資料失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.contentHeader}>
        <h2>統計資訊</h2>
      </div>

      {loading ? (
        <div className={styles.loading}>載入中...</div>
      ) : statistics ? (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{statistics.total}</div>
            <div className={styles.statLabel}>總商品數</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{statistics.active}</div>
            <div className={styles.statLabel}>上架中</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{statistics.sold_out}</div>
            <div className={styles.statLabel}>已售完</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{statistics.total_views}</div>
            <div className={styles.statLabel}>總瀏覽次數</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{statistics.total_orders}</div>
            <div className={styles.statLabel}>總訂購次數</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SurplusStatistics;
