import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { FaCalendarAlt } from 'react-icons/fa';
import ReservationCard from '../../components/reservations/ReservationCard';
import { getMyReservations, verifyGuestReservation, cancelReservation } from '../../api/reservationApi';
import styles from './MyReservationsPage.module.css';

const MyReservationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [activeStatus, setActiveStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [guestVerified, setGuestVerified] = useState(false);
  const [guestPhoneNumber, setGuestPhoneNumber] = useState('');

  // 檢查訪客是否已驗證
  const checkGuestAccess = useCallback(() => {
    if (!user) {
      const guestToken = sessionStorage.getItem('guestReservationToken');
      if (guestToken) {
        try {
          const tokenData = JSON.parse(guestToken);
          if (tokenData.expiresAt > Date.now()) {
            setIsGuest(true);
            setGuestVerified(true);
          } else {
            sessionStorage.removeItem('guestReservationToken');
            navigate('/guest-lookup');
          }
        } catch (error) {
          console.error('Invalid guest token:', error);
          navigate('/guest-lookup');
        }
      } else {
        navigate('/guest-lookup');
      }
    }
  }, [navigate, user]);

  useEffect(() => {
    checkGuestAccess();
  }, [checkGuestAccess]);

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      let reservationsData = [];

      if (!user && guestVerified) {
        // 訪客透過手機號碼查詢訂位
        const guestToken = JSON.parse(sessionStorage.getItem('guestReservationToken'));
        const response = await verifyGuestReservation(guestToken.phoneNumber);
        reservationsData = response.data.reservations || [];
        setGuestPhoneNumber(guestToken.phoneNumber);
      } else if (user) {
        // 會員查詢自己的訂位
        const response = await getMyReservations();
        reservationsData = response.data || [];
      }

      setReservations(reservationsData);
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
      setError('載入訂位資料失敗，請稍後再試。');

      if (!user && error.response?.status === 404) {
        sessionStorage.removeItem('guestReservationToken');
        navigate('/guest-lookup');
      }
    } finally {
      setLoading(false);
    }
  }, [guestVerified, navigate, user]);

  useEffect(() => {
    if (user || guestVerified) {
      fetchReservations();
    }
  }, [user, guestVerified, fetchReservations]);

  const handleCancelClick = (reservationId) => {
    setSelectedReservationId(reservationId);
    setShowCancelDialog(true);
  };

  const handleCancelReservation = async () => {
    try {
      const phoneNumber = isGuest ? guestPhoneNumber : null;
      await cancelReservation(selectedReservationId, cancelReason, phoneNumber);

      // 直接更新本地狀態，避免重新載入
      setReservations(prevReservations =>
        prevReservations.map(r =>
          r.id === selectedReservationId
            ? { ...r, status: 'cancelled', cancel_reason: cancelReason }
            : r
        )
      );

      setShowCancelDialog(false);
      setCancelReason('');
      setSelectedReservationId(null);
      alert('訂位已取消！');
    } catch (error) {
      console.error('Failed to cancel reservation:', error);
      const errorMsg = error.response?.data?.error || '取消訂位失敗，請稍後再試。';
      alert(errorMsg);
    }
  };

  const handleEditReservation = (reservationId) => {
    navigate(`/reservation/edit/${reservationId}`);
  };

  const getFilteredReservations = () => {
    if (activeStatus === 'all') return reservations;
    return reservations.filter(r => r.status === activeStatus);
  };

  const filteredReservations = getFilteredReservations();

  const statusCounts = {
    pending: reservations.filter(r => r.status === 'pending').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    completed: reservations.filter(r => r.status === 'completed').length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length,
  };

  if (loading) {
    return (
      <div className={styles.myReservationsPage}>
        <div className={styles.loadingContainer}>
          <div className="spinner"></div>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.myReservationsPage}>
      <div className={styles.pageHeader}>
        <h1><FaCalendarAlt /> 我的訂位</h1>
        {isGuest && (
          <div className={styles.guestBadge}>
            訪客模式
          </div>
        )}
        <button className={styles.btnNewReservation} onClick={() => navigate('/')}>
          <FaCalendarAlt /> 新增訂位
        </button>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* 狀態篩選 */}
      <div className={styles.statusTabs}>
        <button
          className={activeStatus === 'all' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatus('all')}
        >
          全部 ({reservations.length})
        </button>
        <button
          className={activeStatus === 'pending' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatus('pending')}
        >
          待確認 ({statusCounts.pending})
        </button>
        <button
          className={activeStatus === 'confirmed' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatus('confirmed')}
        >
          已確認 ({statusCounts.confirmed})
        </button>
        <button
          className={activeStatus === 'completed' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatus('completed')}
        >
          已完成 ({statusCounts.completed})
        </button>
        <button
          className={activeStatus === 'cancelled' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatus('cancelled')}
        >
          已取消 ({statusCounts.cancelled})
        </button>
      </div>

      {/* 訂位列表 */}
      <div className="reservations-list">
        {filteredReservations.length === 0 ? (
          <div className={styles.emptyState}>
            <FaCalendarAlt />
            <p>目前沒有{activeStatus === 'all' ? '' : getStatusText(activeStatus)}訂位記錄</p>
            <button className={styles.btnPrimary} onClick={() => navigate('/')}>
              立即訂位
            </button>
          </div>
        ) : (
          filteredReservations.map(reservation => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              viewMode="customer"
              showActions={true}
              actions={{
                onEdit: reservation.can_edit !== false ? () => handleEditReservation(reservation.id) : null,
                onCancel: reservation.can_cancel !== false ? () => handleCancelClick(reservation.id) : null,
              }}
            />
          ))
        )}
      </div>

      {/* 取消訂位對話框 */}
      {showCancelDialog && (
        <div className={styles.modalOverlay} onClick={() => setShowCancelDialog(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2>取消訂位</h2>
            <p>請說明取消原因：</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="例如：行程變更、身體不適等"
              rows="4"
            />
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason('');
                }}
              >
                取消
              </button>
              <button
                className={styles.btnDanger}
                onClick={handleCancelReservation}
              >
                確認取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getStatusText = (status) => {
  const statusMap = {
    pending: '待確認',
    confirmed: '已確認',
    completed: '已完成',
    cancelled: '已取消',
  };
  return statusMap[status] || '';
};

export default MyReservationsPage;
