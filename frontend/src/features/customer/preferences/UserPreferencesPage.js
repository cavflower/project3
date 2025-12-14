import React, { useState, useEffect } from 'react';
import { FaHeart, FaChartBar, FaUtensils } from 'react-icons/fa';
import { getUserPreferences } from '../../../api/recommendationApi';
import './UserPreferencesPage.css';

const UserPreferencesPage = () => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await getUserPreferences();
      setPreferences(response.data);
      setError('');
    } catch (err) {
      console.error('獲取偏好失敗:', err);
      setError('無法載入您的偏好資料');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="preferences-page">
        <div className="loading-state">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preferences-page">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="preferences-page">
      <div className="preferences-header">
        <FaHeart className="header-icon" />
        <h1>我的美食偏好</h1>
        <p className="header-subtitle">了解您的飲食喜好，獲得更精準的推薦</p>
      </div>

      <div className="preferences-stats">
        <div className="stat-card">
          <FaUtensils className="stat-icon" />
          <div className="stat-info">
            <h3>{preferences.total_orders}</h3>
            <p>累計訂單</p>
          </div>
        </div>

        <div className="stat-card">
          <FaChartBar className="stat-icon" />
          <div className="stat-info">
            <h3>{preferences.favorite_tags.length}</h3>
            <p>喜愛的標籤</p>
          </div>
        </div>

        <div className="stat-card">
          <FaHeart className="stat-icon recommendation-available" />
          <div className="stat-info">
            <h3>{preferences.recommendation_available ? '已啟用' : '未啟用'}</h3>
            <p>個人化推薦</p>
          </div>
        </div>
      </div>

      <div className="favorite-tags-section">
        <h2>您最喜愛的食物類型</h2>
        {preferences.favorite_tags.length > 0 ? (
          <div className="favorite-tags-grid">
            {preferences.favorite_tags.map((tagData, index) => (
              <div key={index} className="favorite-tag-item">
                <div className="tag-rank">#{index + 1}</div>
                <div className="tag-content">
                  <h3>{tagData.tag}</h3>
                  <div className="tag-stats">
                    <span className="tag-count">點餐 {tagData.count} 次</span>
                    <div className="tag-bar">
                      <div
                        className="tag-bar-fill"
                        style={{
                          width: `${(tagData.count / preferences.favorite_tags[0].count) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>還沒有足夠的訂單資料來分析您的偏好</p>
            <p className="empty-hint">多點幾次餐，我們就能為您提供個人化推薦！</p>
          </div>
        )}
      </div>

      {!preferences.recommendation_available && (
        <div className="recommendation-tip">
          <FaHeart className="tip-icon" />
          <div className="tip-content">
            <h3>如何獲得個人化推薦？</h3>
            <p>繼續探索並訂購您喜歡的美食，系統會自動學習您的偏好，為您推薦更多合適的商品！</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPreferencesPage;
