import React, { useState } from 'react';
import ReservationCard from '../../../components/reservations/ReservationCard';
import styles from './ReservationManagementPage.module.css';

const ReservationList = ({ reservations, onAccept, onCancel, onComplete, onDelete }) => {
  const [activeStatusTab, setActiveStatusTab] = useState('all'); // 'all', 'pending', 'confirmed', 'completed', 'cancelled'
  const [sortBy, setSortBy] = useState('date'); // 'date', 'status', 'party_size'

  const filteredReservations = reservations.filter(reservation => {
    if (activeStatusTab === 'all') return true;
    return reservation.status === activeStatusTab;
  });

  const sortedReservations = [...filteredReservations].sort((a, b) => {
    if (sortBy === 'date') {
      // 支援 reservation_date (後端) 和 date (舊格式) 兩種欄位
      const dateA = a.reservation_date || a.date;
      const dateB = b.reservation_date || b.date;
      const timeA = a.time_slot?.split('-')[0] || '00:00';
      const timeB = b.time_slot?.split('-')[0] || '00:00';
      return new Date(dateA + ' ' + timeA) - new Date(dateB + ' ' + timeB);
    }
    if (sortBy === 'party_size') {
      return b.party_size - a.party_size;
    }
    return 0;
  });

  return (
    <div className={styles.reservationListContainer}>
      {/* 狀態分類導覽 */}
      <div className={styles.statusTabs}>
        <button
          className={activeStatusTab === 'all' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatusTab('all')}
        >
          全部
        </button>
        <button
          className={activeStatusTab === 'pending' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatusTab('pending')}
        >
          待確認
        </button>
        <button
          className={activeStatusTab === 'confirmed' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatusTab('confirmed')}
        >
          已確認
        </button>
        <button
          className={activeStatusTab === 'completed' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatusTab('completed')}
        >
          已完成
        </button>
        <button
          className={activeStatusTab === 'cancelled' ? styles.statusTabActive : styles.statusTab}
          onClick={() => setActiveStatusTab('cancelled')}
        >
          已取消
        </button>
      </div>

      <div className={styles.listControls}>
        <div className={styles.sortGroup}>
          <label>排序：</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date">訂位日期</option>
            <option value="party_size">人數</option>
          </select>
        </div>
      </div>

      {sortedReservations.length === 0 ? (
        <div className={styles.emptyState}>
          <p>目前沒有訂位記錄</p>
        </div>
      ) : (
        <div className={styles.reservationsGrid}>
          {sortedReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              viewMode="merchant"
              actions={{
                onAccept,
                onCancel,
                onComplete,
                onDelete,
              }}
              showActions={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReservationList;
