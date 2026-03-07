import React from 'react';
import { FaLeaf, FaEdit, FaTrash, FaEye, FaEyeSlash, FaCalendarAlt } from 'react-icons/fa';
import styles from './SurplusFoodCard.module.css';

const SurplusFoodCard = ({ food, onEdit, onDelete, onPublish, onUnpublish }) => {
  const getStatusBadge = (status) => {
    const statusMap = {
      active: { text: '上架中', class: styles['surplus-status-active'] },
      inactive: { text: '已下架', class: styles['surplus-status-inactive'] },
      sold_out: { text: '已售完', class: styles['surplus-status-sold-out'] },
    };
    const { text, class: className } = statusMap[status] || { text: status, class: '' };
    return <span className={`${styles['surplus-status-badge']} ${className}`}>{text}</span>;
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

  return (
    <div className={styles['surplus-food-item']}>
      <div className={styles['surplus-food-image-small']}>
        {food.image ? (
          <img src={food.image} alt={food.title} />
        ) : (
          <div className={styles['surplus-no-image-small']}>
            <FaLeaf />
          </div>
        )}
      </div>
      <div className={styles['surplus-food-info']}>
        <div className={styles['surplus-food-header']}>
          <h4>{food.title}</h4>
          {getStatusBadge(food.status)}
          {/* 用餐選項移到上架中旁邊 */}
          {food.dining_option_display && (
            <span className={styles['surplus-dining-option-badge']}>{food.dining_option_display}</span>
          )}
        </div>

        {/* 商品描述 */}
        {food.description && (
          <div className={styles['surplus-food-description']}>{food.description}</div>
        )}

        {/* 即期品顯示到期日 */}
        {food.condition === 'near_expiry' && food.expiry_date && (
          <div className={styles['surplus-food-expiry']}>
            <span className={styles['surplus-expiry-icon']} />
            <span>到期日：{formatDate(food.expiry_date)}</span>
          </div>
        )}

        <div className={styles['surplus-food-price']}>
          <span className={styles['surplus-original-price']}>NT$ {Math.floor(food.original_price)}</span>
          <span className={styles['surplus-price']}>NT$ {Math.floor(food.surplus_price)}</span>
          <span className={styles['surplus-discount']}>省 {food.discount_percent}%</span>
        </div>
        <div className={styles['surplus-food-quantity']}>
          剩餘: {food.remaining_quantity} / {food.quantity}
        </div>
      </div>
      <div className={styles['surplus-food-actions']}>
        {food.status === 'inactive' && (
          <button
            className={`${styles['surplus-btn-success']} ${styles['surplus-btn-icon']}`}
            onClick={() => onPublish(food.id)}
            title="上架"
          >
            <FaEye />
          </button>
        )}
        {food.status === 'active' && (
          <button
            className={`${styles['surplus-btn-warning']} ${styles['surplus-btn-icon']}`}
            onClick={() => onUnpublish(food.id)}
            title="下架"
          >
            <FaEyeSlash />
          </button>
        )}
        <button
          className={`${styles['surplus-btn-secondary']} ${styles['surplus-btn-icon']}`}
          onClick={() => onEdit(food)}
          title="編輯"
        >
          <FaEdit />
        </button>
        <button
          className={`${styles['surplus-btn-danger']} ${styles['surplus-btn-icon']}`}
          onClick={() => onDelete(food.id)}
          title="刪除"
        >
          <FaTrash />
        </button>
      </div>
    </div>
  );
};

export default SurplusFoodCard;
