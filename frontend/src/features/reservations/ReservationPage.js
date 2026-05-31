import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaMapMarkerAlt,
  FaRegCalendarAlt,
  FaShieldAlt,
  FaUsers,
} from 'react-icons/fa';
import { createReservation, getPublicTimeSlots } from '../../api/reservationApi';
import { getStore } from '../../api/storeApi';
import { buildMediaUrl } from '../../api/apiConfig';
import styles from './ReservationPage.module.css';

const RESTAURANT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80';

const stepLabels = ['選擇資訊', '確認內容', '訂位完成'];

const getUserDisplayName = (user) => (
  user?.name ||
  user?.username ||
  (user?.email ? user.email.split('@')[0] : '') ||
  ''
);

const getStoreImageSource = (store) => (
  store?.first_image ||
  store?.image ||
  store?.images?.[0]?.image ||
  store?.images?.[0]?.image_url ||
  store?.store_images?.[0]?.image ||
  ''
);

const formatDate = (dateString) => {
  if (!dateString) return '尚未選擇';
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
};

const ReservationPage = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [store, setStore] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [reservationData, setReservationData] = useState({
    date: '',
    partySize: 2,
    childrenCount: 0,
    timeSlot: '',
    selectedSlotId: null,
    maxPartySize: null,
    guestInfo: {
      name: '',
      gender: 'female',
      phone: '',
      email: '',
    },
    specialRequests: '',
  });
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ min: '', max: '' });
  const timeSlotsCacheRef = useRef(new Map());
  const latestTimeSlotRequestRef = useRef(0);

  const restaurantName = store?.name || '餐廳名稱';
  const restaurantAddress = store?.address || '餐廳地址';
  const storeImageUrl = buildMediaUrl(getStoreImageSource(store)) || RESTAURANT_FALLBACK_IMAGE;
  const totalSteps = stepLabels.length;

  const fetchAvailableTimeSlots = useCallback(async (date) => {
    if (!storeId) {
      setError('找不到餐廳資訊，請重新進入訂位頁。');
      setAvailableTimeSlots([]);
      return;
    }

    const cacheKey = `${storeId}:${date}`;
    const cachedSlots = timeSlotsCacheRef.current.get(cacheKey);
    if (cachedSlots) {
      setAvailableTimeSlots(cachedSlots);
      setLoading(false);
      setError(cachedSlots.length === 0 ? '這天目前沒有可預約時段。' : null);
      return;
    }

    const requestId = latestTimeSlotRequestRef.current + 1;
    latestTimeSlotRequestRef.current = requestId;

    try {
      setLoading(true);
      setError(null);

      const selectedDate = new Date(`${date}T00:00:00`);
      const dayOfWeek = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ][selectedDate.getDay()];

      const response = await getPublicTimeSlots(storeId, date);
      const allSlots = response.data.results || response.data || [];
      const daySlots = allSlots
        .filter((slot) => slot.day_of_week === dayOfWeek && slot.is_active)
        .map((slot) => {
          const timeDisplay = slot.start_time.substring(0, 5);
          const capacity = Number(slot.max_capacity || 0);
          const currentBookings = Number(slot.current_bookings || 0);
          const remainingCapacity = Math.max(0, capacity - currentBookings);

          return {
            id: slot.id,
            time: timeDisplay,
            available: slot.available !== undefined ? slot.available && remainingCapacity > 0 : remainingCapacity > 0,
            capacity,
            max_party_size: Number(slot.max_party_size || 0),
            current_bookings: currentBookings,
            remaining_capacity: remainingCapacity,
            start_time: slot.start_time,
            end_time: slot.end_time,
          };
        });

      if (latestTimeSlotRequestRef.current !== requestId) return;

      timeSlotsCacheRef.current.set(cacheKey, daySlots);
      setAvailableTimeSlots(daySlots);
      setError(daySlots.length === 0 ? '這天目前沒有可預約時段。' : null);
    } catch (err) {
      if (latestTimeSlotRequestRef.current !== requestId) return;
      console.error('Failed to fetch time slots:', err);
      setError('時段載入失敗，請稍後再試。');
      setAvailableTimeSlots([]);
    } finally {
      if (latestTimeSlotRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [storeId]);

  useEffect(() => {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 90);

    setDateRange({
      min: today.toISOString().split('T')[0],
      max: maxDate.toISOString().split('T')[0],
    });
  }, []);

  useEffect(() => {
    let active = true;

    const loadStore = async () => {
      if (!storeId) return;

      try {
        const response = await getStore(storeId);
        if (active) {
          setStore(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch store:', err);
      }
    };

    loadStore();
    return () => {
      active = false;
    };
  }, [storeId]);

  useEffect(() => {
    if (!user) return;

    setReservationData((prev) => ({
      ...prev,
      guestInfo: {
        ...prev.guestInfo,
        name: prev.guestInfo.name || getUserDisplayName(user),
        gender: user.gender || prev.guestInfo.gender,
        phone: prev.guestInfo.phone || user.phone_number || '',
        email: prev.guestInfo.email || user.email || '',
      },
    }));
  }, [user]);

  useEffect(() => {
    if (reservationData.date && storeId) {
      fetchAvailableTimeSlots(reservationData.date);
    } else {
      setAvailableTimeSlots([]);
    }
  }, [reservationData.date, storeId, fetchAvailableTimeSlots]);

  const availableAdultOptions = useMemo(() => (
    Array.from({ length: 20 }, (_, index) => index + 1)
  ), []);

  const availableChildrenOptions = useMemo(() => (
    Array.from({ length: 11 }, (_, index) => index)
  ), []);

  const handleDateSelect = (date) => {
    if (!date) {
      setReservationData((prev) => ({
        ...prev,
        date: '',
        timeSlot: '',
        selectedSlotId: null,
        maxPartySize: null,
      }));
      setError(null);
      return;
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setError('不能預約過去的日期。');
      return;
    }

    setError(null);
    setReservationData((prev) => ({
      ...prev,
      date,
      timeSlot: '',
      selectedSlotId: null,
      maxPartySize: null,
    }));
  };

  const handleTimeSlotSelect = (slot) => {
    if (!slot) {
      setReservationData((prev) => ({
        ...prev,
        timeSlot: '',
        selectedSlotId: null,
        maxPartySize: null,
      }));
      return;
    }

    setReservationData((prev) => ({
      ...prev,
      timeSlot: slot.time,
      selectedSlotId: slot.id,
      maxPartySize: slot.max_party_size,
    }));
  };

  const handleGuestInfoChange = (event) => {
    const { name, value } = event.target;
    setReservationData((prev) => ({
      ...prev,
      guestInfo: {
        ...prev.guestInfo,
        [name]: value,
      },
    }));
  };

  const validateSelectionStep = () => {
    if (!reservationData.date) {
      alert('請選擇用餐日期。');
      return false;
    }

    if (!reservationData.partySize) {
      alert('請選擇用餐人數。');
      return false;
    }

    if (!reservationData.timeSlot) {
      alert('請選擇用餐時段。');
      return false;
    }

    const selectedSlot = availableTimeSlots.find(
      (slot) => String(slot.id) === String(reservationData.selectedSlotId)
    );
    if (selectedSlot) {
      const totalPeople = reservationData.partySize + (reservationData.childrenCount || 0);
      if (totalPeople > selectedSlot.max_party_size) {
        alert(`此時段最多可容納 ${selectedSlot.max_party_size} 位。`);
        return false;
      }

      if (totalPeople > selectedSlot.remaining_capacity) {
        alert(`此時段目前只剩 ${selectedSlot.remaining_capacity} 人可訂。`);
        return false;
      }
    }

    return true;
  };

  const validateGuestStep = () => {
    if (currentStep !== 2 || user) return true;

    if (!reservationData.guestInfo.name.trim()) {
      alert('請填寫訂位姓名。');
      return false;
    }

    if (!reservationData.guestInfo.phone.trim()) {
      alert('請填寫聯絡電話。');
      return false;
    }

    if (!/\d/.test(reservationData.guestInfo.phone)) {
      alert('請輸入有效的聯絡電話。');
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !validateSelectionStep()) return;
    if (!validateGuestStep()) return;

    setCurrentStep((step) => Math.min(step + 1, totalSteps));
  };

  const handlePreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 1));
  };

  const handleSubmitReservation = async () => {
    try {
      setLoading(true);

      const reservationPayload = {
        store: parseInt(storeId, 10),
        reservation_date: reservationData.date,
        time_slot: reservationData.timeSlot,
        party_size: reservationData.partySize,
        children_count: reservationData.childrenCount,
        special_requests: reservationData.specialRequests || '',
      };

      if (!user) {
        reservationPayload.customer_name = reservationData.guestInfo.name;
        reservationPayload.customer_phone = reservationData.guestInfo.phone;
        reservationPayload.customer_email = reservationData.guestInfo.email || '';
        reservationPayload.customer_gender = reservationData.guestInfo.gender;
      } else {
        reservationPayload.customer_name = getUserDisplayName(user);
        reservationPayload.customer_phone = user.phone_number || '';
        reservationPayload.customer_email = user.email || '';
        if (user.gender) {
          reservationPayload.customer_gender = user.gender;
        }
      }

      const response = await createReservation(reservationPayload);
      const createdReservation = response.data || {};

      const successState = {
        reservation: createdReservation,
        reservationNumber: createdReservation.reservation_number,
        isGuest: !user,
        phone: createdReservation.customer_phone || reservationPayload.customer_phone,
        email: createdReservation.customer_email || reservationPayload.customer_email,
        storeName: createdReservation.store_name || restaurantName,
        storeAddress: createdReservation.store_address || restaurantAddress,
        reservationDate: createdReservation.reservation_date || reservationPayload.reservation_date,
        timeSlot: createdReservation.time_slot || reservationPayload.time_slot,
        partySize: createdReservation.party_size ?? reservationPayload.party_size,
        childrenCount: createdReservation.children_count ?? reservationPayload.children_count,
      };

      try {
        sessionStorage.setItem('dineverse:lastReservationSuccess', JSON.stringify(successState));
      } catch (storageError) {
        console.warn('Unable to persist reservation success data:', storageError);
      }

      navigate('/reservation/success', { state: successState });
    } catch (err) {
      console.error('Reservation failed:', err);
      const errorMsg = err.response?.data?.error ||
        err.response?.data?.detail ||
        '訂位失敗，請稍後再試。';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderStepper = () => (
    <div className={styles.stepper} aria-label="訂位步驟">
      {stepLabels.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isDone = currentStep > stepNumber;

        return (
          <React.Fragment key={label}>
            <div
              className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''} ${isDone ? styles.stepItemDone : ''}`}
            >
              <span className={styles.stepBadge}>{isDone ? <FaCheckCircle /> : stepNumber}</span>
              <span>{label}</span>
            </div>
            {index < stepLabels.length - 1 && <span className={styles.stepLine} aria-hidden="true" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderSidebar = () => (
    <aside className={styles.bookingSidebar}>
      <div className={styles.sideImageWrap}>
        <img src={storeImageUrl} alt={restaurantName} />
      </div>
      <div className={styles.sideIntro}>
        <h1>立即訂位</h1>
        <p>預訂您的美好用餐時光</p>
      </div>
      <div className={styles.sideFeatureList}>
        <div className={styles.sideFeature}>
          <span><FaRegCalendarAlt /></span>
          <div>
            <strong>快速預訂</strong>
            <small>輕鬆選擇日期與時間</small>
          </div>
        </div>
        <div className={styles.sideFeature}>
          <span><FaCheckCircle /></span>
          <div>
            <strong>即時確認</strong>
            <small>訂位完成後立即通知</small>
          </div>
        </div>
        <div className={styles.sideFeature}>
          <span><FaShieldAlt /></span>
          <div>
            <strong>安心保障</strong>
            <small>我們為您的用餐體驗把關</small>
          </div>
        </div>
      </div>
    </aside>
  );

  const renderSelectionStep = () => (
    <div className={styles.selectionStep}>
      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>
          <FaCalendarAlt />
          用餐日期與時間
        </h2>
        <div className={styles.dateGrid}>
          <label className={styles.inputShell}>
            <FaRegCalendarAlt />
            <input
              type="date"
              value={reservationData.date}
              onChange={(event) => handleDateSelect(event.target.value)}
              min={dateRange.min}
              max={dateRange.max}
              aria-label="用餐日期"
            />
          </label>
        </div>

        <div className={styles.timeSlotSection}>
          <h3 className={styles.subsectionTitle}>
            <FaClock />
            訂位時段
          </h3>
          {!reservationData.date && (
            <p className={styles.formHint}>請先選擇用餐日期。</p>
          )}
          {reservationData.date && loading && (
            <div className={styles.timeSlotHint}>時段讀取中...</div>
          )}
          {reservationData.date && !loading && availableTimeSlots.length > 0 && (
            <div className={styles.timeSlotGrid}>
              {availableTimeSlots.map((slot) => {
                const isSelected = String(reservationData.selectedSlotId) === String(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    className={`${styles.timeSlotCard} ${isSelected ? styles.timeSlotCardSelected : ''}`}
                    disabled={!slot.available}
                    onClick={() => handleTimeSlotSelect(slot)}
                  >
                    <strong>{slot.time}</strong>
                    <span>單筆限 {slot.max_party_size} 人</span>
                    <small className={slot.available ? styles.slotAvailable : styles.slotFull}>
                      {slot.available ? `可訂 (${slot.remaining_capacity} 位)` : '已額滿'}
                    </small>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className={styles.formHint}>可預約今日後 90 天內的時段</p>
        {error && <p className={styles.inlineError}>{error}</p>}
      </section>

      <section className={styles.formCard}>
        <h2 className={styles.sectionTitle}>
          <FaUsers />
          用餐人數
        </h2>
        <div className={styles.fieldGrid}>
          <label className={styles.selectField}>
            <span>大人</span>
            <select
              value={reservationData.partySize}
              onChange={(event) => setReservationData((prev) => ({
                ...prev,
                partySize: parseInt(event.target.value, 10),
              }))}
            >
              {availableAdultOptions.map((count) => (
                <option key={count} value={count}>{count} 位大人</option>
              ))}
            </select>
          </label>
          <label className={styles.selectField}>
            <span>小孩（0-12 歲）</span>
            <select
              value={reservationData.childrenCount}
              onChange={(event) => setReservationData((prev) => ({
                ...prev,
                childrenCount: parseInt(event.target.value, 10),
              }))}
            >
              {availableChildrenOptions.map((count) => (
                <option key={count} value={count}>{count} 位小孩</option>
              ))}
            </select>
          </label>
        </div>
        <p className={styles.formHint}>大人 + 小孩總人數不得超過餐廳可容納上限</p>
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.summaryStore}>
          <img src={storeImageUrl} alt={restaurantName} />
          <div>
            <strong>{restaurantName}</strong>
            <span><FaMapMarkerAlt />{restaurantAddress}</span>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryInfo}>
          <strong>用餐資訊</strong>
          <span><FaClock />{formatDate(reservationData.date)} {reservationData.timeSlot || '尚未選擇時間'}</span>
          <span><FaUsers />{reservationData.partySize} 位大人 · {reservationData.childrenCount} 位小孩</span>
        </div>
        <button className={styles.primaryAction} type="button" onClick={handleNextStep}>
          下一步
          <FaArrowRight />
        </button>
      </section>
    </div>
  );

  const renderGuestFields = () => (
    <div className={styles.detailForm}>
      <div className={styles.formRow}>
        <label className={styles.detailField}>
          <span>訂位姓名 *</span>
          <input
            type="text"
            name="name"
            value={reservationData.guestInfo.name}
            onChange={handleGuestInfoChange}
            placeholder="請輸入姓名"
            required
          />
        </label>
        <label className={styles.detailField}>
          <span>稱謂</span>
          <select
            name="gender"
            value={reservationData.guestInfo.gender}
            onChange={handleGuestInfoChange}
          >
            <option value="female">女士</option>
            <option value="male">先生</option>
            <option value="other">其他</option>
          </select>
        </label>
      </div>
      <div className={styles.formRow}>
        <label className={styles.detailField}>
          <span>聯絡電話 *</span>
          <input
            type="tel"
            name="phone"
            value={reservationData.guestInfo.phone}
            onChange={handleGuestInfoChange}
            placeholder="0912-345-678"
            required
          />
        </label>
        <label className={styles.detailField}>
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={reservationData.guestInfo.email}
            onChange={handleGuestInfoChange}
            placeholder="example@email.com"
          />
        </label>
      </div>
    </div>
  );

  const renderDetailStep = () => (
    <section className={styles.flowCard}>
      <div className={styles.flowHeader}>
        <h2>確認訂位內容</h2>
        <p>確認用餐資訊，必要時留下備註給餐廳。</p>
      </div>

      <div className={styles.confirmGrid}>
        <div>
          <span>餐廳</span>
          <strong>{restaurantName}</strong>
        </div>
        <div>
          <span>用餐日期</span>
          <strong>{formatDate(reservationData.date)}</strong>
        </div>
        <div>
          <span>用餐時間</span>
          <strong>{reservationData.timeSlot}</strong>
        </div>
        <div>
          <span>用餐人數</span>
          <strong>{reservationData.partySize} 位大人 · {reservationData.childrenCount} 位小孩</strong>
        </div>
      </div>

      {!user && renderGuestFields()}

      <label className={styles.detailField}>
        <span>特殊需求</span>
        <textarea
          value={reservationData.specialRequests}
          onChange={(event) => setReservationData((prev) => ({
            ...prev,
            specialRequests: event.target.value,
          }))}
          placeholder="例如兒童椅、靠窗座位、飲食禁忌等"
          rows="5"
        />
      </label>

      <div className={styles.actionRow}>
        <button className={styles.secondaryAction} type="button" onClick={handlePreviousStep}>
          <FaArrowLeft />
          上一步
        </button>
        <button className={styles.primaryAction} type="button" onClick={handleNextStep}>
          下一步
          <FaArrowRight />
        </button>
      </div>
    </section>
  );

  const renderConfirmationStep = () => (
    <section className={styles.flowCard}>
      <div className={styles.flowHeader}>
        <h2>送出訂位</h2>
        <p>請再次確認以下資訊，送出後餐廳將收到您的訂位。</p>
      </div>

      <div className={styles.confirmationCard}>
        <h3><FaCheckCircle /> 訂位明細</h3>
        <div className={styles.infoRow}>
          <span>餐廳</span>
          <strong>{restaurantName}</strong>
        </div>
        <div className={styles.infoRow}>
          <span>地址</span>
          <strong>{restaurantAddress}</strong>
        </div>
        <div className={styles.infoRow}>
          <span>日期</span>
          <strong>{formatDate(reservationData.date)}</strong>
        </div>
        <div className={styles.infoRow}>
          <span>時間</span>
          <strong>{reservationData.timeSlot}</strong>
        </div>
        <div className={styles.infoRow}>
          <span>人數</span>
          <strong>{reservationData.partySize} 位大人 · {reservationData.childrenCount} 位小孩</strong>
        </div>
        <div className={styles.infoRow}>
          <span>聯絡人</span>
          <strong>{user ? getUserDisplayName(user) : reservationData.guestInfo.name}</strong>
        </div>
        {reservationData.specialRequests && (
          <div className={styles.infoRow}>
            <span>備註</span>
            <strong>{reservationData.specialRequests}</strong>
          </div>
        )}
      </div>

      <div className={styles.actionRow}>
        <button className={styles.secondaryAction} type="button" onClick={handlePreviousStep}>
          <FaArrowLeft />
          上一步
        </button>
        <button
          className={styles.primaryAction}
          type="button"
          onClick={handleSubmitReservation}
          disabled={loading}
        >
          <FaCheckCircle />
          {loading ? '送出中' : '確認訂位'}
        </button>
      </div>
    </section>
  );

  return (
    <div className={styles.reservationPage}>
      <div className={styles.bookingShell}>
        {renderSidebar()}
        <main className={styles.bookingMain}>
          {renderStepper()}
          <div className={styles.stepStage}>
            {currentStep === 1 && renderSelectionStep()}
            {currentStep === 2 && renderDetailStep()}
            {currentStep === 3 && renderConfirmationStep()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReservationPage;
