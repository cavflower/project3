import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaPhone } from 'react-icons/fa';
import { verifyGuestReservation } from '../../api/reservationApi';
import './GuestReservationLookup.css';

/**
 * 訪客查詢訂位頁面
 * 僅需輸入：訂位時填寫的手機號碼
 */
const GuestReservationLookup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    phoneNumber: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 驗證輸入
    if (!formData.phoneNumber.trim()) {
      setError('請輸入手機號碼');
      return;
    }

    // 驗證手機號碼格式 (09開頭，共10碼)
    const phoneRegex = /^09\d{8}$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      setError('請輸入正確的手機號碼格式 (09xxxxxxxx)');
      return;
    }

    try {
      setLoading(true);

      // 調用後端 API 驗證
      const response = await verifyGuestReservation(formData.phoneNumber);

      if (response.data && response.data.reservations && response.data.reservations.length > 0) {
        // 驗證成功，儲存 session token 到 sessionStorage
        const guestToken = {
          phoneNumber: formData.phoneNumber,
          token: response.data.token.token,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24小時
        };
        sessionStorage.setItem('guestReservationToken', JSON.stringify(guestToken));

        // 導航到我的訂位頁面
        navigate('/my-reservations?verified=true');
      } else {
        // 找不到訂位記錄
        setError('找不到訂位記錄，請確認手機號碼是否正確');
      }
    } catch (error) {
      console.error('Failed to verify reservation:', error);
      const errorMsg = error.response?.data?.error || '查詢失敗，請稍後再試';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      phoneNumber: '',
    });
    setError('');
  };

  return (
    <div className="guest-lookup-page">
      <div className="lookup-container">
        <div className="lookup-header">
          <FaSearch className="header-icon" />
          <h1>查詢訂位</h1>
          <p className="subtitle">請輸入訂位時填寫的手機號碼</p>
        </div>

        <form onSubmit={handleSubmit} className="lookup-form">
          {/* 手機號碼 */}
          <div className="form-group">
            <label>
              <FaPhone /> 手機號碼
            </label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value.replace(/\D/g, ''))}
              placeholder="請輸入手機號碼 (09xxxxxxxx)"
              className="form-input"
              maxLength={10}
              pattern="09\d{8}"
              disabled={loading}
            />
            <small className="input-hint">請輸入訂位時填寫的手機號碼</small>
          </div>

          {/* 錯誤訊息 */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* 操作按鈕 */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClear}
              disabled={loading}
            >
              清除
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? '查詢中...' : '查詢訂位'}
            </button>
          </div>
        </form>

        {/* 說明資訊 */}
        <div className="info-box">
          <h3>找不到訂位資訊？</h3>
          <ul>
            <li>請確認手機號碼是否為訂位時填寫的號碼</li>
            <li>手機號碼格式需為 09 開頭的 10 位數字</li>
            <li>如果是會員，建議先<a href="/login/customer">登入</a>後查看訂位</li>
            <li>訂位資訊保留 30 天，過期後將無法查詢</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GuestReservationLookup;
