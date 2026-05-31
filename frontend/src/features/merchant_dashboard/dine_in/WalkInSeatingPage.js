import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiRefreshCw, FiUserPlus, FiUsers, FiXCircle } from 'react-icons/fi';
import { getMyStore, getDineInLayout } from '../../../api/storeApi';
import {
  createWalkInSeating,
  getMerchantReservations,
  getWalkInSeatings,
  releaseWalkInSeating,
} from '../../../api/reservationApi';
import { normalizeDineInLayout } from '../../../utils/dineInLayout';
import styles from './WalkInSeatingPage.module.css';

const getTodayString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const getTableClass = (shape) => {
  if (shape === 'square') return styles.tableSquare;
  if (shape === 'circle') return styles.tableCircle;
  return styles.tableRectangle;
};

const formatReservationSummary = (reservation) => {
  const total = Number(reservation.party_size || 0) + Number(reservation.children_count || 0);
  return `${reservation.time_slot} ${reservation.customer_name || '未命名'} ${total || reservation.party_size}人`;
};

const WalkInSeatingPage = () => {
  const [storeId, setStoreId] = useState(null);
  const [floors, setFloors] = useState([]);
  const [activeFloorId, setActiveFloorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedTable, setSelectedTable] = useState(null);
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

  const reservationMap = useMemo(() => {
    const map = new Map();
    reservations
      .filter((reservation) => ['pending', 'confirmed'].includes(reservation.status))
      .forEach((reservation) => {
        const label = String(reservation.table_label || '').trim();
        if (!label) return;
        if (!map.has(label)) map.set(label, []);
        map.get(label).push(reservation);
      });

    map.forEach((items) => {
      items.sort((a, b) => String(a.time_slot || '').localeCompare(String(b.time_slot || '')));
    });

    return map;
  }, [reservations]);

  const walkInMap = useMemo(() => {
    const map = new Map();
    walkIns
      .filter((seating) => seating.status === 'active')
      .forEach((seating) => {
        map.set(String(seating.table_label || '').trim(), seating);
      });
    return map;
  }, [walkIns]);

  const selectedReservations = useMemo(() => {
    if (!selectedTable?.label) return [];
    return reservationMap.get(selectedTable.label) || [];
  }, [reservationMap, selectedTable]);

  const selectedWalkIn = useMemo(() => {
    if (!selectedTable?.label) return null;
    return walkInMap.get(selectedTable.label) || null;
  }, [selectedTable, walkInMap]);

  const loadLayout = useCallback(async () => {
    const storeResponse = await getMyStore({ lite: 1 });
    const nextStoreId = storeResponse.data?.id || null;
    setStoreId(nextStoreId);

    if (!nextStoreId) {
      setFloors([]);
      setActiveFloorId('');
      return null;
    }

    const layoutResponse = await getDineInLayout(nextStoreId);
    const normalized = normalizeDineInLayout(layoutResponse.data);
    const usableFloors = normalized.floors.map((floor) => ({
      ...floor,
      tables: (floor.tables || []).filter((table) => String(table.label || '').trim()),
    }));

    setFloors(usableFloors);
    setActiveFloorId(normalized.activeFloorId || usableFloors[0]?.id || '');
    return nextStoreId;
  }, []);

  const loadOperationalData = useCallback(async () => {
    const [reservationResponse, walkInResponse] = await Promise.all([
      getMerchantReservations({ reservation_date: selectedDate }),
      getWalkInSeatings({ date: selectedDate, status: 'active' }),
    ]);

    setReservations(reservationResponse.data.results || reservationResponse.data || []);
    setWalkIns(walkInResponse.data.results || walkInResponse.data || []);
  }, [selectedDate]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const nextStoreId = storeId || await loadLayout();
      if (nextStoreId) {
        await loadOperationalData();
      }
    } catch (error) {
      console.error('Failed to load seating data:', error);
      setMessage('讀取座位安排資料失敗，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  }, [loadLayout, loadOperationalData, storeId]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!storeId) return;
    loadOperationalData().catch((error) => {
      console.error('Failed to reload operational data:', error);
      setMessage('重新讀取當日資料失敗。');
    });
  }, [loadOperationalData, storeId]);

  const handleTableClick = (table) => {
    const normalizedTable = {
      ...table,
      label: String(table.label || '').trim(),
    };
    const tableReservations = reservationMap.get(normalizedTable.label) || [];
    setSelectedTable(normalizedTable);

    if (tableReservations.length > 0) {
      setMessage(`${normalizedTable.label} 今日已有訂位：${tableReservations.map(formatReservationSummary).join('、')}`);
    } else {
      setMessage('');
    }
  };

  const resetForm = () => {
    setForm({
      party_size: 2,
      notes: '',
    });
  };

  const handleAssignWalkIn = async (event) => {
    event.preventDefault();
    if (!selectedTable || selectedWalkIn) return;

    setIsSaving(true);
    try {
      await createWalkInSeating({
        table_label: selectedTable.label,
        party_size: Number(form.party_size) || 1,
        notes: form.notes,
      });
      resetForm();
      await loadOperationalData();
      setMessage(`${selectedTable.label} 已安排現場客人入座。`);
    } catch (error) {
      console.error('Failed to assign walk-in seating:', error);
      const apiMessage = error.response?.data?.table_label?.[0] || error.response?.data?.detail;
      setMessage(apiMessage || '安排入座失敗，請確認座位是否已被占用。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReleaseWalkIn = async () => {
    if (!selectedWalkIn) return;
    if (!window.confirm(`確認釋放 ${selectedWalkIn.table_label}？`)) return;

    setIsSaving(true);
    try {
      await releaseWalkInSeating(selectedWalkIn.id);
      await loadOperationalData();
      setMessage(`${selectedWalkIn.table_label} 已釋放。`);
    } catch (error) {
      console.error('Failed to release walk-in seating:', error);
      setMessage('釋放座位失敗，請稍後再試。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.panel}>
        <div>
          <h1>現場座位安排</h1>
          <p>安排臨時到店客人入座，並查看今天該桌的訂位時段。</p>
        </div>

        <label className={styles.fieldLabel}>
          <FiCalendar />
          查看日期
        </label>
        <input
          className={styles.dateInput}
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
        />

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
                  setSelectedTable(null);
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
        </section>

        {selectedTable ? (
          <section className={styles.selectedCard}>
            <div className={styles.selectedHeader}>
              <div>
                <h2>{selectedTable.label}</h2>
                <p>{selectedTable.seats || 0} 人桌</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setSelectedTable(null)}>
                <FiXCircle />
              </button>
            </div>

            {selectedReservations.length > 0 && (
              <div className={styles.reservationBox}>
                <strong>今日訂位提醒</strong>
                {selectedReservations.map((reservation) => (
                  <div key={reservation.id} className={styles.reservationItem}>
                    <span>{reservation.time_slot}</span>
                    <span>{reservation.customer_name}</span>
                    <small>{Number(reservation.party_size || 0) + Number(reservation.children_count || 0)} 人</small>
                  </div>
                ))}
              </div>
            )}

            {selectedWalkIn ? (
              <div className={styles.walkInBox}>
                <strong>目前現場入座</strong>
                <p>{selectedWalkIn.party_size} 人</p>
                {selectedWalkIn.notes && <small>{selectedWalkIn.notes}</small>}
                <button type="button" className={styles.releaseButton} onClick={handleReleaseWalkIn} disabled={isSaving}>
                  釋放座位
                </button>
              </div>
            ) : (
              <form className={styles.assignForm} onSubmit={handleAssignWalkIn}>
                <label>
                  人數
                  <input
                    type="number"
                    min="1"
                    max={selectedTable.seats || 20}
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
                  安排入座
                </button>
              </form>
            )}
          </section>
        ) : (
          <div className={styles.emptyHint}>
            <FiUsers />
            <span>點選右側座位來安排現場客人。</span>
          </div>
        )}
      </aside>

      <main className={styles.mapArea}>
        <div className={styles.toolbar}>
          <div>
            <strong>{activeFloor?.name || '座位圖'}</strong>
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
            const hasWalkIn = walkInMap.has(label);
            const selected = selectedTable?.id === table.id;

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
                <small>{hasWalkIn ? '現場入座' : hasReservation ? '今日訂位' : `${table.seats} 人`}</small>
              </button>
            );
          })}

          {!isLoading && (activeFloor?.tables || []).length === 0 && (
            <div className={styles.emptyCanvas}>
              尚未設定座位圖，請先到內用設定新增桌位。
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default WalkInSeatingPage;
