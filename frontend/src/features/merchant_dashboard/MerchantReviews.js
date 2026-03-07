import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import api from '../../api/api';
import styles from './MerchantReviews.module.css';

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
      <div className={styles.starRating}>
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={star <= rating ? styles.starFilled : styles.star}>
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
      <div className={styles.merchantReviewsPage}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>載入評論中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.merchantReviewsPage}>
      <div className={styles.reviewsContainer}>
        <h1 className={styles.pageTitle}>顧客評論管理</h1>

        {/* 統計卡片 */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🏪</div>
            <div className={styles.statInfo}>
              <h3>店家平均評分</h3>
              <div className={styles.statValue}>{stats.avgStoreRating} ⭐</div>
              <p className={styles.statSubtitle}>{stats.totalStoreReviews} 則評論</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>🍽️</div>
            <div className={styles.statInfo}>
              <h3>菜品平均評分</h3>
              <div className={styles.statValue}>{stats.avgProductRating} ⭐</div>
              <p className={styles.statSubtitle}>{stats.totalProductReviews} 則評論</p>
            </div>
          </div>

          <div className={styles.statCardHighlight}>
            <div className={styles.statIcon}>💬</div>
            <div className={styles.statInfo}>
              <h3>待回覆評論</h3>
              <div className={styles.statValue}>{stats.pendingReplies}</div>
              <p className={styles.statSubtitle}>需要您的回覆</p>
            </div>
          </div>
        </div>

        {/* 標籤切換 */}
        <div className={styles.tabs}>
          <button
            className={activeTab === 'store' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('store')}
          >
            店家評論 ({stats.totalStoreReviews})
          </button>
          <button
            className={activeTab === 'product' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('product')}
          >
            菜品評論 ({stats.totalProductReviews})
          </button>
        </div>

        {/* 店家評論列表 */}
        {activeTab === 'store' && (
          <div className={styles.reviewsList}>
            {storeReviews.length === 0 ? (
              <div className={styles.emptyState}>
                <p>還沒有店家評論</p>
              </div>
            ) : (
              storeReviews.map(review => (
                <div key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewerInfo}>
                      <div className={styles.avatar}>{review.user_name[0]}</div>
                      <div>
                        <h4>{review.user_name}</h4>
                        <p className={styles.reviewDate}>{formatDate(review.created_at)}</p>
                      </div>
                    </div>
                    {renderStars(review.rating)}
                  </div>

                  {review.tags && review.tags.length > 0 && (
                    <div className={styles.reviewTags}>
                      {review.tags.map((tag, index) => (
                        <span key={index} className={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  )}

                  {review.comment && (
                    <p className={styles.reviewComment}>{review.comment}</p>
                  )}

                  {review.merchant_reply ? (
                    <div className={styles.merchantReply}>
                      <div className={styles.replyHeader}>
                        <strong>商家回覆</strong>
                        <span className={styles.replyDate}>{formatDate(review.replied_at)}</span>
                      </div>
                      <p>{review.merchant_reply}</p>
                      <button
                        className={styles.btnEditReply}
                        onClick={() => handleReply(review)}
                      >
                        修改回覆
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.btnReply}
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
          <div className={styles.reviewsList}>
            {productReviews.length === 0 ? (
              <div className={styles.emptyState}>
                <p>還沒有菜品評論</p>
              </div>
            ) : (
              productReviews.map(review => (
                <div key={review.id} className={`${styles.reviewCard} ${styles.productReview}`}>
                  <div className={styles.productInfo}>
                    {review.product_image && (
                      <img
                        src={review.product_image}
                        alt={review.product_name}
                        className={styles.productImage}
                      />
                    )}
                    <h4 className={styles.productName}>{review.product_name}</h4>
                  </div>

                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewerInfo}>
                      <div className={styles.avatar}>{review.user_name[0]}</div>
                      <div>
                        <h4>{review.user_name}</h4>
                        <p className={styles.reviewDate}>{formatDate(review.created_at)}</p>
                      </div>
                    </div>
                    {renderStars(review.rating)}
                  </div>

                  {review.comment && (
                    <p className={styles.reviewComment}>{review.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 回覆模態框 */}
      {replyModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setReplyModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>回覆顧客評論</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setReplyModalOpen(false)}
              >
                ×
              </button>
            </div>

            {selectedReview && (
              <div className={styles.reviewPreview}>
                <div className={styles.reviewerInfo}>
                  <strong>{selectedReview.user_name}</strong>
                  {renderStars(selectedReview.rating)}
                </div>
                <p>{selectedReview.comment || '(無文字評論)'}</p>
              </div>
            )}

            <textarea
              className={styles.replyTextarea}
              placeholder="請輸入您的回覆..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
            />

            <div className={styles.modalFooter}>
              <button
                className={styles.btnCancel}
                onClick={() => setReplyModalOpen(false)}
              >
                取消
              </button>
              <button
                className={styles.btnSubmit}
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
