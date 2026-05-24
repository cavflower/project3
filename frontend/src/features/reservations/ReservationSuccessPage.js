import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaBell,
  FaCalendarAlt,
  FaCheck,
  FaClock,
  FaCopy,
  FaEnvelope,
  FaHome,
  FaInfoCircle,
  FaPen,
  FaRegCalendarPlus,
  FaTicketAlt,
  FaUsers,
  FaUtensils,
} from 'react-icons/fa';
import { useAuth } from '../../store/AuthContext';
import styles from './ReservationSuccessPage.module.css';

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

const getUserDisplayName = (user) => (
  user?.name ||
  user?.username ||
  (user?.email ? user.email.split('@')[0] : '') ||
  ''
);

const getStoredSuccessData = () => {
  try {
    const raw = sessionStorage.getItem('dineverse:lastReservationSuccess');
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Unable to read reservation success data:', error);
    return {};
  }
};

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDisplayDate = (value) => {
  if (!value) return '--';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}（${weekdayLabels[date.getDay()]}）`;
};

const buildCalendarDate = (dateValue, timeValue) => {
  if (!dateValue || !timeValue || timeValue === '--') return null;
  const startTime = timeValue.split('-')[0]?.trim() || timeValue.trim();
  const normalizedTime = /^\d{2}:\d{2}$/.test(startTime) ? startTime : '19:00';
  return new Date(`${dateValue}T${normalizedTime}:00`);
};

const ReservationSuccessPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const successData = useMemo(() => {
    const routeState = location.state || {};
    const storedState = getStoredSuccessData();
    const state = Object.keys(routeState).length > 0 ? routeState : storedState;
    const reservation = state.reservation || {};
    const partySize = toOptionalNumber(state.partySize ?? reservation.party_size);
    const childrenCount = toOptionalNumber(state.childrenCount ?? reservation.children_count);

    return {
      reservationNumber: state.reservationNumber || reservation.reservation_number || '--',
      isGuest: state.isGuest ?? !user,
      storeName: state.storeName || reservation.store_name || '未提供餐廳',
      storeAddress: state.storeAddress || reservation.store_address || '未提供地址',
      reservationDate: state.reservationDate || reservation.reservation_date || '',
      timeSlot: state.timeSlot || reservation.time_slot || '--',
      partySize,
      childrenCount: childrenCount || 0,
      email: state.email || reservation.customer_email || user?.email || '',
      phone: state.phone || reservation.customer_phone || user?.phone_number || '',
      contactName: reservation.customer_name || getUserDisplayName(user),
    };
  }, [location.state, user]);

  const contactMethod = successData.email
    ? { label: '電子郵件', value: successData.email }
    : { label: '聯絡電話', value: successData.phone || '--' };

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(successData.reservationNumber);
    } catch (error) {
      console.error('Copy reservation number failed:', error);
    }
  };

  const handleAddCalendar = () => {
    const start = buildCalendarDate(successData.reservationDate, successData.timeSlot);
    if (!start) return;

    const end = new Date(start.getTime() + 90 * 60 * 1000);
    const toIcsDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `UID:${successData.reservationNumber}@dineverse`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:DineVerse 訂位 - ${successData.storeName}`,
      `LOCATION:${successData.storeAddress}`,
      `DESCRIPTION:訂位編號 ${successData.reservationNumber}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${successData.reservationNumber}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const reservationRoute = successData.isGuest ? '/guest-lookup' : '/my-reservations';

  return (
    <div className={styles.reservationSuccessPage}>
      <section className={styles.successContainer}>
        <header className={styles.successHeader}>
          <div className={styles.successMark} aria-hidden="true">
            <FaCheck />
          </div>
          <div>
            <h1>訂位成功！</h1>
            <p>我們已收到您的訂位申請，將透過您選擇的聯絡方式發送確認通知。</p>
          </div>
        </header>

        <div className={styles.numberCard}>
          <FaTicketAlt className={styles.ticketIcon} />
          <div className={styles.numberDivider} />
          <div className={styles.numberContent}>
            <span>訂位編號</span>
            <strong>{successData.reservationNumber}</strong>
          </div>
          <button type="button" className={styles.copyButton} onClick={handleCopyNumber} aria-label="複製訂位編號">
            <FaCopy />
          </button>
        </div>

        <section className={styles.infoSection}>
          <h2>訂位資訊</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <FaUtensils />
              <div>
                <span>餐廳名稱</span>
                <strong>{successData.storeName}</strong>
                <small>{successData.storeAddress}</small>
              </div>
            </div>
            <div className={styles.infoItem}>
              <FaCalendarAlt />
              <div>
                <span>訂位日期</span>
                <strong>{formatDisplayDate(successData.reservationDate)}</strong>
              </div>
            </div>
            <div className={styles.infoItem}>
              <FaClock />
              <div>
                <span>訂位時間</span>
                <strong>{successData.timeSlot}</strong>
              </div>
            </div>
            <div className={styles.infoItem}>
              <FaUsers />
              <div>
                <span>用餐人數</span>
                <strong>{successData.partySize === null ? '--' : `${successData.partySize} 位大人`}</strong>
                {successData.childrenCount > 0 && <small>{successData.childrenCount} 位小孩</small>}
              </div>
            </div>
            <div className={styles.infoItem}>
              <FaEnvelope />
              <div>
                <span>聯絡方式</span>
                <strong>{contactMethod.label}</strong>
                <small>{contactMethod.value}</small>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.nextSection}>
          <h2>接下來您可以</h2>
          <div className={styles.nextGrid}>
            <article>
              <FaCalendarAlt />
              <div>
                <strong>查看訂位</strong>
                <span>查看訂位詳情與狀態</span>
              </div>
            </article>
            <article>
              <FaPen />
              <div>
                <strong>修改／取消訂位</strong>
                <span>如需調整，請於規定時間內操作</span>
              </div>
            </article>
            <article>
              <FaBell />
              <div>
                <strong>留意確認通知</strong>
                <span>我們將發送確認資訊至您的聯絡方式</span>
              </div>
            </article>
          </div>
        </section>

        <div className={styles.actionGrid}>
          <button type="button" className={styles.primaryButton} onClick={() => navigate(reservationRoute)}>
            <FaCalendarAlt />
            查看我的訂位
          </button>
          <button type="button" className={styles.outlineButton} onClick={handleAddCalendar}>
            <FaRegCalendarPlus />
            加入行事曆
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => navigate('/')}>
            <FaHome />
            返回首頁
          </button>
        </div>

        <p className={styles.noticeText}>
          <FaInfoCircle />
          如需修改或取消訂位，請於餐廳規定時間內操作，逾時恕無法受理，謝謝您的理解與配合。
        </p>
      </section>
    </div>
  );
};

export default ReservationSuccessPage;
