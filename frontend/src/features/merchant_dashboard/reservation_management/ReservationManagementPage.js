import React, { useState, useEffect } from 'react';
import { FaClock, FaUsers, FaCalendarAlt, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import TimeSlotSettings from './TimeSlotSettings';
import ReservationList from './ReservationList';
import './ReservationManagementPage.css';
import { 
  getMerchantReservations, 
  updateReservationStatus, 
  merchantCancelReservation,
  deleteReservation,
  getReservationStats,
  getTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot
} from '../../../api/reservationApi';

const ReservationManagementPage = () => {
  const [activeTab, setActiveTab] = useState('reservations'); // 'reservations' or 'settings'
  const [reservations, setReservations] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
  });
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [mouseDownOnOverlay, setMouseDownOnOverlay] = useState(false);

  useEffect(() => {
    fetchReservations();
    fetchTimeSlots();
  }, []);

  const fetchReservations = async () => {
    try {
      const response = await getMerchantReservations();
      const reservationData = response.data.results || response.data;
      setReservations(reservationData);
      updateStats(reservationData);
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
      alert('無法載入訂位資料，請稍後再試。');
    }
  };

  const fetchTimeSlots = async () => {
    try {
      const response = await getTimeSlots();
      const slots = response.data.results || response.data;
      setTimeSlots(slots);
    } catch (error) {
      console.error('Failed to fetch time slots:', error);
      // 如果沒有設定，使用空陣列
      setTimeSlots([]);
    }
  };

  const updateStats = (reservationList) => {
    const newStats = {
      pending: reservationList.filter(r => r.status === 'pending').length,
      confirmed: reservationList.filter(r => r.status === 'confirmed').length,
      cancelled: reservationList.filter(r => r.status === 'cancelled').length,
      completed: reservationList.filter(r => r.status === 'completed').length,
    };
    setStats(newStats);
  };

  const handleAcceptReservation = async (reservationId) => {
    try {
      await updateReservationStatus(reservationId, 'confirmed');
      await fetchReservations();
      alert('訂位已確認！');
    } catch (error) {
      console.error('Failed to accept reservation:', error);
      const errorMsg = error.response?.data?.error || '確認訂位失敗，請稍後再試。';
      alert(errorMsg);
    }
  };

  const handleCancelClick = (reservationId) => {
    setSelectedReservationId(reservationId);
    setShowCancelDialog(true);
  };

  const handleCancelReservation = async () => {
    try {
      await merchantCancelReservation(selectedReservationId, cancelReason);
      await fetchReservations();
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

  const handleCompleteReservation = async (reservationId) => {
    if (!window.confirm('確定要將此訂位標記為已完成嗎？')) return;
    
    try {
      await updateReservationStatus(reservationId, 'completed');
      await fetchReservations();
      alert('訂位已完成！');
    } catch (error) {
      console.error('Failed to complete reservation:', error);
      const errorMsg = error.response?.data?.error || '標記完成失敗，請稍後再試。';
      alert(errorMsg);
    }
  };

  const handleDeleteReservation = async (reservationId) => {
    if (!window.confirm('確定要刪除此訂位記錄嗎？此操作無法復原。')) return;
    
    try {
      await deleteReservation(reservationId);
      await fetchReservations();
      alert('訂位記錄已刪除！');
    } catch (error) {
      console.error('Failed to delete reservation:', error);
      const errorMsg = error.response?.data?.error || '刪除訂位失敗，請稍後再試。';
      alert(errorMsg);
    }
  };

  const handleSaveTimeSlot = async (timeSlotData) => {
    try {
      const processedData = {
        ...timeSlotData,
        end_time: timeSlotData.end_time || null
      };
      
      if (timeSlotData.id) {
        const response = await updateTimeSlot(timeSlotData.id, processedData);
        setTimeSlots(prevSlots => 
          prevSlots.map(slot => slot.id === timeSlotData.id ? response.data : slot)
        );
        alert('時段已更新！');
      } else {
        const response = await createTimeSlot(processedData);
        setTimeSlots(prevSlots => [...prevSlots, response.data]);
        alert('時段已新增！');
      }
    } catch (error) {
      console.error('Failed to save time slot:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || '儲存時段失敗，請稍後再試。';
      alert(errorMsg);
    }
  };

  const handleDeleteTimeSlot = async (slotId) => {
    if (!window.confirm('確定要刪除此時段嗎？')) return;
    
    try {
      await deleteTimeSlot(slotId);
      setTimeSlots(prevSlots => prevSlots.filter(slot => slot.id !== slotId));
      alert('時段已刪除！');
    } catch (error) {
      console.error('Failed to delete time slot:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || '刪除時段失敗，請稍後再試。';
      alert(errorMsg);
    }
  };

  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      setMouseDownOnOverlay(true);
    } else {
      setMouseDownOnOverlay(false);
    }
  };

  const handleOverlayMouseUp = (e) => {
    if (mouseDownOnOverlay && e.target === e.currentTarget) {
      setShowCancelDialog(false);
    }
    setMouseDownOnOverlay(false);
  };

  return (
    <div className="reservation-management-page">
      <div className="page-header">
        <h1>訂位管理</h1>
        <div className="header-stats">
          <div className="stat-card pending">
            <FaClock />
            <div>
              <span className="stat-number">{stats.pending}</span>
              <span className="stat-label">待確認</span>
            </div>
          </div>
          <div className="stat-card confirmed">
            <FaCheckCircle />
            <div>
              <span className="stat-number">{stats.confirmed}</span>
              <span className="stat-label">已確認</span>
            </div>
          </div>
          <div className="stat-card completed">
            <FaUsers />
            <div>
              <span className="stat-number">{stats.completed}</span>
              <span className="stat-label">已完成</span>
            </div>
          </div>
          <div className="stat-card cancelled">
            <FaTimesCircle />
            <div>
              <span className="stat-number">{stats.cancelled}</span>
              <span className="stat-label">已取消</span>
            </div>
          </div>
        </div>
      </div>

      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'reservations' ? 'active' : ''}`}
          onClick={() => setActiveTab('reservations')}
        >
          <FaCalendarAlt /> 訂位列表
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <FaClock /> 時段設定
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'reservations' ? (
          <ReservationList
            reservations={reservations}
            onAccept={handleAcceptReservation}
            onCancel={handleCancelClick}
            onComplete={handleCompleteReservation}
            onDelete={handleDeleteReservation}
          />
        ) : (
          <TimeSlotSettings
            timeSlots={timeSlots}
            onSave={handleSaveTimeSlot}
            onDelete={handleDeleteTimeSlot}
          />
        )}
      </div>

      {/* 取消訂位對話框 */}
      {showCancelDialog && (
        <div 
          className="dialog-overlay" 
          onMouseDown={handleOverlayMouseDown}
          onMouseUp={handleOverlayMouseUp}
        >
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <h3>取消訂位</h3>
            <p>您確定要取消此訂位嗎？</p>
            <div className="form-group">
              <label>取消原因（選填）</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="請說明取消原因..."
                rows="4"
              />
            </div>
            <div className="dialog-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason('');
                  setSelectedReservationId(null);
                }}
              >
                返回
              </button>
              <button
                className="btn-danger"
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

export default ReservationManagementPage;
