import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import styles from './CreditCardSelector.module.css';

const CreditCardSelector = ({ show, onClose, onSelectCard }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState(null);

  useEffect(() => {
    if (show) {
      loadCards();
    }
  }, [show]);

  const loadCards = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/payment-cards/');
      setCards(response.data);
      
      // 自動選擇預設卡片
      const defaultCard = response.data.find(card => card.is_default);
      if (defaultCard) {
        setSelectedCardId(defaultCard.id);
      } else if (response.data.length > 0) {
        setSelectedCardId(response.data[0].id);
      }
    } catch (error) {
      console.error('載入卡片失敗:', error);
      alert('載入信用卡資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedCardId) {
      alert('請選擇一張信用卡');
      return;
    }
    
    const selectedCard = cards.find(card => card.id === selectedCardId);
    onSelectCard(selectedCard);
    onClose();
  };

  const handleAddNewCard = () => {
    // 導向個人資料頁面新增卡片
    window.open('/profile', '_blank');
  };

  if (!show) return null;

  return (
    <div className={styles['card-selector-overlay']} onClick={onClose}>
      <div className={styles['card-selector-modal']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['card-selector-header']}>
          <h3>選擇付款信用卡</h3>
          <button className={styles['close-btn']} onClick={onClose}>&times;</button>
        </div>

        <div className={styles['card-selector-body']}>
          {loading ? (
            <div className={styles['loading-text']}>載入中...</div>
          ) : cards.length === 0 ? (
            <div className={styles['no-cards']}>
              <p>您尚未新增信用卡</p>
              <button className={styles['btn-add-card']} onClick={handleAddNewCard}>
                前往新增信用卡
              </button>
            </div>
          ) : (
            <div className={styles['cards-list']}>
              {cards.map(card => (
                <div
                  key={card.id}
                  className={`${styles['card-item']} ${selectedCardId === card.id ? styles.selected : ''}`}
                  onClick={() => setSelectedCardId(card.id)}
                >
                  <input
                    type="radio"
                    name="card"
                    checked={selectedCardId === card.id}
                    onChange={() => setSelectedCardId(card.id)}
                  />
                  <div className={styles['card-info']}>
                    <div className={styles['card-number']}>
                      **** **** **** {card.card_last_four}
                    </div>
                    <div className={styles['card-details']}>
                      <span className={styles['card-holder']}>{card.card_holder_name}</span>
                      <span className={styles['card-expiry']}>
                        到期: {card.expiry_month}/{card.expiry_year}
                      </span>
                    </div>
                    {card.is_default && (
                      <span className={styles['default-badge']}>預設</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles['card-selector-footer']}>
          <button className={styles['btn-secondary']} onClick={onClose}>
            取消
          </button>
          {cards.length > 0 && (
            <button className={styles['btn-primary']} onClick={handleConfirm}>
              確認使用此卡
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditCardSelector;
