import React, { useEffect, useState } from 'react';
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
      const list = response.data || [];
      setCards(list);

      const defaultCard = list.find((card) => card.is_default);
      if (defaultCard) {
        setSelectedCardId(defaultCard.id);
      } else if (list.length > 0) {
        setSelectedCardId(list[0].id);
      } else {
        setSelectedCardId(null);
      }
    } catch (error) {
      console.error('載入付款卡片失敗:', error);
      alert('載入付款卡片失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedCardId) {
      alert('請先選擇一張信用卡');
      return;
    }

    const selectedCard = cards.find((card) => card.id === selectedCardId);
    onSelectCard(selectedCard);
    onClose();
  };

  const handleAddNewCard = () => {
    window.open('/profile', '_blank');
  };

  const formatExpiry = (card) => {
    const mm = String(card.expiry_month || '').padStart(2, '0');
    const yy = String(card.expiry_year || '');
    return `${mm}/${yy}`;
  };

  if (!show) return null;

  return (
    <div className={styles['card-selector-overlay']} onClick={onClose}>
      <div className={styles['card-selector-modal']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['card-selector-header']}>
          <div>
            <h3>選擇付款信用卡</h3>
            <p className={styles['header-subtitle']}>共 {cards.length} 張卡片可用</p>
          </div>
          <button className={styles['close-btn']} onClick={onClose} aria-label="關閉">
            ×
          </button>
        </div>

        <div className={styles['card-selector-body']}>
          {loading ? (
            <div className={styles['loading-text']}>載入中...</div>
          ) : cards.length === 0 ? (
            <div className={styles['no-cards']}>
              <p>目前尚未新增信用卡</p>
              <button className={styles['btn-add-card']} onClick={handleAddNewCard}>
                前往新增卡片
              </button>
            </div>
          ) : (
            <div className={styles['cards-list']}>
              {cards.map((card) => (
                <label
                  key={card.id}
                  className={`${styles['card-item']} ${selectedCardId === card.id ? styles.selected : ''}`}
                >
                  <input
                    type="radio"
                    name="card"
                    checked={selectedCardId === card.id}
                    onChange={() => setSelectedCardId(card.id)}
                  />
                  <div className={styles['card-info']}>
                    <div className={styles['card-top-row']}>
                      <div className={styles['card-number']}>**** **** **** {card.card_last_four}</div>
                      {card.is_default && <span className={styles['default-badge']}>預設卡</span>}
                    </div>
                    <div className={styles['card-details']}>
                      <span className={styles['card-holder']}>{card.card_holder_name}</span>
                      <span className={styles['card-expiry']}>到期: {formatExpiry(card)}</span>
                    </div>
                  </div>
                </label>
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
