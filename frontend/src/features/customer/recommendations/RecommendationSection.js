import React, { useState, useEffect } from 'react';
import { FaHeart, FaStar, FaFire } from 'react-icons/fa';
import { getRecommendedProducts } from '../../../api/recommendationApi';
import FoodTags from '../../../components/common/FoodTags';
import { useNavigate } from 'react-router-dom';
import './RecommendationSection.css';

const RecommendationSection = ({ storeId = null }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecommendations();
  }, [storeId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const response = await getRecommendedProducts(storeId, 6);
      setRecommendations(response.data);
      setError('');
    } catch (err) {
      console.error('獲取推薦失敗:', err);
      if (err.response?.status === 401) {
        // 未登入用戶不顯示錯誤，只是不顯示推薦
        setRecommendations([]);
      } else {
        setError('無法載入推薦商品');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (product) => {
    // 導航到商品詳情頁或店家頁面
    navigate(`/stores/${product.store}`);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '/default-product.png';
    if (imagePath.startsWith('http')) return imagePath;
    return `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}${imagePath}`;
  };

  if (loading) {
    return (
      <div className="recommendation-section">
        <div className="section-header">
          <FaHeart className="section-icon" />
          <h2>為您推薦</h2>
        </div>
        <div className="loading-message">載入推薦中...</div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // 沒有推薦時不顯示區塊
  }

  return (
    <div className="recommendation-section">
      <div className="section-header">
        <FaHeart className="section-icon recommendation-icon" />
        <h2>為您推薦</h2>
        <span className="recommendation-subtitle">
          根據您的喜好精選
        </span>
      </div>

      <div className="recommendation-grid">
        {recommendations.map((item) => (
          <div
            key={item.product.id}
            className="recommendation-card"
            onClick={() => handleProductClick(item.product)}
          >
            <div className="recommendation-image-container">
              <img
                src={getImageUrl(item.product.image)}
                alt={item.product.name}
                className="recommendation-image"
              />
              <div className="recommendation-score">
                <FaStar className="score-icon" />
                {item.score}%
              </div>
            </div>

            <div className="recommendation-info">
              <h3 className="recommendation-name">{item.product.name}</h3>
              <p className="recommendation-price">NT$ {item.product.price}</p>
              
              {item.product.food_tags && item.product.food_tags.length > 0 && (
                <FoodTags tags={item.product.food_tags} maxDisplay={3} />
              )}

              {item.matching_tags && item.matching_tags.length > 0 && (
                <div className="matching-tags-info">
                  <FaFire className="fire-icon" />
                  <span>符合您的喜好：{item.matching_tags.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationSection;
