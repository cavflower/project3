import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCheckCircle, FaCalendarAlt, FaHome, FaPhone } from 'react-icons/fa';
import { useAuth } from '../../store/AuthContext';
import './ReservationSuccessPage.css';

const ReservationSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [reservationData, setReservationData] = useState(null);

  useEffect(() => {
    // 從導航狀態獲取訂位資料
    if (location.state) {
      setReservationData({
        reservationNumber: location.state.reservationNumber,
        phoneNumber: location.state.phone,
        isGuest: location.state.isGuest,
      });
    }
  }, [location.state]);

  const displayData = reservationData || {};
  const isGuest = displayData.isGuest || !user;

  return (
    <div className="reservation-success-page">
      <div className="success-container">
        <div className="success-icon">
          <FaCheckCircle />
        </div>
        
        <h1>訂位成功！</h1>
        <p className="success-message">
          我們已收到您的訂位申請，稍後會發送確認通知至您的聯絡方式。
        </p>

        {/* 訂位編號 */}
        {displayData.reservationNumber && (
          <div className="reservation-number-section">
            <div className="reservation-number-card">
              <p className="label">訂位編號</p>
              <p className="reservation-number">{displayData.reservationNumber}</p>
            </div>
          </div>
        )}

        {/* 訪客專用：提醒手機號碼用途 */}
        {isGuest && (
          <div className="guest-info-section">
            <div className="important-notice">
              <h3><FaPhone /> 重要提醒</h3>
              <p>查詢、修改或取消訂位時，需輸入訂位時填寫的手機號碼</p>
            </div>

            <div className="phone-reminder-card">
              <div className="card-header">
                <FaPhone className="card-icon" />
                <span>訂位手機號碼</span>
              </div>
              <div className="phone-display">
                <span className="phone-text">{displayData.phoneNumber || '您填寫的手機號碼'}</span>
              </div>
              <p className="phone-hint">請妥善保管，查詢訂位時必須使用</p>
            </div>

            <div className="guest-notice">
              <p>💡 <strong>如何查詢訂位？</strong></p>
              <p>請前往「我的訂位」頁面，輸入訂位時填寫的手機號碼即可查看</p>
            </div>
          </div>
        )}

        <div className="success-info">
          <div className="info-card">
            <FaCalendarAlt className="card-icon" />
            <div className="card-content">
              <h3>您可以</h3>
              <ul>
                <li>{isGuest ? '使用手機號碼查詢訂位記錄' : '查看訂位記錄'}</li>
                <li>修改訂位時間與人數</li>
                <li>取消訂位</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className="btn-primary"
            onClick={() => navigate(isGuest ? '/guest-lookup' : '/my-reservations')}
          >
            {isGuest ? '查詢我的訂位' : '查看我的訂位'}
          </button>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/')}
          >
            <FaHome /> 返回首頁
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationSuccessPage;
