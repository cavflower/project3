import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import api from '../../api/api';
import './MerchantReviews.css';

const MerchantReviews = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('store'); // 'store' or 'product'
  const [storeReviews, setStoreReviews] = useState([]);
  const [productReviews, setProductReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [stats, setStats] = useState({
    avgStoreRating: 0,
    totalStoreReviews: 0,
    avgProductRating: 0,
    totalProductReviews: 0,
    pendingReplies: 0
  });

  useEffect(() => {
    if (user?.user_type !== 'merchant') {
      navigate('/');
      return;
    }
    loadReviews();
  }, [user, navigate]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      
      // 載入店家評論
      const storeRes = await api.get('/reviews/store-reviews/');
      setStoreReviews(storeRes.data);
      
      // 載入菜品評論
      const productRes = await api.get('/reviews/product-reviews/');
      setProductReviews(productRes.data);
      
      // 計算統計數據
      calculateStats(storeRes.data, productRes.data);
    } catch (error) {
      console.error('載入評論失敗:', error);
      alert('載入評論失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (storeData, productData) => {
    const avgStoreRating = storeData.length > 0
      ? (storeData.reduce((sum, r) => sum + r.rating, 0) / storeData.length).toFixed(1)
      : 0;
    
    const avgProductRating = productData.length > 0
      ? (productData.reduce((sum, r) => sum + r.rating, 0) / productData.length).toFixed(1)
      : 0;
    
    const pendingReplies = storeData.filter(r => !r.merchant_reply).length;
    
    setStats({
      avgStoreRating,
      totalStoreReviews: storeData.length,
      avgProductRating,
      totalProductReviews: productData.length,
      pendingReplies
    });
  };

  const handleReply = (review) => {
    setSelectedReview(review);
    setReplyText(review.merchant_reply || '');
    setReplyModalOpen(true);
  };

  const submitReply = async () => {
    if (!replyText.trim()) {
      alert('請輸入回覆內容');
      return;
    }

    try {
      await api.post(`/reviews/store-reviews/${selectedReview.id}/reply/`, {
        reply: replyText
      });
      
      alert('回覆成功！');
      setReplyModalOpen(false);
      setSelectedReview(null);
      setReplyText('');
      loadReviews();
    } catch (error) {
      console.error('回覆失敗:', error);
      alert('回覆失敗，請稍後再試');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={star <= rating ? 'star filled' : 'star'}>
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="merchant-reviews-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>載入評論中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="merchant-reviews-page">
      <div className="reviews-container">
        <h1 className="page-title">顧客評論管理</h1>

        {/* 統計卡片 */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🏪</div>
            <div className="stat-info">
              <h3>店家平均評分</h3>
              <div className="stat-value">{stats.avgStoreRating} ⭐</div>
              <p className="stat-subtitle">{stats.totalStoreReviews} 則評論</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🍽️</div>
            <div className="stat-info">
              <h3>菜品平均評分</h3>
              <div className="stat-value">{stats.avgProductRating} ⭐</div>
              <p className="stat-subtitle">{stats.totalProductReviews} 則評論</p>
            </div>
          </div>

          <div className="stat-card highlight">
            <div className="stat-icon">💬</div>
            <div className="stat-info">
              <h3>待回覆評論</h3>
              <div className="stat-value">{stats.pendingReplies}</div>
              <p className="stat-subtitle">需要您的回覆</p>
            </div>
          </div>
        </div>

        {/* 標籤切換 */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            店家評論 ({stats.totalStoreReviews})
          </button>
          <button
            className={`tab ${activeTab === 'product' ? 'active' : ''}`}
            onClick={() => setActiveTab('product')}
          >
            菜品評論 ({stats.totalProductReviews})
          </button>
        </div>

        {/* 店家評論列表 */}
        {activeTab === 'store' && (
          <div className="reviews-list">
            {storeReviews.length === 0 ? (
              <div className="empty-state">
                <p>還沒有店家評論</p>
              </div>
            ) : (
              storeReviews.map(review => (
                <div key={review.id} className="review-card">
                  <div className="review-header">
                    <div className="reviewer-info">
                      <div className="avatar">{review.user_name[0]}</div>
                      <div>
                        <h4>{review.user_name}</h4>
                        <p className="review-date">{formatDate(review.created_at)}</p>
                      </div>
                    </div>
                    {renderStars(review.rating)}
                  </div>

                  {review.tags && review.tags.length > 0 && (
                    <div className="review-tags">
                      {review.tags.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  {review.comment && (
                    <p className="review-comment">{review.comment}</p>
                  )}

                  {review.merchant_reply ? (
                    <div className="merchant-reply">
                      <div className="reply-header">
                        <strong>商家回覆</strong>
                        <span className="reply-date">{formatDate(review.replied_at)}</span>
                      </div>
                      <p>{review.merchant_reply}</p>
                      <button 
                        className="btn-edit-reply"
                        onClick={() => handleReply(review)}
                      >
                        修改回覆
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn-reply"
                      onClick={() => handleReply(review)}
                    >
                      回覆評論
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 菜品評論列表 */}
        {activeTab === 'product' && (
          <div className="reviews-list">
            {productReviews.length === 0 ? (
              <div className="empty-state">
                <p>還沒有菜品評論</p>
              </div>
            ) : (
              productReviews.map(review => (
                <div key={review.id} className="review-card product-review">
                  <div className="product-info">
                    {review.product_image && (
                      <img 
                        src={review.product_image} 
                        alt={review.product_name}
                        className="product-image"
                      />
                    )}
                    <h4 className="product-name">{review.product_name}</h4>
                  </div>

                  <div className="review-header">
                    <div className="reviewer-info">
                      <div className="avatar">{review.user_name[0]}</div>
                      <div>
                        <h4>{review.user_name}</h4>
                        <p className="review-date">{formatDate(review.created_at)}</p>
                      </div>
                    </div>
                    {renderStars(review.rating)}
                  </div>

                  {review.comment && (
                    <p className="review-comment">{review.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 回覆模態框 */}
      {replyModalOpen && (
        <div className="modal-overlay" onClick={() => setReplyModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>回覆顧客評論</h3>
              <button 
                className="close-btn"
                onClick={() => setReplyModalOpen(false)}
              >
                ×
              </button>
            </div>

            {selectedReview && (
              <div className="review-preview">
                <div className="reviewer-info">
                  <strong>{selectedReview.user_name}</strong>
                  {renderStars(selectedReview.rating)}
                </div>
                <p>{selectedReview.comment || '(無文字評論)'}</p>
              </div>
            )}

            <textarea
              className="reply-textarea"
              placeholder="請輸入您的回覆..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
            />

            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => setReplyModalOpen(false)}
              >
                取消
              </button>
              <button 
                className="btn-submit"
                onClick={submitReply}
              >
                送出回覆
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantReviews;
