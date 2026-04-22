import React, { useState, useEffect } from 'react';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import styles from './SurplusFoodManagement.module.css';

const SurplusStatistics = () => {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value) => {
    const amount = Number(value || 0);
    return `NT$ ${amount.toLocaleString('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

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
            <div className={styles.statValue}>{statistics.completed_orders || 0}</div>
            <div className={styles.statLabel}>完成訂單數</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{formatCurrency(statistics.donation_amount)}</div>
            <div className={styles.statLabel}>捐贈金額 (60%)</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SurplusStatistics;
