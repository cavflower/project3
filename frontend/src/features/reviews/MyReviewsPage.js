import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import api from '../../api/api';
import './MyReviewsPage.css';

const MyReviewsPage = () => {
    const { user } = useAuth();
    const [storeReviews, setStoreReviews] = useState([]);
    const [productReviews, setProductReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('store');

    useEffect(() => {
        if (user) {
            loadMyReviews();
        }
    }, [user]);

    const loadMyReviews = async () => {
        try {
            setLoading(true);
            // 載入店家評論
            const storeRes = await api.get('/reviews/store-reviews/my_reviews/');
            setStoreReviews(storeRes.data);

            // 載入菜品評論
            const productRes = await api.get('/reviews/product-reviews/my_reviews/');
            setProductReviews(productRes.data);
        } catch (error) {
            console.error('載入評論失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const renderStars = (rating) => {
        return (
            <div className="stars">
                {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={star <= rating ? 'star filled' : 'star'}>
                        ★
                    </span>
                ))}
            </div>
        );
    };

    if (!user) {
        return (
            <div className="my-reviews-page">
                <div className="container">
                    <div className="login-prompt">
                        <h2>請先登入</h2>
                        <p>您需要登入才能查看您的評論</p>
                        <Link to="/login/customer" className="btn-login">
                            前往登入
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="my-reviews-page">
                <div className="container">
                    <div className="loading">載入評論中...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="my-reviews-page">
            <div className="container">
                <h1 className="page-title">💬 我的評論</h1>

                {/* 統計區 */}
                <div className="stats-section">
                    <div className="stat-card">
                        <div className="stat-value">{storeReviews.length}</div>
                        <div className="stat-label">店家評論</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{productReviews.length}</div>
                        <div className="stat-label">菜品評論</div>
                    </div>
                </div>

                {/* 分頁標籤 */}
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'store' ? 'active' : ''}`}
                        onClick={() => setActiveTab('store')}
                    >
                        店家評論 ({storeReviews.length})
                    </button>
                    <button
                        className={`tab ${activeTab === 'product' ? 'active' : ''}`}
                        onClick={() => setActiveTab('product')}
                    >
                        菜品評論 ({productReviews.length})
                    </button>
                </div>

                {/* 店家評論列表 */}
                {activeTab === 'store' && (
                    <div className="reviews-list">
                        {storeReviews.length === 0 ? (
                            <div className="empty-state">
                                <p>您還沒有留下任何店家評論</p>
                                <p className="hint">完成訂單後可以對店家進行評價</p>
                            </div>
                        ) : (
                            storeReviews.map((review) => (
                                <div key={review.id} className="review-card">
                                    <div className="review-header">
                                        <Link to={`/store/${review.store?.id || review.store_id}`} className="store-name">
                                            🏪 {review.store_name || review.store?.name || '店家'}
                                        </Link>
                                        <span className="review-date">{formatDate(review.created_at)}</span>
                                    </div>

                                    <div className="review-rating">
                                        {renderStars(review.rating)}
                                        <span className="rating-text">{review.rating} 分</span>
                                    </div>

                                    {review.tags && review.tags.length > 0 && (
                                        <div className="review-tags">
                                            {review.tags.map((tag, index) => (
                                                <span key={index} className="tag">{tag}</span>
                                            ))}
                                        </div>
                                    )}

                                    {review.comment && (
                                        <div className="review-content">
                                            <p>{review.comment}</p>
                                        </div>
                                    )}

                                    {review.merchant_reply && (
                                        <div className="merchant-reply">
                                            <div className="reply-header">
                                                <span className="reply-label">商家回覆</span>
                                                <span className="reply-date">{formatDate(review.replied_at)}</span>
                                            </div>
                                            <p className="reply-content">{review.merchant_reply}</p>
                                        </div>
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
                                <p>您還沒有留下任何菜品評論</p>
                                <p className="hint">完成訂單後可以對菜品進行評價</p>
                            </div>
                        ) : (
                            productReviews.map((review) => (
                                <div key={review.id} className="review-card product-review">
                                    <div className="review-header">
                                        <div className="product-info">
                                            <span className="product-name">🍽️ {review.product_name || review.product?.name || '菜品'}</span>
                                            <Link to={`/store/${review.store?.id || review.store_id}`} className="store-link">
                                                @ {review.store_name || review.store?.name || '店家'}
                                            </Link>
                                        </div>
                                        <span className="review-date">{formatDate(review.created_at)}</span>
                                    </div>

                                    <div className="review-rating">
                                        {renderStars(review.rating)}
                                        <span className="rating-text">{review.rating} 分</span>
                                    </div>

                                    {review.comment && (
                                        <div className="review-content">
                                            <p>{review.comment}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyReviewsPage;
