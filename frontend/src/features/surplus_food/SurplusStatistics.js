import React, { useState, useEffect } from 'react';
import { surplusFoodApi } from '../../api/surplusFoodApi';

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
    <div className="surplus-tab-content">
      <div className="surplus-content-header">
        <h2>統計資訊</h2>
      </div>

      {loading ? (
        <div className="loading">載入中...</div>
      ) : statistics ? (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{statistics.total}</div>
            <div className="stat-label">總商品數</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.active}</div>
            <div className="stat-label">上架中</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.sold_out}</div>
            <div className="stat-label">已售完</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.total_views}</div>
            <div className="stat-label">總瀏覽次數</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{statistics.total_orders}</div>
            <div className="stat-label">總訂購次數</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SurplusStatistics;
