import React, { useState, useEffect } from 'react';
import api from '../../api/api';
import './PaymentCards.css';

const PaymentCards = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
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

  const loadCards = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/payment-cards/');
      setCards(response.data);
    } catch (error) {
      console.error('載入卡片失敗:', error);
      alert('載入卡片失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const formatCardNumber = (value) => {
    // 移除所有非數字字符
    const digits = value.replace(/\D/g, '');
    // 每4位添加一個空格
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 19) {
      setFormData(prev => ({ ...prev, card_number: formatted }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // 移除卡號中的空格
      const submitData = {
        ...formData,
        card_number: formData.card_number.replace(/\s/g, '')
      };

      if (editingCard) {
        await api.put(`/users/payment-cards/${editingCard.id}/`, submitData);
        alert('卡片更新成功！');
      } else {
        await api.post('/users/payment-cards/', submitData);
        alert('卡片新增成功！');
      }
      
      setShowModal(false);
      setEditingCard(null);
      resetForm();
      loadCards();
    } catch (error) {
      console.error('儲存卡片失敗:', error);
      console.error('錯誤詳情:', error.response?.data);
      
      // 更詳細的錯誤處理
      let errorMsg = '儲存失敗，請檢查輸入資料';
      
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.card_number) {
          errorMsg = `卡號錯誤: ${data.card_number[0]}`;
        } else if (data.cvv) {
          errorMsg = `CVV錯誤: ${data.cvv[0]}`;
        } else if (data.expiry_month) {
          errorMsg = `月份錯誤: ${data.expiry_month[0]}`;
        } else if (data.expiry_year) {
          errorMsg = `年份錯誤: ${data.expiry_year[0]}`;
        } else if (data.card_holder_name) {
          errorMsg = `持卡人姓名錯誤: ${data.card_holder_name[0]}`;
        } else {
          errorMsg = JSON.stringify(data);
        }
      }
      
      alert(errorMsg);
    }
  };

  const handleDelete = async (cardId) => {
    if (!window.confirm('確定要刪除這張卡片嗎？')) {
      return;
    }

    try {
      await api.delete(`/users/payment-cards/${cardId}/`);
      alert('卡片已刪除');
      loadCards();
    } catch (error) {
      console.error('刪除卡片失敗:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  const handleSetDefault = async (cardId) => {
    try {
      await api.post(`/users/payment-cards/${cardId}/set_default/`);
      alert('已設為預設卡片');
      loadCards();
    } catch (error) {
      console.error('設定預設卡片失敗:', error);
      alert('設定失敗，請稍後再試');
    }
  };

  const openAddModal = () => {
    resetForm();
    setEditingCard(null);
    setShowModal(true);
  };

  const openEditModal = (card) => {
    setFormData({
      card_holder_name: card.card_holder_name,
      card_number: '', // 不顯示完整卡號
      expiry_month: card.expiry_month,
      expiry_year: card.expiry_year,
      cvv: '',
      is_default: card.is_default,
    });
    setEditingCard(card);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      card_holder_name: '',
      card_number: '',
      expiry_month: '',
      expiry_year: '',
      cvv: '',
      is_default: false,
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCard(null);
    resetForm();
  };

  if (loading) {
    return <div>載入中...</div>;
  }

  return (
    <div className="payment-cards-section">
      <div className="section-header">
        <h2>💳 我的信用卡</h2>
        <button className="add-card-btn" onClick={openAddModal}>
          + 新增卡片
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="no-cards-message">
          <p>尚未新增任何信用卡</p>
          <p>點擊上方「新增卡片」按鈕來新增您的第一張信用卡</p>
        </div>
      ) : (
        <div className="cards-list">
          {cards.map(card => (
            <div key={card.id} className={`card-item ${card.is_default ? 'default' : ''}`}>
              <div className="card-info">
                <div className="card-number">
                  **** **** **** {card.card_last_four}
                  {card.is_default && <span className="default-badge">預設</span>}
                </div>
                <div className="card-details">
                  <span className="card-holder">{card.card_holder_name}</span>
                  <span className="card-expiry">到期: {card.expiry_month}/{card.expiry_year}</span>
                </div>
              </div>
              <div className="card-actions">
                {!card.is_default && (
                  <button 
                    className="set-default-btn"
                    onClick={() => handleSetDefault(card.id)}
                  >
                    設為預設
                  </button>
                )}
                <button 
                  className="edit-card-btn"
                  onClick={() => openEditModal(card)}
                >
                  編輯
                </button>
                <button 
                  className="delete-card-btn"
                  onClick={() => handleDelete(card.id)}
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="card-modal-overlay" onClick={closeModal}>
          <div className="card-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingCard ? '編輯信用卡' : '新增信用卡'}</h3>
            <form className="card-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>持卡人姓名 *</label>
                <input
                  type="text"
                  name="card_holder_name"
                  value={formData.card_holder_name}
                  onChange={handleInputChange}
                  placeholder="請輸入持卡人姓名"
                  required
                />
              </div>

              <div className="form-group">
                <label>卡號 *</label>
                <input
                  type="text"
                  name="card_number"
                  value={formData.card_number}
                  onChange={handleCardNumberChange}
                  placeholder="1234 5678 9012 3456"
                  required={!editingCard}
                />
                {editingCard && (
                  <small style={{ color: '#999', marginTop: '4px' }}>
                    留空則保持原卡號
                  </small>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>到期月份 *</label>
                  <input
                    type="text"
                    name="expiry_month"
                    value={formData.expiry_month}
                    onChange={handleInputChange}
                    placeholder="MM"
                    maxLength="2"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>到期年份 *</label>
                  <input
                    type="text"
                    name="expiry_year"
                    value={formData.expiry_year}
                    onChange={handleInputChange}
                    placeholder="YYYY"
                    maxLength="4"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>CVV/CVC(安全碼) *</label>
                <input
                  type="text"
                  name="cvv"
                  value={formData.cvv}
                  onChange={handleInputChange}
                  placeholder="123"
                  maxLength="4"
                  required={!editingCard}
                />
                {editingCard && (
                  <small style={{ color: '#999', marginTop: '4px' }}>
                    留空則保持原 CVV/CVC
                  </small>
                )}
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="is_default"
                  name="is_default"
                  checked={formData.is_default}
                  onChange={handleInputChange}
                />
                <label htmlFor="is_default">設為預設付款方式</label>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={closeModal}>
                  取消
                </button>
                <button type="submit" className="submit-btn">
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
