import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaStar, FaRegStar, FaUtensils, FaStore, FaSmile, FaThumbsUp, FaCheckCircle } from 'react-icons/fa';
import { getUserOrders } from '../../api/orderApi';
import api from '../../api/api';
import styles from './ReviewPage.module.css';

function ReviewPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

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

    return 'takeout';
  };

  const getProductKey = (item) => item.product_id || item.product?.id || item.id;
  
  // 訂單資料
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 評分狀態
  const [storeRating, setStoreRating] = useState(0);
  const [storeHoverRating, setStoreHoverRating] = useState(0);
  const [productRatings, setProductRatings] = useState({});
  const [productHoverRatings, setProductHoverRatings] = useState({});
  const [productComments, setProductComments] = useState({});
  const [productReviewImages, setProductReviewImages] = useState({});
  const [productReviewImagePreviews, setProductReviewImagePreviews] = useState({});
  
  // 評論內容
  const [comment, setComment] = useState('');
  const [reviewImages, setReviewImages] = useState([]);
  const [reviewImagePreviews, setReviewImagePreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const nextPreviews = reviewImages.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setReviewImagePreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [reviewImages]);

  useEffect(() => {
    const nextPreviews = {};

    Object.entries(productReviewImages).forEach(([productId, files]) => {
      nextPreviews[productId] = (files || []).map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
    });

    setProductReviewImagePreviews(nextPreviews);

    return () => {
      Object.values(nextPreviews).forEach((items) => {
        items.forEach((item) => URL.revokeObjectURL(item.url));
      });
    };
  }, [productReviewImages]);

  // 載入訂單資料
  useEffect(() => {
    const fetchOrderData = async () => {
      try {
        const response = await getUserOrders();
        const targetOrderId = parseInt(orderId, 10);
        const requestedType = new URLSearchParams(location.search).get('type');

        const order = (response.data || []).find((o) => {
          if (o.id !== targetOrderId) return false;
          if (!requestedType) return true;
          return getOrderType(o) === requestedType;
        });
        
        if (order) {
          if (order.status !== 'completed') {
            alert('此訂單尚未完成，完成後才可以評論');
            navigate('/reviews');
            return;
          }

          setOrderData(order);
          // 初始化產品評分狀態
          const initialRatings = {};
          const initialHoverRatings = {};
          const initialComments = {};
          const initialProductImages = {};
          (order.items || []).forEach(item => {
            const productKey = getProductKey(item);
            if (!productKey) return;
            initialRatings[productKey] = 0;
            initialHoverRatings[productKey] = 0;
            initialComments[productKey] = '';
            initialProductImages[productKey] = [];
          });
          setProductRatings(initialRatings);
          setProductHoverRatings(initialHoverRatings);
          setProductComments(initialComments);
          setProductReviewImages(initialProductImages);
        } else {
          alert('找不到訂單資料');
          navigate('/');
        }
      } catch (error) {
        console.error('載入訂單失敗:', error);
        alert('載入訂單失敗');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId, navigate, location.search]);

  // 快速評價標籤
  const quickTags = [
    { icon: <FaThumbsUp />, text: '餐點美味' },
    { icon: <FaSmile />, text: '服務親切' },
    { icon: <FaUtensils />, text: '份量充足' },
    { icon: <FaStore />, text: '環境乾淨' },
  ];
  const [selectedTags, setSelectedTags] = useState([]);

  const handleTagClick = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleProductRating = (productId, rating) => {
    setProductRatings({ ...productRatings, [productId]: rating });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (storeRating === 0) {
      alert('請為店家評分');
      return;
    }

    if (!orderData) {
      alert('訂單資料載入中，請稍候');
      return;
    }

    const requiredProducts = [];
    const requiredProductMap = new Map();
    (orderData.items || []).forEach((item) => {
      const productKey = getProductKey(item);
      if (!productKey) return;
      if (!requiredProductMap.has(productKey)) {
        requiredProductMap.set(productKey, item.product_name || item.name || `菜品 ${productKey}`);
        requiredProducts.push(productKey);
      }
    });

    const unratedProducts = requiredProducts.filter(
      (productKey) => !productRatings[productKey] || productRatings[productKey] < 1
    );
    if (unratedProducts.length > 0) {
      const previewNames = unratedProducts.slice(0, 3).map((key) => requiredProductMap.get(key));
      const moreCount = unratedProducts.length - previewNames.length;
      const extraText = moreCount > 0 ? ` 等 ${moreCount} 道` : '';
      alert(`每道菜都至少要評分 1 顆星\n尚未評分：${previewNames.join('、')}${extraText}`);
      return;
    }

    if (orderData.status !== 'completed') {
      alert('此訂單尚未完成，完成後才可以評論');
      navigate('/reviews');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 準備菜品評論數據
      const productReviewsData = (orderData.items || []).map(item => {
        const productKey = getProductKey(item);
        return {
          product_id: productKey,
          rating: productRatings[productKey] || 5,
          comment: productComments[productKey] || ''
        };
      }).filter((item) => !!item.product_id);

      const derivedOrderType = getOrderType(orderData);

      const formData = new FormData();
      formData.append('order_id', String(parseInt(orderId, 10)));
      formData.append('order_type', derivedOrderType);
      formData.append('store_rating', String(storeRating));
      formData.append('store_tags', JSON.stringify(selectedTags));
      formData.append('store_comment', comment || '');
      formData.append('product_reviews', JSON.stringify(productReviewsData));
      reviewImages.forEach((file) => {
        formData.append('review_images', file);
      });

      Object.entries(productReviewImages).forEach(([productId, files]) => {
        (files || []).forEach((file) => {
          formData.append(`product_review_images_${productId}`, file);
        });
      });

      // 提交評論
      await api.post('/reviews/submissions/submit/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setIsSubmitted(true);
      
      // 2秒後返回顧客首頁
      setTimeout(() => {
        navigate('/customer-home');
      }, 2000);
    } catch (error) {
      console.error('提交評論失敗:', error);
      alert(error.response?.data?.error || '提交評論失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating, hoverRating, onRate, onHover, onLeave) => {
    return (
      <div className={styles['star-rating']}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`${styles['star-btn']} ${star <= (hoverRating || rating) ? styles.active : ''}`}
            onClick={() => onRate(star)}
            onMouseEnter={() => onHover(star)}
            onMouseLeave={onLeave}
          >
            {star <= (hoverRating || rating) ? <FaStar /> : <FaRegStar />}
          </button>
        ))}
      </div>
    );
  };

  const handleImageChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== selectedFiles.length) {
      alert('只能上傳圖片檔案');
    }

    if (imageFiles.length > 5) {
      alert('最多可上傳 5 張圖片');
    }

    setReviewImages(imageFiles.slice(0, 5));
  };

  const removeImage = (indexToRemove) => {
    setReviewImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleProductImageChange = (productKey, e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== selectedFiles.length) {
      alert('只能上傳圖片檔案');
    }

    if (imageFiles.length > 5) {
      alert('每道菜最多可上傳 5 張圖片');
    }

    setProductReviewImages((prev) => ({
      ...prev,
      [productKey]: imageFiles.slice(0, 5),
    }));
  };

  const removeProductImage = (productKey, indexToRemove) => {
    setProductReviewImages((prev) => ({
      ...prev,
      [productKey]: (prev[productKey] || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  if (loading) {
    return (
      <div className={styles['review-page']}>
        <div className={styles['review-container']}>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className={styles['review-page']}>
        <div className={styles['review-success']}>
          <div className={styles['success-icon']}>
            <FaCheckCircle />
          </div>
          <h2>感謝您的評價！</h2>
          <p>您的寶貴意見將幫助我們提供更好的服務</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className={styles['review-page']}>
        <div className={styles['review-container']}>
          <p>找不到訂單資料</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['review-page']}>
      <div className={styles['review-container']}>
        {/* 頁面標題 */}
        <div className={styles['review-header']}>
          <h1>評價您的用餐體驗</h1>
          <p>訂單編號：{orderId}</p>
          <p>店家：{orderData.store_name || orderData.store}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 店家評分 */}
          <div className={`${styles['review-section']} ${styles['store-rating-section']}`}>
            <div className={styles['section-header']}>
              <FaStore className={styles['section-icon']} />
              <h3>店家整體評價</h3>
            </div>
            <div className={styles['rating-container']}>
              {renderStars(
                storeRating,
                storeHoverRating,
                setStoreRating,
                setStoreHoverRating,
                () => setStoreHoverRating(0)
              )}
              <span className={styles['rating-text']}>
                {storeRating === 0 ? '點擊星星評分' : 
                 storeRating === 5 ? '非常滿意！' :
                 storeRating === 4 ? '很好' :
                 storeRating === 3 ? '普通' :
                 storeRating === 2 ? '不太好' : '需要改進'}
              </span>
            </div>
          </div>

          {/* 文字評論 */}
          <div className={`${styles['review-section']} ${styles['comment-section']}`}>
            <div className={styles['section-header']}>
              <h3>詳細評論（選填）</h3>
            </div>
            <textarea
              className={styles['comment-input']}
              placeholder="分享您對店家的整體看法、餐點口味、服務品質等..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="5"
            />
            <div className={styles['char-count']}>
              {comment.length} / 500
            </div>

            <div className={styles['review-image-upload']}>
              <label className={styles['image-upload-label']} htmlFor="review-images-input">
                上傳評論圖片（最多 5 張）
              </label>
              <input
                id="review-images-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className={styles['image-upload-input']}
              />

              {reviewImagePreviews.length > 0 && (
                <div className={styles['image-preview-grid']}>
                  {reviewImagePreviews.map((preview, index) => (
                    <div key={`${preview.file.name}-${index}`} className={styles['image-preview-item']}>
                      <img src={preview.url} alt={`評論圖片 ${index + 1}`} />
                      <button
                        type="button"
                        className={styles['remove-image-btn']}
                        onClick={() => removeImage(index)}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 快速評價標籤 */}
          <div className={`${styles['review-section']} ${styles['quick-tags-section']}`}>
            <div className={styles['section-header']}>
              <h3>您的感受（可多選）</h3>
            </div>
            <div className={styles['quick-tags']}>
              {quickTags.map((tag, index) => (
                <button
                  key={index}
                  type="button"
                  className={`${styles['tag-btn']} ${selectedTags.includes(tag.text) ? styles.selected : ''}`}
                  onClick={() => handleTagClick(tag.text)}
                >
                  {tag.icon}
                  <span>{tag.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 產品評分 */}
          {orderData && orderData.items && orderData.items.length > 0 && (
            <div className={`${styles['review-section']} ${styles['product-rating-section']}`}>
              <div className={styles['section-header']}>
                <FaUtensils className={styles['section-icon']} />
                <h3>餐點評分</h3>
              </div>
              <div className={styles['product-ratings']}>
                {orderData.items.map((item) => {
                  const productKey = getProductKey(item);
                  const productComment = productComments[productKey] || '';
                  const productPreviewImages = productReviewImagePreviews[productKey] || [];
                  return (
                    <div key={item.id} className={styles['product-item']}>
                      <div className={styles['product-top-row']}>
                        <div className={styles['product-info']}>
                          <span className={styles['product-name']}>
                            {item.product_name || item.name}
                            {item.quantity > 1 && ` x${item.quantity}`}
                          </span>
                        </div>
                        {renderStars(
                          productRatings[productKey] || 0,
                          productHoverRatings[productKey] || 0,
                          (rating) => handleProductRating(productKey, rating),
                          (rating) => setProductHoverRatings({ ...productHoverRatings, [productKey]: rating }),
                          () => setProductHoverRatings({ ...productHoverRatings, [productKey]: 0 })
                        )}
                      </div>

                      <textarea
                        className={styles['product-comment-input']}
                        placeholder="這道餐點的口味、份量、口感如何？（選填）"
                        value={productComment}
                        onChange={(e) => setProductComments({ ...productComments, [productKey]: e.target.value })}
                        rows="2"
                        maxLength={200}
                      />
                      <div className={styles['product-char-count']}>
                        {productComment.length} / 200
                      </div>

                      <div className={styles['product-image-upload']}>
                        <label className={styles['image-upload-label']} htmlFor={`product-review-images-${productKey}`}>
                          上傳這道菜的評論圖片（最多 5 張）
                        </label>
                        <input
                          id={`product-review-images-${productKey}`}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleProductImageChange(productKey, e)}
                          className={styles['image-upload-input']}
                        />

                        {productPreviewImages.length > 0 && (
                          <div className={styles['image-preview-grid']}>
                            {productPreviewImages.map((preview, index) => (
                              <div key={`${preview.file.name}-${index}`} className={styles['image-preview-item']}>
                                <img src={preview.url} alt={`菜品評論圖片 ${index + 1}`} />
                                <button
                                  type="button"
                                  className={styles['remove-image-btn']}
                                  onClick={() => removeProductImage(productKey, index)}
                                >
                                  移除
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 提交按鈕 */}
          <div className={styles['submit-section']}>
            <button 
              type="submit" 
              className={styles['submit-btn']}
              disabled={isSubmitting}
            >
              {isSubmitting ? '提交中...' : '送出評價'}
            </button>
            <button 
              type="button" 
              className={styles['cancel-btn']}
              onClick={() => navigate('/customer-home')}
            >
              稍後再說
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReviewPage;