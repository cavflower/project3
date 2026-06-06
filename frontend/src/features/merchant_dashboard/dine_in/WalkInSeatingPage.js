import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiRefreshCw, FiUserPlus, FiXCircle } from 'react-icons/fi';
import {
  assignWalkInSeating,
  createWalkInSeating,
  getWalkInSeatingOverview,
  releaseWalkInSeating,
} from '../../../api/reservationApi';
import { normalizeDineInLayout } from '../../../utils/dineInLayout';
import styles from './WalkInSeatingPage.module.css';

const getTodayString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const parseDateString = (dateString) => {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getCalendarDays = (monthString) => {
  const [year, month] = monthString.split('-').map(Number);
  const firstDate = new Date(year, month - 1, 1);
  const startOffset = firstDate.getDay();
  const startDate = new Date(year, month - 1, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return {
      value: formatDateString(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1,
    };
  });
};

const isPastDateString = (dateString) => dateString < getTodayString();

const splitTableLabels = (tableLabel) => (
  String(tableLabel || '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
);

const getTableClass = (shape) => {
  if (shape === 'square') return styles.tableSquare;
  if (shape === 'circle') return styles.tableCircle;
  return styles.tableRectangle;
};

const WalkInSeatingPage = () => {
  const autoRefreshKeyRef = useRef('');
  const [floors, setFloors] = useState([]);
  const [activeFloorId, setActiveFloorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthString(parseDateString(getTodayString())));
  const [selectedWaitingId, setSelectedWaitingId] = useState(null);
  const [selectedTableLabels, setSelectedTableLabels] = useState([]);
  const [selectedActiveSeating, setSelectedActiveSeating] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [walkIns, setWalkIns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    party_size: 2,
    notes: '',
  });

  const activeFloor = useMemo(
    () => floors.find((floor) => floor.id === activeFloorId) || floors[0] || null,
    [floors, activeFloorId]
  );

  const waitingList = useMemo(
    () => walkIns.filter((seating) => seating.status === 'waiting'),
    [walkIns]
  );

  const activeSeatings = useMemo(
    () => walkIns.filter((seating) => seating.status === 'active'),
    [walkIns]
  );

  const selectedWaiting = useMemo(
    () => waitingList.find((seating) => seating.id === selectedWaitingId) || null,
    [selectedWaitingId, waitingList]
  );

  const reservationMap = useMemo(() => {
    const map = new Map();
    reservations
      .filter((reservation) => ['pending', 'confirmed'].includes(reservation.status))
      .forEach((reservation) => {
        splitTableLabels(reservation.table_label).forEach((label) => {
          if (!map.has(label)) map.set(label, []);
          map.get(label).push(reservation);
        });
      });
    return map;
  }, [reservations]);

  const walkInMap = useMemo(() => {
    const map = new Map();
    activeSeatings.forEach((seating) => {
      splitTableLabels(seating.table_label).forEach((label) => {
        map.set(label, seating);
      });
    });
    return map;
  }, [activeSeatings]);

  const selectedReservations = useMemo(() => {
    return selectedTableLabels.flatMap((label) => reservationMap.get(label) || []);
  }, [reservationMap, selectedTableLabels]);

  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  const calendarTitle = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    return `${year} 年 ${month} 月`;
  }, [calendarMonth]);

  const changeSelectedDate = (dateString) => {
    if (isPastDateString(dateString)) return;
    setSelectedDate(dateString);
    setCalendarMonth(getMonthString(parseDateString(dateString)));
    setSelectedWaitingId(null);
    setSelectedTableLabels([]);
    setSelectedActiveSeating(null);
  };

  const moveCalendarMonth = (direction) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const nextMonth = new Date(year, month - 1 + direction, 1);
    setCalendarMonth(getMonthString(nextMonth));
  };

  const loadOverview = useCallback(async () => {
    const response = await getWalkInSeatingOverview({ date: selectedDate, status: 'all' });
    const normalized = normalizeDineInLayout(response.data.layout);
    const usableFloors = normalized.floors.map((floor) => ({
      ...floor,
      tables: (floor.tables || []).filter((table) => String(table.label || '').trim()),
    }));

    setFloors(usableFloors);
    setActiveFloorId(normalized.activeFloorId || usableFloors[0]?.id || '');
    setReservations(response.data.reservations || []);
    setWalkIns(response.data.walk_ins || []);
  }, [selectedDate]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setMessage('');
    try {
      await loadOverview();
    } catch (error) {
      console.error('Failed to load seating data:', error);
      setMessage('讀取現場桌位資料失敗，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    const autoRefreshKey = selectedDate;
    if (autoRefreshKeyRef.current === autoRefreshKey) return;
    autoRefreshKeyRef.current = autoRefreshKey;
    refreshAll();
  }, [refreshAll, selectedDate]);

  const resetForm = () => {
    setForm({
      party_size: 2,
      notes: '',
    });
  };

  const handleCreateWaiting = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await createWalkInSeating({
        party_size: Number(form.party_size) || 1,
        notes: form.notes,
      });
      resetForm();
      await loadOverview();
      setSelectedWaitingId(response.data.id);
      setSelectedTableLabels([]);
      setSelectedActiveSeating(null);
      setMessage(`已建立候位號碼 ${response.data.waiting_number}`);
    } catch (error) {
      console.error('Failed to create waiting party:', error);
      const apiMessage = error.response?.data?.party_size?.[0] || error.response?.data?.detail;
      setMessage(apiMessage || '建立候位號碼失敗，請確認人數後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWaitingClick = (seating) => {
    setSelectedWaitingId(seating.id);
    setSelectedTableLabels([]);
    setSelectedActiveSeating(null);
    setMessage(`已選擇候位 ${seating.waiting_number}，請在桌位圖上選擇一張或多張桌。`);
  };

  const handleTableClick = (table) => {
    const label = String(table.label || '').trim();
    if (!label) return;

    const occupiedSeating = walkInMap.get(label);
    if (occupiedSeating && occupiedSeating.id !== selectedWaitingId) {
      setSelectedActiveSeating(occupiedSeating);
      setSelectedWaitingId(null);
      setSelectedTableLabels(splitTableLabels(occupiedSeating.table_label));
      setMessage('');
      return;
    }

    if (!selectedWaiting) {
      setMessage('請先選擇等候區的候位號碼，再點選要安排的桌位。');
      return;
    }

    setSelectedActiveSeating(null);
    setSelectedTableLabels((prev) => (
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    ));
  };

  const handleAssignSelectedWaiting = async () => {
    if (!selectedWaiting || selectedTableLabels.length === 0) return;
    setIsSaving(true);
    try {
      await assignWalkInSeating(selectedWaiting.id, selectedTableLabels);
      await loadOverview();
      setMessage(`候位 ${selectedWaiting.waiting_number} 已安排入座。`);
      setSelectedWaitingId(null);
      setSelectedTableLabels([]);
    } catch (error) {
      console.error('Failed to assign waiting party:', error);
      const apiMessage = error.response?.data?.table_labels?.[0] || error.response?.data?.detail;
      setMessage(apiMessage || '安排桌位失敗，請確認桌位是否已被佔用。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelWaiting = async () => {
    if (!selectedWaiting) return;
    if (!window.confirm(`確定取消候位 ${selectedWaiting.waiting_number}？`)) return;

    setIsSaving(true);
    try {
      await releaseWalkInSeating(selectedWaiting.id);
      await loadOverview();
      setMessage(`候位 ${selectedWaiting.waiting_number} 已取消。`);
      setSelectedWaitingId(null);
      setSelectedTableLabels([]);
    } catch (error) {
      console.error('Failed to cancel waiting party:', error);
      setMessage('取消候位失敗，請稍後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintWaitingNumber = () => {
    if (!selectedWaiting) return;

    window.setTimeout(() => {
      window.alert(`候位 ${selectedWaiting.waiting_number}，${selectedWaiting.party_size} 人。`);
    }, 2000);
  };

  const handleReleaseWalkIn = async () => {
    if (!selectedActiveSeating) return;
    if (!window.confirm(`確定釋放 ${selectedActiveSeating.table_label}？`)) return;

    setIsSaving(true);
    try {
      await releaseWalkInSeating(selectedActiveSeating.id);
      await loadOverview();
      setMessage(`${selectedActiveSeating.table_label} 已釋放。`);
      setSelectedActiveSeating(null);
      setSelectedTableLabels([]);
    } catch (error) {
      console.error('Failed to release walk-in seating:', error);
      setMessage('釋放桌位失敗，請稍後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.panel}>
        <div>
          <h1>現場桌位安排</h1>
          <p>先建立候位號碼，再從等候區選取號碼並安排一張或多張桌。</p>
        </div>

        <label className={styles.fieldLabel}>
          <FiCalendar />
          查看日期
        </label>
        <section className={styles.calendarCard}>
          <div className={styles.calendarHeader}>
            <button type="button" className={styles.calendarNavButton} onClick={() => moveCalendarMonth(-1)} aria-label="上一個月">
              <FiChevronLeft />
            </button>
            <strong>{calendarTitle}</strong>
            <button type="button" className={styles.calendarNavButton} onClick={() => moveCalendarMonth(1)} aria-label="下一個月">
              <FiChevronRight />
            </button>
          </div>
          <div className={styles.calendarWeekdays}>
            {['日', '一', '二', '三', '四', '五', '六'].map((dayName) => (
              <span key={dayName}>{dayName}</span>
            ))}
          </div>
          <div className={styles.calendarGrid}>
            {calendarDays.map((day) => {
              const isSelected = day.value === selectedDate;
              const isToday = day.value === getTodayString();
              const isPastDate = isPastDateString(day.value);

              return (
                <button
                  key={day.value}
                  type="button"
                  className={[
                    styles.calendarDay,
                    day.isCurrentMonth ? '' : styles.calendarDayMuted,
                    isSelected ? styles.calendarDaySelected : '',
                    isToday ? styles.calendarDayToday : '',
                    isPastDate ? styles.calendarDayDisabled : '',
                  ].join(' ')}
                  onClick={() => changeSelectedDate(day.value)}
                  disabled={isPastDate}
                >
                  {day.day}
                </button>
              );
            })}
          </div>
          <div className={styles.calendarFooter}>
            <span>{selectedDate}</span>
            <button type="button" onClick={() => changeSelectedDate(getTodayString())}>今天</button>
          </div>
        </section>

        <section className={styles.floorSection}>
          <h2>樓層</h2>
          <div className={styles.floorTabs}>
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                className={activeFloor?.id === floor.id ? styles.floorTabActive : styles.floorTab}
                onClick={() => {
                  setActiveFloorId(floor.id);
                  setSelectedTableLabels([]);
                  setSelectedActiveSeating(null);
                }}
              >
                {floor.name}
              </button>
            ))}
          </div>
        </section>

        {message && <div className={styles.notice}>{message}</div>}

        <section className={styles.statusLegend}>
          <span><i className={styles.dotAvailable} />可安排</span>
          <span><i className={styles.dotReserved} />今日有訂位</span>
          <span><i className={styles.dotOccupied} />現場入座</span>
          <span><i className={styles.dotSelected} />本次選取</span>
        </section>

        <form className={styles.waitingForm} onSubmit={handleCreateWaiting}>
          <h2>新增候位</h2>
          <label>
            入桌人數
            <input
              type="number"
              min="1"
              value={form.party_size}
              onChange={(event) => setForm((prev) => ({ ...prev, party_size: event.target.value }))}
            />
          </label>
          <label>
            備註
            <textarea
              rows="3"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="例如：靠近出餐口、等朋友"
            />
          </label>
          <button type="submit" className={styles.assignButton} disabled={isSaving}>
            <FiUserPlus />
            產生候位號碼
          </button>
        </form>

      </aside>

      <main className={styles.mapArea}>
        <div className={styles.toolbar}>
          <div>
            <strong>{activeFloor?.name || '桌位圖'}</strong>
            <span>{selectedDate}</span>
          </div>
          <button type="button" onClick={refreshAll} disabled={isLoading}>
            <FiRefreshCw />
            重新整理
          </button>
        </div>

        <div className={styles.canvas}>
          {(activeFloor?.tables || []).map((table) => {
            const label = String(table.label || '').trim();
            const hasReservation = reservationMap.has(label);
            const occupiedSeating = walkInMap.get(label);
            const hasWalkIn = Boolean(occupiedSeating);
            const selected = selectedTableLabels.includes(label);

            return (
              <button
                key={table.id}
                type="button"
                className={[
                  getTableClass(table.shape),
                  hasReservation ? styles.tableReserved : '',
                  hasWalkIn ? styles.tableOccupied : '',
                  selected ? styles.tableSelected : '',
                ].join(' ')}
                style={{ left: table.x, top: table.y }}
                onClick={() => handleTableClick(table)}
              >
                <span>{label}</span>
                <small>
                  {hasWalkIn
                    ? `${occupiedSeating.waiting_number} · ${occupiedSeating.party_size} 人`
                    : hasReservation
                      ? '今日有訂位'
                      : `${table.seats} 人`}
                </small>
              </button>
            );
          })}

          {!isLoading && (activeFloor?.tables || []).length === 0 && (
            <div className={styles.emptyCanvas}>
              尚未設定桌位，請先到內用設定新增桌位。
            </div>
          )}
        </div>

        <section className={styles.waitingArea}>
          <div className={styles.sectionHeader}>
            <h2>等候區</h2>
            <span>{waitingList.length} 組</span>
          </div>
          {waitingList.length > 0 ? (
            <div className={styles.waitingList}>
              {waitingList.map((seating) => (
                <button
                  key={seating.id}
                  type="button"
                  className={selectedWaitingId === seating.id ? styles.waitingTicketActive : styles.waitingTicket}
                  onClick={() => handleWaitingClick(seating)}
                >
                  <strong>{seating.waiting_number}</strong>
                  <span>{seating.party_size} 人</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.emptyText}>目前沒有等候組別。</p>
          )}
        </section>

        {selectedWaiting && (
          <section className={styles.selectedCard}>
            <div className={styles.selectedHeader}>
              <div>
                <h2>候位 {selectedWaiting.waiting_number}</h2>
                <p>{selectedWaiting.party_size} 人</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setSelectedWaitingId(null)}>
                <FiXCircle />
              </button>
            </div>
            <div className={styles.tableSelectionSummary}>
              <strong>已選桌位</strong>
              <span>{selectedTableLabels.length ? selectedTableLabels.join(', ') : '尚未選擇'}</span>
            </div>
            {selectedReservations.length > 0 && (
              <div className={styles.reservationBox}>
                <strong>選取桌位今日訂位</strong>
                {selectedReservations.map((reservation) => (
                  <div key={reservation.id} className={styles.reservationItem}>
                    <span>{reservation.time_slot}</span>
                    <span>{reservation.customer_name}</span>
                    <small>{Number(reservation.party_size || 0) + Number(reservation.children_count || 0)} 人</small>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.assignButton}
                onClick={handleAssignSelectedWaiting}
                disabled={isSaving || selectedTableLabels.length === 0}
              >
                安排入座
              </button>
              <button
                type="button"
                className={styles.printButton}
                onClick={handlePrintWaitingNumber}
                disabled={isSaving}
              >
                印出號碼
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCancelWaiting}
                disabled={isSaving}
              >
                取消候位
              </button>
            </div>
          </section>
        )}

        {selectedActiveSeating && (
          <section className={styles.selectedCard}>
            <div className={styles.selectedHeader}>
              <div>
                <h2>候位 {selectedActiveSeating.waiting_number}</h2>
                <p>{selectedActiveSeating.party_size} 人 · {selectedActiveSeating.table_label}</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setSelectedActiveSeating(null)}>
                <FiXCircle />
              </button>
            </div>
            {selectedActiveSeating.notes && <p className={styles.emptyText}>{selectedActiveSeating.notes}</p>}
            <button type="button" className={styles.releaseButton} onClick={handleReleaseWalkIn} disabled={isSaving}>
              釋放桌位
            </button>
          </section>
        )}
      </main>
    </div>
  );
};

export default WalkInSeatingPage;
