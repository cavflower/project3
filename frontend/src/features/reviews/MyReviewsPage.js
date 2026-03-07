import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import api from '../../api/api';
import styles from './MyReviewsPage.module.css';

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
            <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={star <= rating ? styles.starFilled : styles.star}>
                        ★
                    </span>
                ))}
            </div>
        );
    };

    if (!user) {
        return (
            <div className={styles.myReviewsPage}>
                <div className={styles.container}>
                    <div className={styles.loginPrompt}>
                        <h2>請先登入</h2>
                        <p>您需要登入才能查看您的評論</p>
                        <Link to="/login/customer" className={styles.btnLogin}>
                            前往登入
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={styles.myReviewsPage}>
                <div className={styles.container}>
                    <div className={styles.loading}>載入評論中...</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.myReviewsPage}>
            <div className={styles.container}>
                <h1 className={styles.pageTitle}>💬 我的評論</h1>

                {/* 統計區 */}
                <div className={styles.statsSection}>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{storeReviews.length}</div>
                        <div className={styles.statLabel}>店家評論</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{productReviews.length}</div>
                        <div className={styles.statLabel}>菜品評論</div>
                    </div>
                </div>

                {/* 分頁標籤 */}
                <div className={styles.tabs}>
                    <button
                        className={activeTab === 'store' ? styles.tabActive : styles.tab}
                        onClick={() => setActiveTab('store')}
                    >
                        店家評論 ({storeReviews.length})
                    </button>
                    <button
                        className={activeTab === 'product' ? styles.tabActive : styles.tab}
                        onClick={() => setActiveTab('product')}
                    >
                        菜品評論 ({productReviews.length})
                    </button>
                </div>

                {/* 店家評論列表 */}
                {activeTab === 'store' && (
                    <div className={styles.reviewsList}>
                        {storeReviews.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>您還沒有留下任何店家評論</p>
                                <p className={styles.hint}>完成訂單後可以對店家進行評價</p>
                            </div>
                        ) : (
                            storeReviews.map((review) => (
                                <div key={review.id} className={styles.reviewCard}>
                                    <div className={styles.reviewHeader}>
                                        <Link to={`/store/${review.store?.id || review.store_id}`} className={styles.storeName}>
                                            🏪 {review.store_name || review.store?.name || '店家'}
                                        </Link>
                                        <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                                    </div>

                                    <div className={styles.reviewRating}>
                                        {renderStars(review.rating)}
                                        <span className={styles.ratingText}>{review.rating} 分</span>
                                    </div>

                                    {review.tags && review.tags.length > 0 && (
                                        <div className={styles.reviewTags}>
                                            {review.tags.map((tag, index) => (
                                                <span key={index} className={styles.tag}>{tag}</span>
                                            ))}
                                        </div>
                                    )}

                                    {review.comment && (
                                        <div className={styles.reviewContent}>
                                            <p>{review.comment}</p>
                                        </div>
                                    )}

                                    {review.merchant_reply && (
                                        <div className={styles.merchantReply}>
                                            <div className={styles.replyHeader}>
                                                <span className={styles.replyLabel}>商家回覆</span>
                                                <span className={styles.replyDate}>{formatDate(review.replied_at)}</span>
                                            </div>
                                            <p className={styles.replyContent}>{review.merchant_reply}</p>
                                        </div>
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
                                <p>您還沒有留下任何菜品評論</p>
                                <p className={styles.hint}>完成訂單後可以對菜品進行評價</p>
                            </div>
                        ) : (
                            productReviews.map((review) => (
                                <div key={review.id} className={styles.productReview}>
                                    <div className={styles.reviewHeader}>
                                        <div className={styles.productInfo}>
                                            <span className={styles.productName}>🍽️ {review.product_name || review.product?.name || '菜品'}</span>
                                            <Link to={`/store/${review.store?.id || review.store_id}`} className={styles.storeLink}>
                                                @ {review.store_name || review.store?.name || '店家'}
                                            </Link>
                                        </div>
                                        <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                                    </div>

                                    <div className={styles.reviewRating}>
                                        {renderStars(review.rating)}
                                        <span className={styles.ratingText}>{review.rating} 分</span>
                                    </div>

                                    {review.comment && (
                                        <div className={styles.reviewContent}>
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
