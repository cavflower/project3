import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import {
  FaCalendarAlt,
  FaUsers,
  FaClock,
  FaUtensils,
  FaCheckCircle,
  FaArrowLeft,
  FaArrowRight
} from 'react-icons/fa';
import { createReservation, getPublicTimeSlots } from '../../api/reservationApi';
import styles from './ReservationPage.module.css';

const ReservationPage = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  console.log('🚀 ReservationPage mounted, storeId:', storeId);

  // 訂位步驟狀態
  const [currentStep, setCurrentStep] = useState(1);
  const [reservationData, setReservationData] = useState({
    date: '',
    partySize: 2,
    childrenCount: 0,
    timeSlot: '',
    guestInfo: {
      name: '',
      gender: 'female',
      phone: '',
      email: '',
    },
    specialRequests: '',
  });

  // 步驟定義：1.選擇訂位資訊 2.特殊需求(會員)/填寫資料+特殊需求(訪客) 3.確認訂位
  const totalSteps = 3; // 會員和訪客都是3步驟

  // 可用時段
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [openWeekdays, setOpenWeekdays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ min: '' });

  // 使用 useCallback 避免不必要的重新渲染
  const fetchAvailableTimeSlots = useCallback(async (date) => {
    // 驗證 storeId 是否存在
    if (!storeId) {
      setError('店家資訊錯誤，請重新選擇店家');
      setAvailableTimeSlots([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const selectedDate = new Date(date);
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];

      console.log('🔍 Debug - Fetching time slots:', {
        date,
        selectedDate,
        dayOfWeek,
        storeId
      });

      // 傳遞日期參數以獲取容量資訊
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await getPublicTimeSlots(storeId, dateStr);
      const allSlots = response.data.results || response.data;

      console.log('📥 API Response:', {
        totalSlots: allSlots.length,
        slots: allSlots
      });

      // 篩選該星期的時段，並且只顯示啟用的時段
      const daySlots = allSlots
        .filter(slot => slot.day_of_week === dayOfWeek && slot.is_active)
        .map(slot => {
          // 處理時間顯示（如果沒有結束時間，只顯示開始時間）
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
            start_time: slot.start_time,
            end_time: slot.end_time,
          };
        });

      console.log('✅ Filtered slots for', dayOfWeek, ':', daySlots);

      setAvailableTimeSlots(daySlots);
      setLoading(false);

      // 如果該日沒有時段，顯示提示訊息
      if (daySlots.length === 0) {
        setError('該日期尚無可訂位時段，請選擇其他日期');
      }
    } catch (err) {
      console.error('Failed to fetch time slots:', err);
      setError('無法載入時段資料，請稍後再試');
      setAvailableTimeSlots([]);
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    const today = new Date();
    setDateRange({
      min: today.toISOString().split('T')[0],
    });
  }, []);

  useEffect(() => {
    const fetchOpenWeekdays = async () => {
      if (!storeId) return;

      try {
        const response = await getPublicTimeSlots(storeId);
        const allSlots = response.data.results || response.data;
        const weekdays = Array.from(
          new Set(
            (allSlots || [])
              .filter((slot) => slot.is_active)
              .map((slot) => slot.day_of_week)
          )
        );

        setOpenWeekdays(weekdays);
      } catch (err) {
        console.error('Failed to fetch open weekdays:', err);
      }
    };

    fetchOpenWeekdays();
  }, [storeId]);

  useEffect(() => {
    console.log('🔄 useEffect triggered - reservationData.date:', reservationData.date, 'storeId:', storeId);
    if (reservationData.date && storeId) {
      console.log('📅 Date changed, fetching time slots for:', reservationData.date);
      fetchAvailableTimeSlots(reservationData.date);
    } else {
      console.log('⚠️ Not fetching - date or storeId missing');
    }
  }, [reservationData.date, storeId, fetchAvailableTimeSlots]);

  const handleDateSelect = (date) => {
    console.log('📆 handleDateSelect called with:', date);
    if (!date) {
      setReservationData({
        ...reservationData,
        date: '',
        timeSlot: '',
        selectedSlotId: null,
      });
      setError(null);
      return;
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setError('僅可預約今天之後的日期，請重新選擇。');
      return;
    }

    const selectedWeekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
    if (openWeekdays.length > 0 && !openWeekdays.includes(selectedWeekday)) {
      setError('該日期為店家未營業時段，請選擇其他日期。');
      return;
    }

    setError(null);
    setReservationData({
      ...reservationData,
      date,
      timeSlot: '',
      selectedSlotId: null,
    });
  };

  const handlePartySizeChange = (size) => {
    setReservationData({ ...reservationData, partySize: size });
  };

  const handleChildrenCountChange = (count) => {
    setReservationData({ ...reservationData, childrenCount: count });
  };

  const handleTimeSlotSelect = (slot) => {
    setReservationData({
      ...reservationData,
      timeSlot: slot.time,
      selectedSlotId: slot.id,
      maxPartySize: slot.max_party_size
    });
  };

  const handleGuestInfoChange = (e) => {
    const { name, value } = e.target;
    setReservationData({
      ...reservationData,
      guestInfo: {
        ...reservationData.guestInfo,
        [name]: value,
      },
    });
  };

  const handleNextStep = () => {
    // 驗證步驟1：選擇訂位資訊
    if (currentStep === 1) {
      if (!reservationData.date) {
        alert('請選擇訂位日期');
        return;
      }
      if (!reservationData.partySize) {
        alert('請選擇用餐人數');
        return;
      }
      if (!reservationData.timeSlot) {
        alert('請選擇訂位時段');
        return;
      }

      // 驗證總人數是否超過單筆限制
      const selectedSlot = availableTimeSlots.find(slot => slot.time === reservationData.timeSlot);
      if (selectedSlot) {
        const totalPeople = reservationData.partySize + (reservationData.childrenCount || 0);
        if (totalPeople > selectedSlot.max_party_size) {
          alert(`總人數（大人+小孩）不能超過 ${selectedSlot.max_party_size} 人`);
          return;
        }
      }
    }

    // 驗證步驟2：訪客填寫聯絡資料
    if (currentStep === 2 && !user) {
      if (!reservationData.guestInfo.name || reservationData.guestInfo.name.trim() === '') {
        alert('請填寫訂位人姓名');
        return;
      }
      if (!reservationData.guestInfo.phone || reservationData.guestInfo.phone.trim() === '') {
        alert('請填寫聯絡電話');
        return;
      }
      // 簡單驗證電話格式（至少要有數字）
      const phoneRegex = /\d/;
      if (!phoneRegex.test(reservationData.guestInfo.phone)) {
        alert('請輸入有效的電話號碼');
        return;
      }
    }

    setCurrentStep(currentStep + 1);
  };

  const handlePreviousStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmitReservation = async () => {
    try {
      setLoading(true);

      // 準備訂位資料
      const reservationPayload = {
        store: parseInt(storeId),
        reservation_date: reservationData.date,
        time_slot: reservationData.timeSlot,
        party_size: reservationData.partySize,
        children_count: reservationData.childrenCount,
        special_requests: reservationData.specialRequests || '',
      };

      // 如果是訪客，加入訪客資訊
      if (!user) {
        reservationPayload.customer_name = reservationData.guestInfo.name;
        reservationPayload.customer_phone = reservationData.guestInfo.phone;
        reservationPayload.customer_email = reservationData.guestInfo.email || '';
        reservationPayload.customer_gender = reservationData.guestInfo.gender;
      } else {
        // 會員也要加入性別資訊
        if (user.gender) {
          reservationPayload.customer_gender = user.gender;
        }
      }

      const response = await createReservation(reservationPayload);

      setLoading(false);

      // 導向成功頁面，並傳遞訂位編號
      navigate('/reservation/success', {
        state: {
          reservationNumber: response.data.reservation_number,
          isGuest: !user,
          phone: user ? user.phone_number : reservationData.guestInfo.phone
        }
      });
    } catch (error) {
      console.error('訂位失敗:', error);
      setLoading(false);
      const errorMsg = error.response?.data?.error ||
        error.response?.data?.detail ||
        '訂位失敗，請稍後再試。';
      alert(errorMsg);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { month: 'long', day: 'numeric', weekday: 'short' };
    return date.toLocaleDateString('zh-TW', options);
  };

  const getStepTitle = () => {
    if (user) {
      const titles = {
        1: '選擇訂位資訊',
        2: '特殊需求（可選）',
        3: '確認訂位',
      };
      return titles[currentStep];
    } else {
      const titles = {
        1: '選擇訂位資訊',
        2: '填寫訂位資料',
        3: '確認訂位',
      };
      return titles[currentStep];
    }
  };

  return (
    <div className={styles.reservationPage}>
      <div className={styles.reservationContainer}>
        {/* 進度條 */}
        <div className={styles.progressHeader}>
          <button className={styles.btnBack} onClick={() => navigate(-1)}>
            <FaArrowLeft /> 返回
          </button>
          <h1>{getStepTitle()}</h1>
          <div className={styles.stepIndicator}>
            步驟 {currentStep} / {totalSteps}
          </div>
        </div>

        <div className={styles.progressBarContainer}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* 步驟內容 */}
        <div className={styles.stepContent}>
          {/* 步驟 1: 選擇訂位資訊（日期+人數+時段） */}
          {currentStep === 1 && (
            <div className={styles.reservationInfoSelection}>
              {/* 日期選擇 */}
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>用餐日期</h3>
                <div>
                  <input
                    type="date"
                    className={styles.customSelect}
                    value={reservationData.date}
                    onChange={(e) => handleDateSelect(e.target.value)}
                    min={dateRange.min}
                  />
                  <small className={styles.formHint}>
                    可預約今天之後的日期，並僅開放有營業時段的日期。
                  </small>
                </div>
              </div>

              {/* 人數選擇 */}
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>用餐人數</h3>
                <div className={styles.partySizeRow}>
                  <div className={styles.partySizeItem}>
                    <label className={styles.selectLabel}>大人</label>
                    <select
                      className={styles.customSelect}
                      value={reservationData.partySize}
                      onChange={(e) => handlePartySizeChange(parseInt(e.target.value))}
                    >
                      {[...Array(20)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1} 位大人
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.partySizeItem}>
                    <label className={styles.selectLabel}>小孩</label>
                    <select
                      className={styles.customSelect}
                      value={reservationData.childrenCount}
                      onChange={(e) => handleChildrenCountChange(parseInt(e.target.value))}
                    >
                      {[...Array(11)].map((_, i) => (
                        <option key={i} value={i}>
                          {i} 位小孩
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <small className={styles.formHint}>
                  大人+小孩不能超過單筆人數上限
                </small>
              </div>

              {/* 時段選擇 */}
              {reservationData.date && (
                <div className={styles.sectionBlock}>
                  <h3 className={styles.sectionTitle}>訂位時段</h3>
                  {loading ? (
                    <div className={styles.loadingMessage}>載入時段中...</div>
                  ) : error ? (
                    <div className={styles.errorMessage}>{error}</div>
                  ) : availableTimeSlots.length === 0 ? (
                    <div className={styles.noSlotsMessage}>該日期尚無可訂位時段，請選擇其他日期</div>
                  ) : (
                    <div className={styles.timeSlotCompact}>
                      {availableTimeSlots.map((slot) => (
                        <button
                          key={slot.id}
                          className={reservationData.timeSlot === slot.time ? styles.timeSlotBtnSelected : (!slot.available ? styles.timeSlotBtnDisabled : styles.timeSlotBtn)}
                          onClick={() => slot.available && handleTimeSlotSelect(slot)}
                          disabled={!slot.available}
                        >
                          <div className={styles.slotTime}>{slot.time}</div>
                          <div className={styles.slotCapacity}>單筆限 {slot.max_party_size} 人</div>
                          {slot.available ? (
                            <div className={styles.slotStatusAvailable}>
                              可訂 ({slot.capacity - slot.current_bookings} 位)
                            </div>
                          ) : (
                            <div className={styles.slotStatusFull}>已滿</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 步驟 2: 填寫資料（僅訪客） */}
          {currentStep === 2 && !user && (
            <div className={styles.guestInfoForm}>
              <div className={styles.formNotice}>
                <p>請填寫您的聯絡資訊，以便我們確認訂位</p>
              </div>

              {/* 姓名與性別 */}
              <div className={styles.formRowInline}>
                <div className={`${styles.formGroup} ${styles.flexGrow}`}>
                  <label>訂位人姓名 *</label>
                  <input
                    type="text"
                    name="name"
                    value={reservationData.guestInfo.name}
                    onChange={handleGuestInfoChange}
                    placeholder="請輸入您的姓名"
                    required
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.genderGroup}`}>
                  <label>&nbsp;</label>
                  <div className={styles.genderOptions}>
                    <label className={styles.genderOption}>
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={reservationData.guestInfo.gender === 'female'}
                        onChange={handleGuestInfoChange}
                      />
                      <span className={styles.genderLabel}>小姐</span>
                    </label>
                    <label className={styles.genderOption}>
                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={reservationData.guestInfo.gender === 'male'}
                        onChange={handleGuestInfoChange}
                      />
                      <span className={styles.genderLabel}>先生</span>
                    </label>
                    <label className={styles.genderOption}>
                      <input
                        type="radio"
                        name="gender"
                        value="other"
                        checked={reservationData.guestInfo.gender === 'other'}
                        onChange={handleGuestInfoChange}
                      />
                      <span className={styles.genderLabel}>其他</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>電話 *</label>
                <input
                  type="tel"
                  name="phone"
                  value={reservationData.guestInfo.phone}
                  onChange={handleGuestInfoChange}
                  placeholder="0912-345-678"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={reservationData.guestInfo.email}
                  onChange={handleGuestInfoChange}
                  placeholder="example@email.com"
                />
              </div>

              {/* 特殊需求 */}
              <div className={styles.formGroup}>
                <label>特殊需求</label>
                <textarea
                  className={styles.specialRequestsTextarea}
                  value={reservationData.specialRequests}
                  onChange={(e) => setReservationData({
                    ...reservationData,
                    specialRequests: e.target.value
                  })}
                  placeholder="如：兒童座椅、過敏資訊等"
                  rows="4"
                />
              </div>
            </div>
          )}

          {/* 步驟 2: 會員用戶填寫特殊需求 */}
          {currentStep === 2 && user && (
            <div className={styles.specialRequestsSection}>
              <div className={styles.formNotice}>
                <p>如有特殊需求（如兒童座椅、過敏資訊等），請在此填寫</p>
              </div>

              <div className={styles.formGroup}>
                <label>特殊需求</label>
                <textarea
                  className={styles.specialRequestsTextarea}
                  value={reservationData.specialRequests}
                  onChange={(e) => setReservationData({
                    ...reservationData,
                    specialRequests: e.target.value
                  })}
                  placeholder="如：兒童座椅、過敏資訊等"
                  rows="6"
                />
              </div>
            </div>
          )}

          {/* 確認訂位步驟（會員和訪客都顯示） */}
          {currentStep === 3 && (
            <div className={styles.confirmationSection}>
              <div className={styles.confirmationCard}>
                <h3><FaCheckCircle /> 請確認您的訂位資訊</h3>
                <div className={styles.infoGroup}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>訂位日期：</span>
                    <span className={styles.infoValue}>{formatDate(reservationData.date)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>用餐時段：</span>
                    <span className={styles.infoValue}>{reservationData.timeSlot}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>用餐人數：</span>
                    <span className={styles.infoValue}>
                      {reservationData.partySize} 位大人
                      {reservationData.childrenCount > 0 && ` + ${reservationData.childrenCount} 位小孩`}
                      （共 {reservationData.partySize + reservationData.childrenCount} 位）
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>聯絡人：</span>
                    <span className={styles.infoValue}>
                      {user ? user.username : reservationData.guestInfo.name}
                      {user && user.gender && (
                        <span className={styles.genderSuffix}>
                          {user.gender === 'female' ? ' 小姐' :
                            user.gender === 'male' ? ' 先生' : ''}
                        </span>
                      )}
                      {!user && reservationData.guestInfo.gender && (
                        <span className={styles.genderSuffix}>
                          {reservationData.guestInfo.gender === 'female' ? ' 小姐' :
                            reservationData.guestInfo.gender === 'male' ? ' 先生' : ''}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>聯絡電話：</span>
                    <span className={styles.infoValue}>
                      {user ? user.phone_number : reservationData.guestInfo.phone}
                    </span>
                  </div>
                  {!user && reservationData.guestInfo.email && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Email：</span>
                      <span className={styles.infoValue}>{reservationData.guestInfo.email}</span>
                    </div>
                  )}
                  {reservationData.specialRequests && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>特殊需求：</span>
                      <span className={styles.infoValue}>{reservationData.specialRequests}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 導航按鈕 */}
        <div className={styles.navigationButtons}>
          {currentStep > 1 && (
            <button className={styles.btnPrevious} onClick={handlePreviousStep}>
              <FaArrowLeft /> 上一步
            </button>
          )}
          {currentStep < totalSteps ? (
            <button className={styles.btnNext} onClick={handleNextStep}>
              下一步 <FaArrowRight />
            </button>
          ) : (
            <button className={styles.btnConfirm} onClick={handleSubmitReservation}>
              <FaCheckCircle /> 確認訂位
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReservationPage;
