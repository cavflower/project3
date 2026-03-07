import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCheckCircle, FaCalendarAlt, FaHome, FaPhone } from 'react-icons/fa';
import { useAuth } from '../../store/AuthContext';
import styles from './ReservationSuccessPage.module.css';

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
    <div className={styles.reservationSuccessPage}>
      <div className={styles.successContainer}>
        <div className={styles.successIcon}>
          <FaCheckCircle />
        </div>

        <h1>訂位成功！</h1>
        <p className={styles.successMessage}>
          我們已收到您的訂位申請，稍後會發送確認通知至您的聯絡方式。
        </p>

        {/* 訂位編號 */}
        {displayData.reservationNumber && (
          <div className={styles.reservationNumberSection}>
            <div className={styles.reservationNumberCard}>
              <p className={styles.label}>訂位編號</p>
              <p className={styles.reservationNumber}>{displayData.reservationNumber}</p>
            </div>
          </div>
        )}

        {/* 訪客專用：提醒手機號碼用途 */}
        {isGuest && (
          <div className={styles.guestInfoSection}>
            <div className={styles.importantNotice}>
              <h3><FaPhone /> 重要提醒</h3>
              <p>查詢、修改或取消訂位時，需輸入訂位時填寫的手機號碼</p>
            </div>

            <div className={styles.phoneReminderCard}>
              <div className={styles.cardHeader}>
                <FaPhone className={styles.cardIcon} />
                <span>訂位手機號碼</span>
              </div>
              <div className={styles.phoneDisplay}>
                <span className={styles.phoneText}>{displayData.phoneNumber || '您填寫的手機號碼'}</span>
              </div>
              <p className={styles.phoneHint}>請妥善保管，查詢訂位時必須使用</p>
            </div>

            <div className={styles.guestNotice}>
              <p>💡 <strong>如何查詢訂位？</strong></p>
              <p>請前往「我的訂位」頁面，輸入訂位時填寫的手機號碼即可查看</p>
            </div>
          </div>
        )}

        <div className={styles.successInfo}>
          <div className={styles.infoCard}>
            <FaCalendarAlt className={styles.cardIcon} />
            <div className={styles.cardContent}>
              <h3>您可以</h3>
              <ul>
                <li>{isGuest ? '使用手機號碼查詢訂位記錄' : '查看訂位記錄'}</li>
                <li>修改訂位時間與人數</li>
                <li>取消訂位</li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.actionButtons}>
          <button
            className={styles.btnPrimary}
            onClick={() => navigate(isGuest ? '/guest-lookup' : '/my-reservations')}
          >
            {isGuest ? '查詢我的訂位' : '查看我的訂位'}
          </button>
          <button
            className={styles.btnSecondary}
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
