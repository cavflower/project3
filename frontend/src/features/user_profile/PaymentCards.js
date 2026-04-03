import React, { useEffect, useState } from 'react';
import api from '../../api/api';
import styles from './PaymentCards.module.css';

const WALLET_THEMES = ['stripe', 'wise', 'paypal'];

const PaymentCards = ({ stretch = false }) => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    card_holder_name: '',
    card_number: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
    is_default: false,
  });

  useEffect(() => {
    loadCards();
  }, []);

  useEffect(() => {
    if (cards.length <= 2 && cardsExpanded) {
      setCardsExpanded(false);
    }
  }, [cards.length, cardsExpanded]);

  const loadCards = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/payment-cards/');
      setCards(response.data || []);
    } catch (error) {
      console.error('載入信用卡失敗:', error);
      alert('載入信用卡失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleCardNumberChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    if (digits.length <= 19) {
      setFormData((prev) => ({ ...prev, card_number: formatted }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        card_number: formData.card_number.replace(/\s/g, ''),
      };
      if (editingCard) {
        await api.put(`/users/payment-cards/${editingCard.id}/`, payload);
        alert('信用卡更新成功');
      } else {
        await api.post('/users/payment-cards/', payload);
        alert('信用卡新增成功');
      }
      closeModal();
      loadCards();
    } catch (error) {
      console.error('儲存信用卡失敗:', error);
      const data = error.response?.data;
      if (typeof data === 'string') {
        alert(data);
      } else if (data?.detail) {
        alert(data.detail);
      } else {
        alert('儲存信用卡失敗，請檢查資料');
      }
    }
  };

  const handleDelete = async (cardId) => {
    if (!window.confirm('確定要刪除這張卡片嗎？')) return;
    try {
      await api.delete(`/users/payment-cards/${cardId}/`);
      alert('卡片已刪除');
      loadCards();
    } catch (error) {
      console.error('刪除信用卡失敗:', error);
      alert('刪除信用卡失敗，請稍後再試');
    }
  };

  const handleSetDefault = async (cardId) => {
    try {
      await api.post(`/users/payment-cards/${cardId}/set_default/`);
      alert('已設為預設卡');
      loadCards();
    } catch (error) {
      console.error('設定預設卡失敗:', error);
      alert('設定預設卡失敗，請稍後再試');
    }
  };

  const openAddModal = () => {
    setEditingCard(null);
    setFormData({
      card_holder_name: '',
      card_number: '',
      expiry_month: '',
      expiry_year: '',
      cvv: '',
      is_default: false,
    });
    setShowModal(true);
  };

  const openEditModal = (card) => {
    setEditingCard(card);
    setFormData({
      card_holder_name: card.card_holder_name || '',
      card_number: '',
      expiry_month: card.expiry_month || '',
      expiry_year: card.expiry_year || '',
      cvv: '',
      is_default: card.is_default || false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCard(null);
  };

  const orderedCards = [...cards].sort((a, b) => Number(b.is_default) - Number(a.is_default));
  const previewCards = orderedCards.slice(0, 3);
  const hasHiddenCards = orderedCards.length > 3;
  const canToggleThirdCard = orderedCards.length >= 3;
  const visibleCards = cardsExpanded ? orderedCards : orderedCards.slice(0, 3);
  const hiddenCardsCount = Math.max(orderedCards.length - 2, 0);
  const getCardTheme = (index) => WALLET_THEMES[index % WALLET_THEMES.length];

  if (loading) return <div>載入信用卡中...</div>;

  return (
    <div className={`${styles['payment-cards-section']} ${stretch ? styles.stretch : ''}`}>
      <div className={styles['section-header']}>
        <h2>信用卡管理</h2>
        <button className={styles['add-card-btn']} onClick={openAddModal}>
          + 新增卡片
        </button>
      </div>

      <div className={styles['wallet-shell']}>
        <div className={styles.wallet}>
          <div className={styles['wallet-back']}></div>
          {previewCards.length > 0 ? (
            previewCards.map((card, index) => (
              <div key={card.id} className={`${styles.card} ${styles[getCardTheme(index)]} ${card.is_default ? styles['default-preview'] : ''}`}>
                <div className={styles['card-inner']}>
                  <div className={styles['card-top']}>
                    <span>{getCardTheme(index).toUpperCase()}</span>
                    <div className={styles.chip}></div>
                  </div>
                  <div className={styles['card-bottom']}>
                    <div className={styles['card-info']}>
                      <span className={styles.label}>{card.is_default ? '預設卡' : '卡片名稱'}</span>
                      <span className={styles.value}>{card.card_holder_name || '未命名卡片'}</span>
                    </div>
                    <div className={styles['card-number-wrapper']}>
                      <span className={styles['hidden-stars']}>**** {card.card_last_four || '----'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={`${styles.card} ${styles.stripe} ${styles['empty-preview']}`}>
              <div className={styles['card-inner']}>
                <div className={styles['card-top']}>
                  <span>尚未新增卡片</span>
                  <div className={styles.chip}></div>
                </div>
                <div className={styles['card-bottom']}>
                  <span className={styles['hidden-stars']}>**** ----</span>
                </div>
              </div>
            </div>
          )}

          <div className={styles.pocket}>
            <svg className={styles['pocket-svg']} viewBox="0 0 280 160" fill="none">
              <path d="M 0 20 C 0 10, 5 10, 10 10 C 20 10, 25 25, 40 25 L 240 25 C 255 25, 260 10, 270 10 C 275 10, 280 10, 280 20 L 280 120 C 280 155, 260 160, 240 160 L 40 160 C 20 160, 0 155, 0 120 Z" fill="#1e341e"></path>
              <path d="M 8 22 C 8 16, 12 16, 15 16 C 23 16, 27 29, 40 29 L 240 29 C 253 29, 257 16, 265 16 C 268 16, 272 16, 272 22 L 272 120 C 272 150, 255 152, 240 152 L 40 152 C 25 152, 8 152, 8 120 Z" stroke="#3d5635" strokeWidth="1.5" strokeDasharray="6 4"></path>
            </svg>
            <div className={styles['pocket-content']}>
              <div className={styles['balance-wrap']}>
                <div className={styles['balance-real']}>已儲存 {cards.length} 張卡</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className={styles['no-cards-message']}>
          <p>目前尚未新增信用卡。</p>
          <p>新增後可在下方管理卡片。</p>
        </div>
      ) : (
        <>
          <div className={styles['cards-list']}>
            {visibleCards.map((card, index) => {
              const isBlurPreview = !cardsExpanded && canToggleThirdCard && index === 2;
              return (
                <div key={card.id} className={`${styles['card-item']} ${card.is_default ? styles.default : ''} ${isBlurPreview ? styles['blur-preview-card'] : ''}`}>
                  <div className={styles['list-card-info']}>
                    <div className={styles['list-card-number']}>
                      **** **** **** {card.card_last_four}
                      {card.is_default && <span className={styles['default-badge']}>預設</span>}
                    </div>
                    <div className={styles['card-details']}>
                      <span className={styles['card-holder']}>{card.card_holder_name}</span>
                      <span className={styles['list-card-expiry']}>到期：{card.expiry_month}/{card.expiry_year}</span>
                    </div>
                  </div>

                  <div className={styles['card-actions']}>
                    {!card.is_default && (
                      <button className={styles['set-default-btn']} onClick={() => handleSetDefault(card.id)}>
                        設為預設
                      </button>
                    )}
                    {card.is_default && <span className={styles['action-placeholder']} aria-hidden="true"></span>}
                    <button className={styles['edit-card-btn']} onClick={() => openEditModal(card)}>
                      編輯
                    </button>
                    <button className={styles['delete-card-btn']} onClick={() => handleDelete(card.id)}>
                      刪除
                    </button>
                  </div>

                  {isBlurPreview && (
                    <div className={styles['more-cards-overlay']}>
                      <button type="button" className={styles['show-more-btn']} onClick={() => setCardsExpanded(true)}>
                        {hasHiddenCards ? `顯示更多（還有 ${hiddenCardsCount} 張）` : '查看第 3 張卡片'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {cardsExpanded && canToggleThirdCard && (
            <button type="button" className={styles['collapse-cards-btn']} onClick={() => setCardsExpanded(false)}>
              顯示較少
            </button>
          )}
        </>
      )}

      {showModal && (
        <div className={styles['card-modal-overlay']} onClick={closeModal}>
          <div className={styles['card-modal']} onClick={(e) => e.stopPropagation()}>
            <h3>{editingCard ? '編輯信用卡' : '新增信用卡'}</h3>
            <form className={styles['card-form']} onSubmit={handleSubmit}>
              <div className={styles['form-group']}>
                <label>卡片名稱 *</label>
                <input type="text" name="card_holder_name" value={formData.card_holder_name} onChange={handleInputChange} placeholder="請輸入卡片名稱" required />
              </div>

              <div className={styles['form-group']}>
                <label>卡號 *</label>
                <input type="text" name="card_number" value={formData.card_number} onChange={handleCardNumberChange} placeholder="1234 5678 9012 3456" required={!editingCard} />
                {editingCard && <small className={styles['helper-text']}>不修改卡號可留空</small>}
              </div>

              <div className={styles['form-row']}>
                <div className={styles['form-group']}>
                  <label>到期月份 *</label>
                  <input type="text" name="expiry_month" value={formData.expiry_month} onChange={handleInputChange} placeholder="MM" maxLength="2" required />
                </div>
                <div className={styles['form-group']}>
                  <label>到期年份 *</label>
                  <input type="text" name="expiry_year" value={formData.expiry_year} onChange={handleInputChange} placeholder="YYYY" maxLength="4" required />
                </div>
              </div>

              <div className={styles['form-group']}>
                <label>CVV/CVC *</label>
                <input type="text" name="cvv" value={formData.cvv} onChange={handleInputChange} placeholder="123" maxLength="4" required={!editingCard} />
                {editingCard && <small className={styles['helper-text']}>不修改 CVV 可留空</small>}
              </div>

              <div className={styles['checkbox-group']}>
                <input type="checkbox" id="is_default" name="is_default" checked={formData.is_default} onChange={handleInputChange} />
                <label htmlFor="is_default">設為預設信用卡</label>
              </div>

              <div className={styles['modal-actions']}>
                <button type="button" className={styles['cancel-btn']} onClick={closeModal}>
                  取消
                </button>
                <button type="submit" className={styles['submit-btn']}>
                  {editingCard ? '更新' : '新增'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentCards;
