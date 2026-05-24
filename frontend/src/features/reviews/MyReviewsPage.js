import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    FaChevronRight,
    FaClipboardList,
    FaPen,
    FaRegCommentDots,
    FaSortAmountDown,
    FaStore,
    FaTrash,
    FaUtensils,
} from 'react-icons/fa';
import { useAuth } from '../../store/AuthContext';
import { getUserOrders } from '../../api/orderApi';
import api from '../../api/api';
import { buildMediaUrl } from '../../api/apiConfig';
import styles from './MyReviewsPage.module.css';

const QUICK_TAGS = ['餐點美味', '服務親切', '份量充足', '環境乾淨'];
const DISMISSED_REVIEW_ORDERS_KEY_PREFIX = 'dineverse:dismissed-review-orders:';

const getDismissStorageKey = (user) => {
    const userId = user?.id || user?.email || 'guest';
    return `${DISMISSED_REVIEW_ORDERS_KEY_PREFIX}${userId}`;
};

const getDismissedReviewOrderKeys = (user) => {
    try {
        const raw = window.localStorage.getItem(getDismissStorageKey(user));
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
        return new Set();
    }
};

const buildReviewOrderKey = (orderType, orderId) => `${orderType}-${orderId}`;

const MyReviewsPage = () => {
    const { user } = useAuth();
    const [storeReviews, setStoreReviews] = useState([]);
    const [productReviews, setProductReviews] = useState([]);
    const [reviewableOrders, setReviewableOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [sortOrder, setSortOrder] = useState('newest');
    const [savingEdit, setSavingEdit] = useState(false);

    const [editingStoreReview, setEditingStoreReview] = useState(null);
    const [storeEditForm, setStoreEditForm] = useState({
        rating: 5,
        tags: [],
        comment: '',
        removeImageIds: [],
        newImages: [],
    });
    const [storeEditPreviews, setStoreEditPreviews] = useState([]);

    const [editingProductReview, setEditingProductReview] = useState(null);
    const [productEditForm, setProductEditForm] = useState({
        rating: 5,
        comment: '',
        removeImageIds: [],
        newImages: [],
    });
    const [productEditPreviews, setProductEditPreviews] = useState([]);

    useEffect(() => {
        const previews = (storeEditForm.newImages || []).map((file) => ({
            name: file.name,
            url: URL.createObjectURL(file),
        }));
        setStoreEditPreviews(previews);

        return () => previews.forEach((item) => URL.revokeObjectURL(item.url));
    }, [storeEditForm.newImages]);

    useEffect(() => {
        const previews = (productEditForm.newImages || []).map((file) => ({
            name: file.name,
            url: URL.createObjectURL(file),
        }));
        setProductEditPreviews(previews);

        return () => previews.forEach((item) => URL.revokeObjectURL(item.url));
    }, [productEditForm.newImages]);

    const loadMyReviews = useCallback(async () => {
        try {
            setLoading(true);
            const [storeRes, productRes, ordersRes] = await Promise.all([
                api.get('/reviews/store-reviews/my_reviews/'),
                api.get('/reviews/product-reviews/my_reviews/'),
                getUserOrders(),
            ]);

            const myStoreReviews = Array.isArray(storeRes.data) ? storeRes.data : [];
            const myProductReviews = Array.isArray(productRes.data) ? productRes.data : [];
            const myOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];

            setStoreReviews(myStoreReviews);
            setProductReviews(myProductReviews);

            const reviewedOrderKeys = new Set();
            myStoreReviews.forEach((review) => {
                if (review.takeout_order) {
                    reviewedOrderKeys.add(`takeout-${review.takeout_order}`);
                }
                if (review.dinein_order) {
                    reviewedOrderKeys.add(`dinein-${review.dinein_order}`);
                }
            });

            const getOrderType = (order) => {
                const raw = (
                    order?.order_type ||
                    order?.service_channel ||
                    order?.channel ||
                    ''
                ).toString().toLowerCase();

                if (raw === 'dinein' || raw === 'dine_in') return 'dinein';
                if (raw === 'takeout' || raw === 'take_away') return 'takeout';
                if (order?.order_type_display === '內用') return 'dinein';
                if (order?.order_type_display === '外帶') return 'takeout';
                return null;
            };

            const dismissedOrderKeys = getDismissedReviewOrderKeys(user);

            const pendingReviewOrders = myOrders
                .map((order) => ({
                    ...order,
                    review_order_type: getOrderType(order),
                }))
                .filter((order) => {
                    return !dismissedOrderKeys.has(buildReviewOrderKey(order.review_order_type, order.id));
                })
                .filter((order) => {
                    if (!order.review_order_type) return false;
                    if (order.status !== 'completed') return false;
                    return !reviewedOrderKeys.has(buildReviewOrderKey(order.review_order_type, order.id));
                })
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            setReviewableOrders(pendingReviewOrders);
        } catch (error) {
            console.error('載入評論失敗:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            loadMyReviews();
        }
    }, [user, loadMyReviews]);

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

    const renderEditableStars = (rating, onChange) => {
        return (
            <div className={styles.editStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        className={`${styles.editStarButton} ${star <= rating ? styles.editStarActive : ''}`}
                        onClick={() => onChange(star)}
                    >
                        ★
                    </button>
                ))}
            </div>
        );
    };

    const getStoreId = (review) => {
        if (Number.isFinite(Number(review?.store_id))) {
            return Number(review.store_id);
        }

        if (Number.isFinite(Number(review?.store))) {
            return Number(review.store);
        }

        if (Number.isFinite(Number(review?.store?.id))) {
            return Number(review.store.id);
        }

        return null;
    };

    const getStoreName = useCallback((review) => {
        return review?.store_name || review?.store?.name || '店家';
    }, []);

    const getProductName = useCallback((review) => {
        return review?.product_name || review?.product?.name || '菜品';
    }, []);

    const toMediaUrl = useCallback((value) => {
        if (!value) return '';
        const raw = typeof value === 'string'
            ? value
            : value.image_url || value.image || value.url || '';
        return buildMediaUrl(raw) || '';
    }, []);

    const getStoreImageSource = useCallback((review) => toMediaUrl(
        review?.store_image ||
        review?.store_image_url ||
        review?.store?.first_image ||
        review?.store?.image ||
        review?.store?.images?.[0]?.image ||
        review?.store?.images?.[0]?.image_url
    ), [toMediaUrl]);

    const getProductImageSource = useCallback((review) => toMediaUrl(
        review?.product_image ||
        review?.product_image_url ||
        review?.product?.image ||
        review?.product?.image_url ||
        review?.product?.images?.[0]?.image ||
        review?.product?.images?.[0]?.image_url
    ), [toMediaUrl]);

    const reviewItems = useMemo(() => {
        const storeItems = storeReviews.map((review) => ({
            key: `store-${review.id}`,
            type: 'store',
            review,
            title: getStoreName(review),
            subtitle: '店家評論',
            imageUrl: getStoreImageSource(review),
            rating: Number(review.rating) || 0,
            tags: Array.isArray(review.tags) ? review.tags : [],
            comment: review.comment || '',
            createdAt: review.created_at,
        }));

        const productItems = productReviews.map((review) => ({
            key: `product-${review.id}`,
            type: 'product',
            review,
            title: getProductName(review),
            subtitle: getStoreName(review),
            imageUrl: getProductImageSource(review),
            rating: Number(review.rating) || 0,
            tags: [],
            comment: review.comment || '',
            createdAt: review.created_at,
        }));

        return [...storeItems, ...productItems].sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
        });
    }, [storeReviews, productReviews, sortOrder, getStoreName, getProductName, getStoreImageSource, getProductImageSource]);

    const visibleReviewItems = useMemo(() => {
        if (activeTab === 'all') return reviewItems;
        return reviewItems.filter((item) => item.type === activeTab);
    }, [activeTab, reviewItems]);

    const firstReviewableOrder = reviewableOrders[0];
    const firstReviewableOrderLink = firstReviewableOrder
        ? `/review/${firstReviewableOrder.id}?type=${firstReviewableOrder.review_order_type}`
        : null;

    const openStoreEditModal = (review) => {
        setEditingStoreReview(review);
        setStoreEditForm({
            rating: review.rating || 5,
            tags: Array.isArray(review.tags) ? review.tags : [],
            comment: review.comment || '',
            removeImageIds: [],
            newImages: [],
        });
    };

    const closeStoreEditModal = () => {
        if (savingEdit) return;
        setEditingStoreReview(null);
        setStoreEditForm({
            rating: 5,
            tags: [],
            comment: '',
            removeImageIds: [],
            newImages: [],
        });
    };

    const openProductEditModal = (review) => {
        setEditingProductReview(review);
        setProductEditForm({
            rating: review.rating || 5,
            comment: review.comment || '',
            removeImageIds: [],
            newImages: [],
        });
    };

    const closeProductEditModal = () => {
        if (savingEdit) return;
        setEditingProductReview(null);
        setProductEditForm({
            rating: 5,
            comment: '',
            removeImageIds: [],
            newImages: [],
        });
    };

    const toggleStoreTag = (tag) => {
        setStoreEditForm((prev) => ({
            ...prev,
            tags: prev.tags.includes(tag)
                ? prev.tags.filter((item) => item !== tag)
                : [...prev.tags, tag],
        }));
    };

    const toggleStoreExistingImageRemoval = (imageId) => {
        setStoreEditForm((prev) => ({
            ...prev,
            removeImageIds: prev.removeImageIds.includes(imageId)
                ? prev.removeImageIds.filter((id) => id !== imageId)
                : [...prev.removeImageIds, imageId],
        }));
    };

    const toggleProductExistingImageRemoval = (imageId) => {
        setProductEditForm((prev) => ({
            ...prev,
            removeImageIds: prev.removeImageIds.includes(imageId)
                ? prev.removeImageIds.filter((id) => id !== imageId)
                : [...prev.removeImageIds, imageId],
        }));
    };

    const handleStoreEditImageChange = (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length !== selectedFiles.length) {
            alert('只能上傳圖片檔案');
        }

        const existingCount = (editingStoreReview?.images || []).filter(
            (image) => !storeEditForm.removeImageIds.includes(image.id)
        ).length;
        const remainingSlots = Math.max(0, 5 - existingCount);
        const nextNewImages = [...storeEditForm.newImages, ...imageFiles].slice(0, remainingSlots);

        if (remainingSlots === 0 || nextNewImages.length < storeEditForm.newImages.length + imageFiles.length) {
            alert('店家評論最多可保留 5 張圖片');
        }

        setStoreEditForm((prev) => ({
            ...prev,
            newImages: nextNewImages,
        }));
    };

    const handleProductEditImageChange = (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length !== selectedFiles.length) {
            alert('只能上傳圖片檔案');
        }

        const existingCount = (editingProductReview?.images || []).filter(
            (image) => !productEditForm.removeImageIds.includes(image.id)
        ).length;
        const remainingSlots = Math.max(0, 5 - existingCount);
        const nextNewImages = [...productEditForm.newImages, ...imageFiles].slice(0, remainingSlots);

        if (remainingSlots === 0 || nextNewImages.length < productEditForm.newImages.length + imageFiles.length) {
            alert('每道菜評論最多可保留 5 張圖片');
        }

        setProductEditForm((prev) => ({
            ...prev,
            newImages: nextNewImages,
        }));
    };

    const removeStoreNewImage = (indexToRemove) => {
        setStoreEditForm((prev) => ({
            ...prev,
            newImages: prev.newImages.filter((_, index) => index !== indexToRemove),
        }));
    };

    const removeProductNewImage = (indexToRemove) => {
        setProductEditForm((prev) => ({
            ...prev,
            newImages: prev.newImages.filter((_, index) => index !== indexToRemove),
        }));
    };

    const handleSaveStoreEdit = async () => {
        if (!editingStoreReview) return;
        if (storeEditForm.rating < 1 || storeEditForm.rating > 5) {
            alert('店家評分必須是 1 到 5');
            return;
        }

        try {
            setSavingEdit(true);
            const formData = new FormData();
            formData.append('rating', String(storeEditForm.rating));
            formData.append('comment', storeEditForm.comment || '');
            formData.append('tags', JSON.stringify(storeEditForm.tags || []));
            formData.append('remove_image_ids', JSON.stringify(storeEditForm.removeImageIds || []));
            (storeEditForm.newImages || []).forEach((file) => formData.append('review_images', file));

            await api.patch(`/reviews/store-reviews/${editingStoreReview.id}/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            await loadMyReviews();
            closeStoreEditModal();
        } catch (error) {
            console.error('編輯店家評論失敗:', error);
            alert(error.response?.data?.error || '編輯失敗，請稍後再試');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleSaveProductEdit = async () => {
        if (!editingProductReview) return;
        if (productEditForm.rating < 1 || productEditForm.rating > 5) {
            alert('菜品評分必須是 1 到 5');
            return;
        }

        try {
            setSavingEdit(true);
            const formData = new FormData();
            formData.append('rating', String(productEditForm.rating));
            formData.append('comment', productEditForm.comment || '');
            formData.append('remove_image_ids', JSON.stringify(productEditForm.removeImageIds || []));
            (productEditForm.newImages || []).forEach((file) => formData.append('review_images', file));

            await api.patch(`/reviews/product-reviews/${editingProductReview.id}/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            await loadMyReviews();
            closeProductEditModal();
        } catch (error) {
            console.error('編輯菜品評論失敗:', error);
            alert(error.response?.data?.error || '編輯失敗，請稍後再試');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteStoreReview = async (reviewId) => {
        const confirmed = window.confirm('確定要刪除這則店家評論嗎？');
        if (!confirmed) return;

        try {
            await api.delete(`/reviews/store-reviews/${reviewId}/`);
            await loadMyReviews();
        } catch (error) {
            console.error('刪除店家評論失敗:', error);
            alert(error.response?.data?.error || '刪除失敗，請稍後再試');
        }
    };

    const handleDeleteProductReview = async (reviewId) => {
        const confirmed = window.confirm('確定要刪除這則菜品評論嗎？');
        if (!confirmed) return;

        try {
            await api.delete(`/reviews/product-reviews/${reviewId}/`);
            await loadMyReviews();
        } catch (error) {
            console.error('刪除菜品評論失敗:', error);
            alert(error.response?.data?.error || '刪除失敗，請稍後再試');
        }
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
                <section className={styles.heroSection}>
                    <div className={styles.heroCopy}>
                        <h1 className={styles.pageTitle}>我的評論</h1>
                        <p className={styles.pageSubtitle}>查看、管理與編輯你的店家與菜品評論</p>
                    </div>

                    {firstReviewableOrderLink ? (
                        <Link to={firstReviewableOrderLink} className={styles.pendingSection}>
                            <div className={styles.pendingIcon}><FaClipboardList /></div>
                            <div className={styles.pendingContent}>
                                <h2>待評論訂單</h2>
                                <p>完成用餐後，分享你的真實體驗</p>
                            </div>
                            <span className={styles.pendingCount}>{reviewableOrders.length} 筆可評論</span>
                            <FaChevronRight className={styles.pendingChevron} />
                        </Link>
                    ) : (
                        <div className={styles.pendingSection}>
                            <div className={styles.pendingIcon}><FaClipboardList /></div>
                            <div className={styles.pendingContent}>
                                <h2>待評論訂單</h2>
                                <p>完成用餐後，分享你的真實體驗</p>
                            </div>
                            <span className={styles.pendingCount}>{reviewableOrders.length} 筆可評論</span>
                            <FaChevronRight className={styles.pendingChevron} />
                        </div>
                    )}
                </section>

                <div className={styles.statsSection}>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.statIconWarm}`}><FaRegCommentDots /></div>
                        <div>
                            <div className={styles.statValue}>{storeReviews.length + productReviews.length}</div>
                            <div className={styles.statLabel}>總評論數</div>
                            <div className={styles.statHint}>你已發表的所有評論</div>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.statIconOrange}`}><FaStore /></div>
                        <div>
                            <div className={styles.statValue}>{storeReviews.length}</div>
                            <div className={styles.statLabel}>店家評論</div>
                            <div className={styles.statHint}>關於餐廳的評價</div>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statIcon} ${styles.statIconGreen}`}><FaUtensils /></div>
                        <div>
                            <div className={styles.statValue}>{productReviews.length}</div>
                            <div className={styles.statLabel}>菜品評論</div>
                            <div className={styles.statHint}>關於菜品的評價</div>
                        </div>
                    </div>
                </div>

                <section className={styles.reviewPanel}>
                    <div className={styles.reviewToolbar}>
                        <div className={styles.tabs}>
                            <button
                                type="button"
                                className={activeTab === 'all' ? styles.tabActive : styles.tab}
                                onClick={() => setActiveTab('all')}
                            >
                                全部評論
                            </button>
                            <button
                                type="button"
                                className={activeTab === 'store' ? styles.tabActive : styles.tab}
                                onClick={() => setActiveTab('store')}
                            >
                                店家評論
                            </button>
                            <button
                                type="button"
                                className={activeTab === 'product' ? styles.tabActive : styles.tab}
                                onClick={() => setActiveTab('product')}
                            >
                                菜品評論
                            </button>
                        </div>

                        <label className={styles.sortControl}>
                            <FaSortAmountDown />
                            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                                <option value="newest">最新</option>
                                <option value="oldest">最舊</option>
                            </select>
                        </label>
                    </div>

                    <div className={styles.reviewsList}>
                        {visibleReviewItems.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>目前沒有符合條件的評論</p>
                                <p className={styles.hint}>完成訂單後可以留下店家與菜品評價</p>
                            </div>
                        ) : (
                            visibleReviewItems.map((item) => {
                                const isStoreReview = item.type === 'store';
                                const storeId = getStoreId(item.review);
                                const reviewImages = Array.isArray(item.review.images) ? item.review.images : [];

                                return (
                                    <article key={item.key} className={styles.reviewCard}>
                                        <div className={styles.reviewMedia}>
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt={isStoreReview ? `${item.title}店家圖片` : `${item.title}菜品圖片`} />
                                            ) : (
                                                <div className={styles.reviewThumbFallback}>
                                                    {isStoreReview ? <FaStore /> : <FaUtensils />}
                                                </div>
                                            )}
                                        </div>

                                        <div className={styles.reviewMain}>
                                            <div className={styles.reviewTop}>
                                                <div className={styles.reviewTitleBlock}>
                                                    {isStoreReview && storeId ? (
                                                        <Link to={`/store/${storeId}`} className={styles.storeName}>
                                                            {item.title}
                                                        </Link>
                                                    ) : (
                                                        <span className={isStoreReview ? styles.storeName : styles.productName}>
                                                            {item.title}
                                                        </span>
                                                    )}
                                                    {!isStoreReview && (
                                                        storeId ? (
                                                            <Link to={`/store/${storeId}`} className={styles.storeLink}>
                                                                {item.subtitle}
                                                            </Link>
                                                        ) : (
                                                            <span className={styles.storeLink}>{item.subtitle}</span>
                                                        )
                                                    )}
                                                </div>

                                                <div className={styles.reviewHeaderActions}>
                                                    <span className={styles.reviewDate}>{formatDate(item.createdAt)}</span>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionButton} ${styles.editAction}`}
                                                        onClick={() => (isStoreReview ? openStoreEditModal(item.review) : openProductEditModal(item.review))}
                                                    >
                                                        <FaPen /> 編輯
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionButton} ${styles.deleteAction}`}
                                                        onClick={() => (isStoreReview ? handleDeleteStoreReview(item.review.id) : handleDeleteProductReview(item.review.id))}
                                                    >
                                                        <FaTrash /> 刪除
                                                    </button>
                                                </div>
                                            </div>

                                            <div className={styles.reviewRating}>
                                                {renderStars(item.rating)}
                                                <span className={styles.ratingText}>{item.rating} 分</span>
                                            </div>

                                            {item.tags.length > 0 && (
                                                <div className={styles.reviewTags}>
                                                    {item.tags.map((tag, index) => (
                                                        <span key={index} className={styles.tag}>{tag}</span>
                                                    ))}
                                                </div>
                                            )}

                                            {item.comment && (
                                                <div className={styles.reviewContent}>
                                                    <p>{item.comment}</p>
                                                </div>
                                            )}

                                            {reviewImages.length > 0 && (
                                                <div className={styles.reviewImageGrid}>
                                                    {reviewImages.map((image) => {
                                                        const imageUrl = toMediaUrl(image.image_url);
                                                        return (
                                                            <a
                                                                key={image.id}
                                                                href={imageUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className={styles.reviewImageItem}
                                                            >
                                                                <img src={imageUrl} alt={isStoreReview ? '店家評論圖片' : '菜品評論圖片'} />
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {isStoreReview && item.review.merchant_reply && (
                                                <div className={styles.merchantReply}>
                                                    <div className={styles.replyHeader}>
                                                        <span className={styles.replyLabel}>商家回覆</span>
                                                        <span className={styles.replyDate}>{formatDate(item.review.replied_at)}</span>
                                                    </div>
                                                    <p className={styles.replyContent}>{item.review.merchant_reply}</p>
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>
                </section>
            </div>

            {editingStoreReview && (
                <div className={styles.editModalOverlay} onClick={closeStoreEditModal}>
                    <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.editModalHeader}>
                            <h3>編輯店家評論</h3>
                            <button type="button" onClick={closeStoreEditModal} className={styles.editModalClose}>×</button>
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>店家整體評價</label>
                            {renderEditableStars(storeEditForm.rating, (rating) => setStoreEditForm((prev) => ({ ...prev, rating })))}
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>您的感受（可多選）</label>
                            <div className={styles.editTagButtons}>
                                {QUICK_TAGS.map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        className={`${styles.editTagButton} ${storeEditForm.tags.includes(tag) ? styles.editTagButtonActive : ''}`}
                                        onClick={() => toggleStoreTag(tag)}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>詳細評論（選填）</label>
                            <textarea
                                className={styles.editTextarea}
                                value={storeEditForm.comment}
                                onChange={(e) => setStoreEditForm((prev) => ({ ...prev, comment: e.target.value }))}
                                rows={5}
                                maxLength={500}
                            />
                            <div className={styles.editCharCount}>{storeEditForm.comment.length} / 500</div>
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>目前圖片（點擊可標記移除）</label>
                            {(editingStoreReview.images || []).length === 0 ? (
                                <p className={styles.editHint}>目前沒有圖片</p>
                            ) : (
                                <div className={styles.editImageGrid}>
                                    {(editingStoreReview.images || []).map((image) => {
                                        const marked = storeEditForm.removeImageIds.includes(image.id);
                                        return (
                                            <button
                                                key={image.id}
                                                type="button"
                                                className={`${styles.editImageCard} ${marked ? styles.editImageCardMarked : ''}`}
                                                onClick={() => toggleStoreExistingImageRemoval(image.id)}
                                            >
                                                <img src={image.image_url} alt="店家評論圖片" />
                                                <span>{marked ? '已標記移除' : '點擊移除'}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>新增圖片（最多保留 5 張）</label>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className={styles.editFileInput}
                                onChange={handleStoreEditImageChange}
                            />
                            {storeEditPreviews.length > 0 && (
                                <div className={styles.editImageGrid}>
                                    {storeEditPreviews.map((item, index) => (
                                        <div key={`${item.name}-${index}`} className={styles.editImageCard}>
                                            <img src={item.url} alt="新上傳評論圖片" />
                                            <button
                                                type="button"
                                                className={styles.removePreviewBtn}
                                                onClick={() => removeStoreNewImage(index)}
                                            >
                                                移除
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={styles.editModalActions}>
                            <button type="button" className={styles.editCancelBtn} onClick={closeStoreEditModal} disabled={savingEdit}>取消</button>
                            <button type="button" className={styles.editSaveBtn} onClick={handleSaveStoreEdit} disabled={savingEdit}>
                                {savingEdit ? '儲存中...' : '儲存修改'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingProductReview && (
                <div className={styles.editModalOverlay} onClick={closeProductEditModal}>
                    <div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.editModalHeader}>
                            <h3>編輯菜品評論</h3>
                            <button type="button" onClick={closeProductEditModal} className={styles.editModalClose}>×</button>
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>菜品評分</label>
                            {renderEditableStars(productEditForm.rating, (rating) => setProductEditForm((prev) => ({ ...prev, rating })))}
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>菜品評論（選填）</label>
                            <textarea
                                className={styles.editTextarea}
                                value={productEditForm.comment}
                                onChange={(e) => setProductEditForm((prev) => ({ ...prev, comment: e.target.value }))}
                                rows={4}
                                maxLength={200}
                            />
                            <div className={styles.editCharCount}>{productEditForm.comment.length} / 200</div>
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>目前圖片（點擊可標記移除）</label>
                            {(editingProductReview.images || []).length === 0 ? (
                                <p className={styles.editHint}>目前沒有圖片</p>
                            ) : (
                                <div className={styles.editImageGrid}>
                                    {(editingProductReview.images || []).map((image) => {
                                        const marked = productEditForm.removeImageIds.includes(image.id);
                                        return (
                                            <button
                                                key={image.id}
                                                type="button"
                                                className={`${styles.editImageCard} ${marked ? styles.editImageCardMarked : ''}`}
                                                onClick={() => toggleProductExistingImageRemoval(image.id)}
                                            >
                                                <img src={image.image_url} alt="菜品評論圖片" />
                                                <span>{marked ? '已標記移除' : '點擊移除'}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className={styles.editFormGroup}>
                            <label>新增圖片（最多保留 5 張）</label>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className={styles.editFileInput}
                                onChange={handleProductEditImageChange}
                            />
                            {productEditPreviews.length > 0 && (
                                <div className={styles.editImageGrid}>
                                    {productEditPreviews.map((item, index) => (
                                        <div key={`${item.name}-${index}`} className={styles.editImageCard}>
                                            <img src={item.url} alt="新上傳菜品評論圖片" />
                                            <button
                                                type="button"
                                                className={styles.removePreviewBtn}
                                                onClick={() => removeProductNewImage(index)}
                                            >
                                                移除
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={styles.editModalActions}>
                            <button type="button" className={styles.editCancelBtn} onClick={closeProductEditModal} disabled={savingEdit}>取消</button>
                            <button type="button" className={styles.editSaveBtn} onClick={handleSaveProductEdit} disabled={savingEdit}>
                                {savingEdit ? '儲存中...' : '儲存修改'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyReviewsPage;
