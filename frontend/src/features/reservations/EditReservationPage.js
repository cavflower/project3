import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { FaCalendarAlt, FaClock, FaUsers, FaStore, FaChild } from 'react-icons/fa';
import { getReservationDetail, updateReservation, getPublicTimeSlots } from '../../api/reservationApi';
import './EditReservationPage.css';

const EditReservationPage = () => {
  const { reservationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [guestPhoneNumber, setGuestPhoneNumber] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  
  const [formData, setFormData] = useState({
    timeSlot: '',
    partySize: 1,
    childrenCount: 0,
    specialRequests: '',
  });

  useEffect(() => {
    fetchReservationData();
  }, [reservationId]);

  useEffect(() => {
    if (reservation) {
      fetchAvailableTimeSlots(reservation.reservation_date);
    }
  }, [reservation]);

  const fetchReservationData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 檢查是否為訪客
      if (!user) {
        const guestToken = sessionStorage.getItem('guestReservationToken');
        if (guestToken) {
          const tokenData = JSON.parse(guestToken);
          setGuestPhoneNumber(tokenData.phoneNumber);
          setIsGuest(true);
        } else {
          navigate('/guest-lookup');
          return;
        }
      }
      
      const response = await getReservationDetail(reservationId);
      const reservationData = response.data;
      
      setReservation(reservationData);
      setFormData({
        timeSlot: reservationData.time_slot,
        partySize: reservationData.party_size,
        childrenCount: reservationData.children_count,
        specialRequests: reservationData.special_requests || '',
      });
    } catch (error) {
      console.error('Failed to fetch reservation:', error);
      setError('載入訂位資料失敗，請稍後再試。');
      navigate('/my-reservations');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTimeSlots = async (date) => {
    try {
      if (!reservation?.store) return;
      
      const selectedDate = new Date(date);
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const response = await getPublicTimeSlots(reservation.store, dateStr);
      const allSlots = response.data.results || response.data;
      
      // 篩選該星期的時段
      const daySlots = allSlots
        .filter(slot => slot.day_of_week === dayOfWeek && slot.is_active)
        .map(slot => {
          const timeDisplay = slot.end_time 
            ? `${slot.start_time.substring(0, 5)}-${slot.end_time.substring(0, 5)}`
            : slot.start_time.substring(0, 5);
          
          return {
            id: slot.id,
            time: timeDisplay,
            available: slot.available !== undefined ? slot.available : true,
            capacity: slot.max_capacity,
            max_party_size: slot.max_party_size,
            current_bookings: slot.current_bookings || 0,
          };
        });
      
      setAvailableTimeSlots(daySlots);
    } catch (error) {
      console.error('Failed to fetch time slots:', error);
      setError('載入可用時段失敗');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
    return date.toLocaleDateString('zh-TW', options);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 驗證
    if (!formData.timeSlot) {
      alert('請選擇訂位時段');
      return;
    }
    
    if (formData.partySize < 1) {
      alert('訂位人數至少需要 1 位');
      return;
    }
    
    // 驗證總人數是否超過單筆限制
    const selectedSlot = availableTimeSlots.find(slot => slot.time === formData.timeSlot);
    if (selectedSlot) {
      const totalPeople = formData.partySize + formData.childrenCount;
      if (totalPeople > selectedSlot.max_party_size) {
        alert(`總人數（大人+小孩）不能超過 ${selectedSlot.max_party_size} 人`);
        return;
      }
    }
    
    const totalGuests = formData.partySize + formData.childrenCount;
    if (totalGuests > 20) {
      alert('總人數不能超過 20 位');
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {
        time_slot: formData.timeSlot,
        party_size: formData.partySize,
        children_count: formData.childrenCount,
        special_requests: formData.specialRequests,
      };
      
      // 訪客需提供手機號碼驗證
      const phoneNumber = isGuest ? guestPhoneNumber : null;
      await updateReservation(reservationId, updateData, phoneNumber);
      
      alert('訂位已更新！');
      navigate('/my-reservations');
    } catch (error) {
      console.error('Failed to update reservation:', error);
      const errorMsg = error.response?.data?.error || '更新訂位失敗，請稍後再試。';
      alert(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('確定要放棄修改嗎？')) {
      navigate('/my-reservations');
    }
  };

  if (loading) {
    return (
      <div className="edit-reservation-page">
        <div className="loading-container">
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="edit-reservation-page">
        <div className="error-container">
          <p>找不到訂位資料</p>
          <button onClick={() => navigate('/my-reservations')}>返回我的訂位</button>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-reservation-page">
      <div className="page-container">
        <div className="page-header">
          <h1>編輯訂位</h1>
          <p className="subtitle">修改訂位時段、人數或備註需求</p>
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          {/* 餐廳資訊（不可編輯） */}
          <div className="info-section">
            <h2>餐廳資訊</h2>
            <div className="info-card">
              <div className="info-row">
                <FaStore className="info-icon" />
                <div>
                  <strong>{reservation.store_name}</strong>
                  <p className="store-address">{reservation.store_address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 訂位日期（不可編輯） */}
          <div className="info-section">
            <h2>訂位日期</h2>
            <div className="info-card readonly">
              <div className="info-row">
                <FaCalendarAlt className="info-icon" />
                <div>
                  <strong>{formatDate(reservation.reservation_date)}</strong>
                  <p className="readonly-notice">訂位日期無法修改</p>
                </div>
              </div>
            </div>
          </div>

          {/* 訂位時段（可編輯） */}
          <div className="form-section">
            <label className="section-label">
              <FaClock /> 訂位時段
            </label>
            <div className="time-slots-grid">
              {availableTimeSlots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`time-slot-btn ${formData.timeSlot === slot.time ? 'selected' : ''} ${!slot.available ? 'disabled' : ''}`}
                  onClick={() => slot.available && handleInputChange('timeSlot', slot.time)}
                  disabled={!slot.available}
                >
                  <div className="slot-time">{slot.time}</div>
                  <div className="slot-capacity">單筆限 {slot.max_party_size} 人</div>
                  {slot.available ? (
                    <div className="slot-status available">
                      可訂 ({slot.capacity - slot.current_bookings} 位)
                    </div>
                  ) : (
                    <div className="slot-status full">已滿</div>
                  )}
                </button>
              ))}
            </div>
            {formData.timeSlot !== reservation.time_slot && (
              <p className="change-notice">
                ⚠️ 時段將從 <strong>{reservation.time_slot}</strong> 變更為 <strong>{formData.timeSlot}</strong>
              </p>
            )}
          </div>

          {/* 訂位人數（可編輯） */}
          <div className="form-section">
            <label className="section-label">
              <FaUsers /> 訂位人數
            </label>
            <div className="people-selection">
              <div className="people-input-group">
                <label>大人人數</label>
                <select
                  value={formData.partySize}
                  onChange={(e) => handleInputChange('partySize', parseInt(e.target.value))}
                  className="custom-select"
                >
                  {[...Array(20)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} 位
                    </option>
                  ))}
                </select>
              </div>
              <div className="people-input-group">
                <label>
                  <FaChild /> 小孩人數
                </label>
                <select
                  value={formData.childrenCount}
                  onChange={(e) => handleInputChange('childrenCount', parseInt(e.target.value))}
                  className="custom-select"
                >
                  {[...Array(11)].map((_, i) => (
                    <option key={i} value={i}>
                      {i} 位
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="total-guests">
              總人數：{formData.partySize + formData.childrenCount} 位
            </p>
            {(formData.partySize !== reservation.party_size || formData.childrenCount !== reservation.children_count) && (
              <p className="change-notice">
                ⚠️ 人數將從 <strong>{reservation.party_size} 位大人 + {reservation.children_count} 位小孩</strong> 變更為 <strong>{formData.partySize} 位大人 + {formData.childrenCount} 位小孩</strong>
              </p>
            )}
          </div>

          {/* 特殊需求（可編輯） */}
          <div className="form-section">
            <label className="section-label">備註需求（選填）</label>
            <textarea
              value={formData.specialRequests}
              onChange={(e) => handleInputChange('specialRequests', e.target.value)}
              placeholder="如有特殊需求，請在此說明（例如：靠窗座位、兒童座椅、素食等）"
              rows="4"
              className="special-requests-input"
              maxLength={200}
            />
            <p className="char-count">{formData.specialRequests.length}/200</p>
          </div>

          {/* 操作按鈕 */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancel}
              disabled={saving}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={saving}
            >
              {saving ? '儲存中...' : '確認修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditReservationPage;
