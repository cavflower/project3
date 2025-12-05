import React from 'react';
import { FaLeaf, FaEdit, FaTrash, FaEye, FaEyeSlash, FaCalendarAlt } from 'react-icons/fa';
import './SurplusFoodCard.css';

const SurplusFoodCard = ({ food, onEdit, onDelete, onPublish, onUnpublish }) => {
  const getStatusBadge = (status) => {
    const statusMap = {
      active: { text: '上架中', class: 'surplus-status-active' },
      inactive: { text: '已下架', class: 'surplus-status-inactive' },
      sold_out: { text: '已售完', class: 'surplus-status-sold-out' },
    };
    const { text, class: className } = statusMap[status] || { text: status, class: '' };
    return <span className={`surplus-status-badge ${className}`}>{text}</span>;
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
    <div className="surplus-food-item">
      <div className="surplus-food-image-small">
        {food.image ? (
          <img src={food.image} alt={food.title} />
        ) : (
          <div className="surplus-no-image-small">
            <FaLeaf />
          </div>
        )}
      </div>
      <div className="surplus-food-info">
        <div className="surplus-food-header">
          <h4>{food.title}</h4>
          {getStatusBadge(food.status)}
        </div>
        
        {/* 商品描述 */}
        {food.description && (
          <div className="surplus-food-description">{food.description}</div>
        )}

        {/* 用餐選項 */}
        {food.dining_option_display && (
          <div className="surplus-food-dining-option">
            <span className="surplus-dining-option-badge">{food.dining_option_display}</span>
          </div>
        )}

        {/* 即期品顯示到期日 */}
        {food.condition === 'near_expiry' && food.expiry_date && (
          <div className="surplus-food-expiry">
            <span className="surplus-expiry-icon" />
            <span>到期日：{formatDate(food.expiry_date)}</span>
          </div>
        )}

        <div className="surplus-food-price">
          <span className="surplus-original-price">NT$ {Math.floor(food.original_price)}</span>
          <span className="surplus-price">NT$ {Math.floor(food.surplus_price)}</span>
          <span className="surplus-discount">省 {food.discount_percent}%</span>
        </div>
        <div className="surplus-food-quantity">
          剩餘: {food.remaining_quantity} / {food.quantity}
        </div>
      </div>
      <div className="surplus-food-actions">
        {food.status === 'inactive' && (
          <button 
            className="surplus-btn-success surplus-btn-icon"
            onClick={() => onPublish(food.id)}
            title="上架"
          >
            <FaEye />
          </button>
        )}
        {food.status === 'active' && (
          <button 
            className="surplus-btn-warning surplus-btn-icon"
            onClick={() => onUnpublish(food.id)}
            title="下架"
          >
            <FaEyeSlash />
          </button>
        )}
        <button 
          className="surplus-btn-secondary surplus-btn-icon"
          onClick={() => onEdit(food)}
          title="編輯"
        >
          <FaEdit />
        </button>
        <button 
          className="surplus-btn-danger surplus-btn-icon"
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
