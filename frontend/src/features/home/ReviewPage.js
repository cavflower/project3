import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaStar, FaRegStar, FaUtensils, FaStore, FaSmile, FaThumbsUp, FaCheckCircle } from 'react-icons/fa';
import './ReviewPage.css';

function ReviewPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  // 評分狀態
  const [storeRating, setStoreRating] = useState(0);
  const [storeHoverRating, setStoreHoverRating] = useState(0);
  const [productRatings, setProductRatings] = useState({
    product1: 0,
    product2: 0,
  });
  const [productHoverRatings, setProductHoverRatings] = useState({
    product1: 0,
    product2: 0,
  });
  
  // 評論內容
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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

    setIsSubmitting(true);
    
    // 模擬提交評論
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      
      // 2秒後返回首頁
      setTimeout(() => {
        navigate('/');
      }, 2000);
    }, 1000);
  };

  const renderStars = (rating, hoverRating, onRate, onHover, onLeave) => {
    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`star-btn ${star <= (hoverRating || rating) ? 'active' : ''}`}
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

  if (isSubmitted) {
    return (
      <div className="review-page">
        <div className="review-success">
          <div className="success-icon">
            <FaCheckCircle />
          </div>
          <h2>感謝您的評價！</h2>
          <p>您的寶貴意見將幫助我們提供更好的服務</p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-page">
      <div className="review-container">
        {/* 頁面標題 */}
        <div className="review-header">
          <h1>評價您的用餐體驗</h1>
          <p>訂單編號：{orderId}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 店家評分 */}
          <div className="review-section store-rating-section">
            <div className="section-header">
              <FaStore className="section-icon" />
              <h3>店家整體評價</h3>
            </div>
            <div className="rating-container">
              {renderStars(
                storeRating,
                storeHoverRating,
                setStoreRating,
                setStoreHoverRating,
                () => setStoreHoverRating(0)
              )}
              <span className="rating-text">
                {storeRating === 0 ? '點擊星星評分' : 
                 storeRating === 5 ? '非常滿意！' :
                 storeRating === 4 ? '很好' :
                 storeRating === 3 ? '普通' :
                 storeRating === 2 ? '不太好' : '需要改進'}
              </span>
            </div>
          </div>

          {/* 快速評價標籤 */}
          <div className="review-section quick-tags-section">
            <div className="section-header">
              <h3>您的感受（可多選）</h3>
            </div>
            <div className="quick-tags">
              {quickTags.map((tag, index) => (
                <button
                  key={index}
                  type="button"
                  className={`tag-btn ${selectedTags.includes(tag.text) ? 'selected' : ''}`}
                  onClick={() => handleTagClick(tag.text)}
                >
                  {tag.icon}
                  <span>{tag.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 產品評分 */}
          <div className="review-section product-rating-section">
            <div className="section-header">
              <FaUtensils className="section-icon" />
              <h3>餐點評分</h3>
            </div>
            <div className="product-ratings">
              <div className="product-item">
                <div className="product-info">
                  <span className="product-name">一般產品 A</span>
                </div>
                {renderStars(
                  productRatings.product1,
                  productHoverRatings.product1,
                  (rating) => handleProductRating('product1', rating),
                  (rating) => setProductHoverRatings({ ...productHoverRatings, product1: rating }),
                  () => setProductHoverRatings({ ...productHoverRatings, product1: 0 })
                )}
              </div>
              <div className="product-item">
                <div className="product-info">
                  <span className="product-name">一般產品 B</span>
                </div>
                {renderStars(
                  productRatings.product2,
                  productHoverRatings.product2,
                  (rating) => handleProductRating('product2', rating),
                  (rating) => setProductHoverRatings({ ...productHoverRatings, product2: rating }),
                  () => setProductHoverRatings({ ...productHoverRatings, product2: 0 })
                )}
              </div>
            </div>
          </div>

          {/* 文字評論 */}
          <div className="review-section comment-section">
            <div className="section-header">
              <h3>詳細評論（選填）</h3>
            </div>
            <textarea
              className="comment-input"
              placeholder="分享您對店家的整體看法、餐點口味、服務品質等..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="5"
            />
            <div className="char-count">
              {comment.length} / 500
            </div>
          </div>

          {/* 提交按鈕 */}
          <div className="submit-section">
            <button 
              type="submit" 
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? '提交中...' : '送出評價'}
            </button>
            <button 
              type="button" 
              className="cancel-btn"
              onClick={() => navigate('/')}
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