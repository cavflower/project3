import React, { useRef, useState } from 'react';
import { FaCalendarAlt, FaTimes } from 'react-icons/fa';
import ReservationCard from '../../../components/reservations/ReservationCard';

const formatDateLabel = (dateValue) => {
  if (!dateValue) return '選擇日期';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

const ReservationList = ({
  reservations,
  selectedDate = '',
  onDateChange,
  onAccept,
  onCancel,
  onComplete,
  onDelete,
}) => {
  const [activeStatusTab, setActiveStatusTab] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const dateInputRef = useRef(null);

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  const filteredReservations = reservations.filter((reservation) => {
    if (activeStatusTab === 'all') return true;
    return reservation.status === activeStatusTab;
  });

  const sortedReservations = [...filteredReservations].sort((a, b) => {
    if (sortBy === 'date_desc') {
      const dateA = a.reservation_date || a.date;
      const dateB = b.reservation_date || b.date;
      const timeA = a.time_slot?.split('-')[0] || '00:00';
      const timeB = b.time_slot?.split('-')[0] || '00:00';
      return new Date(`${dateB}T${timeB}`) - new Date(`${dateA}T${timeA}`);
    }

    if (sortBy === 'party_size') {
      return b.party_size - a.party_size;
    }

    return 0;
  });

  return (
    <div className="reservation-list-container">
      <div className="status-tabs">
        <button
          className={`status-tab ${activeStatusTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveStatusTab('all')}
        >
          全部
        </button>
        <button
          className={`status-tab ${activeStatusTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveStatusTab('pending')}
        >
          待確認
        </button>
        <button
          className={`status-tab ${activeStatusTab === 'confirmed' ? 'active' : ''}`}
          onClick={() => setActiveStatusTab('confirmed')}
        >
          已確認
        </button>
        <button
          className={`status-tab ${activeStatusTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveStatusTab('completed')}
        >
          已完成
        </button>
        <button
          className={`status-tab ${activeStatusTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveStatusTab('cancelled')}
        >
          已取消
        </button>
      </div>

      <div className="list-controls">
        <div className="date-filter-group">
          <button
            type="button"
            className={`date-picker-button ${selectedDate ? 'active' : ''}`}
            onClick={openDatePicker}
          >
            <FaCalendarAlt />
            <span>{formatDateLabel(selectedDate)}</span>
          </button>
          <input
            ref={dateInputRef}
            className="date-picker-native"
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange?.(e.target.value)}
            aria-label="選擇訂位日期"
          />
          {selectedDate && (
            <button
              type="button"
              className="date-clear-button"
              onClick={() => onDateChange?.('')}
              aria-label="清除日期篩選"
            >
              <FaTimes />
            </button>
          )}
        </div>

        <div className="sort-group">
          <label>排序：</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date_desc">訂位日期（新到舊）</option>
            <option value="party_size">人數</option>
          </select>
        </div>
      </div>

      {sortedReservations.length === 0 ? (
        <div className="empty-state">
          <p>目前沒有訂位記錄</p>
        </div>
      ) : (
        <div className="reservations-grid">
          {sortedReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              viewMode="merchant"
              actions={{
                onAccept: () => onAccept(reservation),
                onEditTable: () => onAccept(reservation),
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
