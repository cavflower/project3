import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import api from '../../api/api';
import pageStyles from './StoreReviewsPage.module.css';
import reviewStyles from './StorePage.module.css';

function StoreReviewsPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [storeName, setStoreName] = useState('');
  const [storeReviews, setStoreReviews] = useState([]);
  const [productReviews, setProductReviews] = useState([]);
  const [selectedProductFilter, setSelectedProductFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [activeReviewTab, setActiveReviewTab] = useState('store');
  const [stats, setStats] = useState({
    avgStoreRating: 0,
    totalStoreReviews: 0,
    avgProductRating: 0,
    totalProductReviews: 0
  });

  useEffect(() => {
    loadPageData();
  }, [storeId]);

  const loadPageData = async () => {
    try {
      setLoading(true);

      const [storeRes, storeReviewRes, productReviewRes] = await Promise.all([
        getStore(storeId),
        api.get(`/reviews/store-reviews/?store_id=${storeId}`),
        api.get(`/reviews/product-reviews/?store_id=${storeId}`)
      ]);

      setStoreName(storeRes?.data?.name || '店家');

      const nextStoreReviews = Array.isArray(storeReviewRes.data) ? storeReviewRes.data : [];
      const nextProductReviews = Array.isArray(productReviewRes.data) ? productReviewRes.data : [];

      setStoreReviews(nextStoreReviews);
      setProductReviews(nextProductReviews);

      const avgStoreRating = nextStoreReviews.length > 0
        ? (nextStoreReviews.reduce((sum, r) => sum + r.rating, 0) / nextStoreReviews.length).toFixed(1)
        : 0;

      const avgProductRating = nextProductReviews.length > 0
        ? (nextProductReviews.reduce((sum, r) => sum + r.rating, 0) / nextProductReviews.length).toFixed(1)
        : 0;

      setStats({
        avgStoreRating,
        totalStoreReviews: nextStoreReviews.length,
        avgProductRating,
        totalProductReviews: nextProductReviews.length
      });
    } catch (error) {
      console.error('載入評論頁失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const toAbsoluteMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';
    const mediaHost = apiBase.replace(/\/api\/?$/, '');
    return `${mediaHost}${url}`;
  };

  const renderStars = (rating) => {
    return (
      <div className={reviewStyles['review-stars']}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={star <= rating ? `${reviewStyles.star} ${reviewStyles.filled}` : reviewStyles.star}>
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getProductFilterKey = useCallback((review) => {
    const rawKey = review.product_id ?? review.product ?? review.product_name;
    if (rawKey === undefined || rawKey === null) return '';
    return String(rawKey);
  }, []);

  const productFilterOptions = useMemo(() => {
    const map = new Map();

    productReviews.forEach((review) => {
      const key = getProductFilterKey(review);
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: review.product_name || '未命名菜品',
          count: 0
        });
      }

      map.get(key).count += 1;
    });

    return Array.from(map.values());
  }, [productReviews, getProductFilterKey]);

  const filteredProductReviews = useMemo(() => {
    if (selectedProductFilter === 'all') return productReviews;

    return productReviews.filter(
      (review) => getProductFilterKey(review) === selectedProductFilter
    );
  }, [productReviews, selectedProductFilter, getProductFilterKey]);

  useEffect(() => {
    if (selectedProductFilter === 'all') return;
    const stillExists = productFilterOptions.some((option) => option.key === selectedProductFilter);
    if (!stillExists) {
      setSelectedProductFilter('all');
    }
  }, [productFilterOptions, selectedProductFilter]);

  return (
    <div className={pageStyles['reviews-page-container']}>
      <div className="container">
        <section className={pageStyles['reviews-shell']}>
          <div className={pageStyles['reviews-shell-toolbar']}>
            <button
              type="button"
              className={pageStyles['btn-back']}
              onClick={() => navigate(`/store/${storeId}`)}
            >
              返回店家資訊
            </button>
            <button
              type="button"
              className={pageStyles['btn-home']}
              onClick={() => navigate('/customer-home')}
            >
              回首頁
            </button>
          </div>

          <header className={pageStyles['reviews-header-card']}>
            <h1 className={pageStyles['reviews-title']}>顧客評論</h1>
            <p className={pageStyles['reviews-subtitle']}>
              {storeName ? `${storeName} 的真實顧客回饋` : '查看店家與菜品評論'}
            </p>
          </header>

          {loading ? (
            <div className={pageStyles['loading-card']}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">載入中...</span>
              </div>
              <p>載入評論中...</p>
            </div>
          ) : (
            <div className={reviewStyles['store-reviews-container']}>
              <div className={reviewStyles['reviews-stats-row']}>
                <div className={reviewStyles['review-stat-card']}>
                  <div className={`${reviewStyles['stat-icon']} ${reviewStyles['icon-shop']}`}>
                    <i className="bi bi-shop"></i>
                  </div>
                  <div className={reviewStyles['stat-content']}>
                    <div className={reviewStyles['stat-value']}>{stats.avgStoreRating} ⭐</div>
                    <div className={reviewStyles['stat-label']}>店家平均評分</div>
                    <div className={reviewStyles['stat-count']}>{stats.totalStoreReviews} 則評論</div>
                  </div>
                </div>

                <div className={reviewStyles['review-stat-card']}>
                  <div className={`${reviewStyles['stat-icon']} ${reviewStyles['icon-dish']}`}>
                    <i className="bi bi-egg-fried"></i>
                  </div>
                  <div className={reviewStyles['stat-content']}>
                    <div className={reviewStyles['stat-value']}>{stats.avgProductRating} ⭐</div>
                    <div className={reviewStyles['stat-label']}>菜品平均評分</div>
                    <div className={reviewStyles['stat-count']}>{stats.totalProductReviews} 則評論</div>
                  </div>
                </div>
              </div>

              <div className={reviewStyles['review-tabs']}>
                <button
                  className={`${reviewStyles['review-tab']} ${activeReviewTab === 'store' ? reviewStyles.active : ''}`}
                  onClick={() => setActiveReviewTab('store')}
                >
                  店家評論 ({stats.totalStoreReviews})
                </button>
                <button
                  className={`${reviewStyles['review-tab']} ${activeReviewTab === 'product' ? reviewStyles.active : ''}`}
                  onClick={() => setActiveReviewTab('product')}
                >
                  菜品評論 ({stats.totalProductReviews})
                </button>
              </div>

              {activeReviewTab === 'product' && productFilterOptions.length > 0 && (
                <div className={reviewStyles['product-filter-row']}>
                  <button
                    className={`${reviewStyles['product-filter-chip']} ${selectedProductFilter === 'all' ? reviewStyles['product-filter-chip-active'] : ''}`}
                    onClick={() => setSelectedProductFilter('all')}
                  >
                    全部菜品 ({stats.totalProductReviews})
                  </button>
                  {productFilterOptions.map((option) => (
                    <button
                      key={option.key}
                      className={`${reviewStyles['product-filter-chip']} ${selectedProductFilter === option.key ? reviewStyles['product-filter-chip-active'] : ''}`}
                      onClick={() => setSelectedProductFilter(option.key)}
                    >
                      {option.name} ({option.count})
                    </button>
                  ))}
                </div>
              )}

              {activeReviewTab === 'store' && (
                <div className={reviewStyles['reviews-list']}>
                  {storeReviews.length === 0 ? (
                    <div className={reviewStyles['no-reviews']}>
                      <p>目前尚無店家評論</p>
                    </div>
                  ) : (
                    storeReviews.map((review) => (
                      <div key={review.id} className={reviewStyles['review-item']}>
                        <div className={reviewStyles['review-header']}>
                          <div className={reviewStyles['reviewer-info']}>
                            {review.user_avatar ? (
                              <img
                                src={toAbsoluteMediaUrl(review.user_avatar)}
                                alt={review.user_name}
                                className={reviewStyles['reviewer-avatar']}
                              />
                            ) : (
                              <div className={reviewStyles['reviewer-avatar-placeholder']}>
                                {review.user_name?.[0] || 'U'}
                              </div>
                            )}
                            <div>
                              <div className={reviewStyles['reviewer-name']}>{review.user_name}</div>
                              <div className={reviewStyles['review-date']}>{formatDate(review.created_at)}</div>
                            </div>
                          </div>
                          {renderStars(review.rating)}
                        </div>

                        {review.tags && review.tags.length > 0 && (
                          <div className={reviewStyles['review-tags']}>
                            {review.tags.map((tag, index) => (
                              <span key={index} className={reviewStyles['review-tag']}>{tag}</span>
                            ))}
                          </div>
                        )}

                        {review.comment && (
                          <p className={reviewStyles['review-comment']}>{review.comment}</p>
                        )}

                        {Array.isArray(review.images) && review.images.length > 0 && (
                          <div className={reviewStyles['review-image-grid']}>
                            {review.images.map((image) => (
                              <a
                                key={image.id}
                                href={toAbsoluteMediaUrl(image.image_url)}
                                target="_blank"
                                rel="noreferrer"
                                className={reviewStyles['review-image-item']}
                              >
                                <img src={toAbsoluteMediaUrl(image.image_url)} alt="評論圖片" />
                              </a>
                            ))}
                          </div>
                        )}

                        {review.merchant_reply && (
                          <div className={reviewStyles['merchant-reply-box']}>
                            <div className={reviewStyles['reply-header']}>
                              <strong>商家回覆</strong>
                              <span className={reviewStyles['reply-date']}>{formatDate(review.replied_at)}</span>
                            </div>
                            <p className={reviewStyles['reply-text']}>{review.merchant_reply}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeReviewTab === 'product' && (
                <div className={reviewStyles['reviews-list']}>
                  {filteredProductReviews.length === 0 ? (
                    <div className={reviewStyles['no-reviews']}>
                      <p>{productReviews.length === 0 ? '目前尚無菜品評論' : '此菜品目前尚無評論'}</p>
                    </div>
                  ) : (
                    filteredProductReviews.map((review) => (
                      <div key={review.id} className={`${reviewStyles['review-item']} ${reviewStyles['product-review-item']}`}>
                        <div className={reviewStyles['product-review-header']}>
                          {review.product_image && (
                            <img
                              src={toAbsoluteMediaUrl(review.product_image)}
                              alt={review.product_name}
                              className={reviewStyles['product-thumb']}
                            />
                          )}
                          <div className={reviewStyles['product-review-info']}>
                            <h4 className={reviewStyles['product-review-name']}>{review.product_name}</h4>
                            {renderStars(review.rating)}
                          </div>
                        </div>

                        <div className={reviewStyles['review-header']}>
                          <div className={reviewStyles['reviewer-info']}>
                            {review.user_avatar ? (
                              <img
                                src={toAbsoluteMediaUrl(review.user_avatar)}
                                alt={review.user_name}
                                className={reviewStyles['reviewer-avatar']}
                              />
                            ) : (
                              <div className={reviewStyles['reviewer-avatar-placeholder']}>
                                {review.user_name?.[0] || 'U'}
                              </div>
                            )}
                            <div>
                              <div className={reviewStyles['reviewer-name']}>{review.user_name}</div>
                              <div className={reviewStyles['review-date']}>{formatDate(review.created_at)}</div>
                            </div>
                          </div>
                        </div>

                        {review.comment && (
                          <p className={reviewStyles['review-comment']}>{review.comment}</p>
                        )}

                        {Array.isArray(review.images) && review.images.length > 0 && (
                          <div className={reviewStyles['review-image-grid']}>
                            {review.images.map((image) => (
                              <a
                                key={image.id}
                                href={toAbsoluteMediaUrl(image.image_url)}
                                target="_blank"
                                rel="noreferrer"
                                className={reviewStyles['review-image-item']}
                              >
                                <img src={toAbsoluteMediaUrl(image.image_url)} alt="菜品評論圖片" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default StoreReviewsPage;
