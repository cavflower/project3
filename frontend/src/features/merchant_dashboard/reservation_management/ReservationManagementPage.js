import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { FaClock, FaUsers, FaCalendarAlt, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import TimeSlotSettings from './TimeSlotSettings';
import ReservationList from './ReservationList';
import styles from './ReservationManagementPage.module.css';
import { getMyStore, getDineInLayout } from '../../../api/storeApi';
import { normalizeDineInLayout } from '../../../utils/dineInLayout';
import { db } from '../../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  getMerchantReservations,
  updateReservationStatus,
  merchantCancelReservation,
  deleteReservation,
  getTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot
} from '../../../api/reservationApi';

const TABLE_MAP_MIN_ZOOM = 0.6;
const TABLE_MAP_MAX_ZOOM = 1.8;
const TABLE_MAP_ZOOM_STEP = 0.2;

const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  if (Array.isArray(data.table_label) && data.table_label.length > 0) return data.table_label[0];
  if (data.table_label) return String(data.table_label);
  return fallback;
};

const ReservationManagementPage = () => {
  const [activeTab, setActiveTab] = useState('reservations'); // 'reservations' or 'settings'
  const [reservations, setReservations] = useState([]);
  const [selectedReservationDate, setSelectedReservationDate] = useState('');
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
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [selectedAcceptReservation, setSelectedAcceptReservation] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [tableFloors, setTableFloors] = useState([]);
  const [activeTableFloorId, setActiveTableFloorId] = useState('');
  const [acceptForm, setAcceptForm] = useState({
    tableLabel: '',
    merchantNote: '',
  });
  const [isPanningTableMap, setIsPanningTableMap] = useState(false);
  const [tableMapPanStart, setTableMapPanStart] = useState({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [tableMapZoom, setTableMapZoom] = useState(1);
  const tableMapViewportRef = useRef(null);
  const realtimeRefreshTimerRef = useRef(null);

  const activeTableFloor = useMemo(
    () => tableFloors.find((floor) => floor.id === activeTableFloorId) || tableFloors[0] || null,
    [tableFloors, activeTableFloorId]
  );

  const tableMapSize = useMemo(() => {
    const tables = activeTableFloor?.tables || [];

    if (tables.length === 0) {
      return { width: 720, height: 420 };
    }

    let maxX = 0;
    let maxY = 0;

    tables.forEach((table) => {
      const width = table.shape === 'rectangle' ? 120 : 80;
      const height = table.shape === 'rectangle' ? 72 : 80;
      const right = (table.x || 0) + width;
      const bottom = (table.y || 0) + height;

      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    });

    return {
      width: Math.max(720, maxX + 80),
      height: Math.max(420, maxY + 80),
    };
  }, [activeTableFloor]);

  const occupiedTableLabels = useMemo(() => {
    if (!selectedAcceptReservation) {
      return new Set();
    }

    return new Set(
      reservations
        .filter((reservation) => (
          reservation.id !== selectedAcceptReservation.id
          && reservation.reservation_date === selectedAcceptReservation.reservation_date
          && reservation.time_slot === selectedAcceptReservation.time_slot
          && ['pending', 'confirmed'].includes(reservation.status)
          && String(reservation.table_label || '').trim()
        ))
        .map((reservation) => String(reservation.table_label || '').trim())
    );
  }, [reservations, selectedAcceptReservation]);

  const isEditingConfirmedReservation = selectedAcceptReservation?.status === 'confirmed';

  useEffect(() => {
    if (!isPanningTableMap) return;

    const stopPanning = () => {
      setIsPanningTableMap(false);
    };

    window.addEventListener('mouseup', stopPanning);
    return () => {
      window.removeEventListener('mouseup', stopPanning);
    };
  }, [isPanningTableMap]);

  useEffect(() => {
    fetchTimeSlots();
    fetchConfiguredTables();
  }, []);

  const updateStats = useCallback((reservationList) => {
    const newStats = {
      pending: reservationList.filter(r => r.status === 'pending').length,
      confirmed: reservationList.filter(r => r.status === 'confirmed').length,
      cancelled: reservationList.filter(r => r.status === 'cancelled').length,
      completed: reservationList.filter(r => r.status === 'completed').length,
    };
    setStats(newStats);
  }, []);

  const fetchReservations = useCallback(async ({ silent = false } = {}) => {
    try {
      const filters = selectedReservationDate
        ? { reservation_date: selectedReservationDate }
        : {};
      const response = await getMerchantReservations(filters);
      const reservationData = response.data.results || response.data;
      setReservations(reservationData);
      updateStats(reservationData);
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
      if (!silent) {
        alert('無法載入訂位資料，請稍後再試。');
      }
    }
  }, [selectedReservationDate, updateStats]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const replaceReservationInState = useCallback((updatedReservation) => {
    setReservations((prevReservations) => {
      const nextReservations = prevReservations.map((reservation) => (
        reservation.id === updatedReservation.id ? updatedReservation : reservation
      ));
      updateStats(nextReservations);
      return nextReservations;
    });
  }, [updateStats]);

  const removeReservationFromState = useCallback((reservationId) => {
    setReservations((prevReservations) => {
      const nextReservations = prevReservations.filter((reservation) => reservation.id !== reservationId);
      updateStats(nextReservations);
      return nextReservations;
    });
  }, [updateStats]);

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

  const fetchConfiguredTables = async () => {
    try {
      const storeResponse = await getMyStore({ lite: 1 });
      const storeId = storeResponse.data?.id;
      setStoreId(storeId || null);
      if (!storeId) {
        setTableFloors([]);
        setActiveTableFloorId('');
        return;
      }

      const layoutResponse = await getDineInLayout(storeId);
      const normalizedLayout = normalizeDineInLayout(layoutResponse.data);
      const floorsWithTables = normalizedLayout.floors
        .map((floor) => ({
          ...floor,
          tables: (floor.tables || []).filter((table) => Boolean((table.label || '').trim())),
        }))
        .filter((floor) => floor.tables.length > 0);

      setTableFloors(floorsWithTables);
      setActiveTableFloorId(floorsWithTables[0]?.id || '');
    } catch (error) {
      console.error('Failed to fetch configured dine-in tables:', error);
      setTableFloors([]);
      setActiveTableFloorId('');
    }
  };

  const resetAcceptDialog = () => {
    setShowAcceptDialog(false);
    setSelectedAcceptReservation(null);
    setAcceptForm({ tableLabel: '', merchantNote: '' });
    setActiveTableFloorId(tableFloors[0]?.id || '');
    setIsPanningTableMap(false);
    setTableMapZoom(1);
  };

  const handleZoomOut = () => {
    setTableMapZoom((prev) => Math.max(TABLE_MAP_MIN_ZOOM, Number((prev - TABLE_MAP_ZOOM_STEP).toFixed(2))));
  };

  const handleZoomIn = () => {
    setTableMapZoom((prev) => Math.min(TABLE_MAP_MAX_ZOOM, Number((prev + TABLE_MAP_ZOOM_STEP).toFixed(2))));
  };

  const handleTableMapPointerDown = (e) => {
    if (e.button !== 0) return;

    // 桌位按鈕點擊時不啟動拖曳平移，避免影響選桌。
    if (e.target.closest('[data-table-pick="true"]')) {
      return;
    }

    const viewport = tableMapViewportRef.current;
    if (!viewport) return;

    setIsPanningTableMap(true);
    setTableMapPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    });
  };

  const handleTableMapPointerMove = (e) => {
    if (!isPanningTableMap) return;

    const viewport = tableMapViewportRef.current;
    if (!viewport) return;

    e.preventDefault();
    const deltaX = e.clientX - tableMapPanStart.x;
    const deltaY = e.clientY - tableMapPanStart.y;
    viewport.scrollLeft = tableMapPanStart.scrollLeft - deltaX;
    viewport.scrollTop = tableMapPanStart.scrollTop - deltaY;
  };

  const findFloorByTableLabel = (tableLabel) => {
    if (!tableLabel) return null;
    return tableFloors.find((floor) =>
      (floor.tables || []).some((table) => table.label === tableLabel)
    ) || null;
  };

  const handleAcceptClick = (reservation) => {
    const initialTableLabel = reservation.table_label || '';
    const selectedFloor = findFloorByTableLabel(initialTableLabel);

    setSelectedAcceptReservation(reservation);
    setAcceptForm({
      tableLabel: selectedFloor ? initialTableLabel : '',
      merchantNote: reservation.merchant_note || '',
    });
    setActiveTableFloorId(selectedFloor?.id || tableFloors[0]?.id || '');
    setShowAcceptDialog(true);
  };

  const handleAcceptReservation = async () => {
    if (!selectedAcceptReservation) return;

    const isEditingTable = selectedAcceptReservation.status === 'confirmed';

    try {
      const response = await updateReservationStatus(selectedAcceptReservation.id, {
        status: 'confirmed',
        table_label: acceptForm.tableLabel || '',
        merchant_note: acceptForm.merchantNote || '',
      });
      replaceReservationInState(response.data);

      resetAcceptDialog();
      alert(isEditingTable ? '桌位已更新！' : '訂位已確認！');
    } catch (error) {
      console.error(isEditingTable ? 'Failed to update reservation table:' : 'Failed to accept reservation:', error);
      const errorMsg = getApiErrorMessage(
        error,
        isEditingTable ? '更改桌位失敗，請稍後再試。' : '確認訂位失敗，請稍後再試。'
      );
      alert(errorMsg);
    }
  };

  useEffect(() => {
    if (!storeId) return undefined;

    let isInitialSnapshot = true;

    const scheduleRefresh = () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = setTimeout(() => {
        fetchReservations({ silent: true });
      }, 250);
    };

    const reservationsRef = collection(db, 'reservations');
    const reservationsQuery = query(reservationsRef, where('store_id', '==', storeId));

    const unsubscribe = onSnapshot(
      reservationsQuery,
      (snapshot) => {
        if (isInitialSnapshot) {
          isInitialSnapshot = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            scheduleRefresh();
            return;
          }

          if (change.type === 'modified') {
            const updatedReservation = change.doc.data();
            setReservations((prevReservations) => {
              let matched = false;
              const nextReservations = prevReservations.map((reservation) => {
                if (String(reservation.id) !== change.doc.id) {
                  return reservation;
                }

                matched = true;
                return {
                  ...reservation,
                  status: updatedReservation.status ?? reservation.status,
                  table_label: updatedReservation.table_label ?? reservation.table_label,
                  merchant_note: updatedReservation.merchant_note ?? reservation.merchant_note,
                  customer_name: updatedReservation.customer_name ?? reservation.customer_name,
                  customer_phone: updatedReservation.customer_phone ?? reservation.customer_phone,
                  reservation_date: updatedReservation.reservation_date ?? reservation.reservation_date,
                  time_slot: updatedReservation.time_slot ?? reservation.time_slot,
                  party_size: updatedReservation.party_size ?? reservation.party_size,
                  children_count: updatedReservation.children_count ?? reservation.children_count,
                };
              });

              if (!matched) {
                scheduleRefresh();
                return prevReservations;
              }

              updateStats(nextReservations);
              return nextReservations;
            });
            return;
          }

          if (change.type === 'removed') {
            removeReservationFromState(Number(change.doc.id));
          }
        });
      },
      (error) => {
        console.error('[Reservations] Firestore listener error:', error);
      }
    );

    return () => {
      unsubscribe();
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
    };
  }, [fetchReservations, removeReservationFromState, storeId, updateStats]);

  useEffect(() => {
    if (!storeId || activeTab !== 'reservations') return undefined;

    const intervalId = setInterval(() => {
      fetchReservations({ silent: true });
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeTab, fetchReservations, storeId]);

  const handleCancelClick = (reservationId) => {
    setSelectedReservationId(reservationId);
    setShowCancelDialog(true);
  };

  const handleCancelReservation = async () => {
    try {
      const response = await merchantCancelReservation(selectedReservationId, cancelReason);
      replaceReservationInState(response.data);
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
      const response = await updateReservationStatus(reservationId, 'completed');
      replaceReservationInState(response.data);
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
      removeReservationFromState(reservationId);
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

  return (
    <div className={styles.reservationManagementPage}>
      <div className={styles.pageHeader}>
        <h1>訂位管理</h1>
        <div className={styles.headerStats}>
          <div className={styles.statCardPending}>
            <FaClock />
            <div>
              <span className={styles.statNumber}>{stats.pending}</span>
              <span className={styles.statLabel}>待確認</span>
            </div>
          </div>
          <div className={styles.statCardConfirmed}>
            <FaCheckCircle />
            <div>
              <span className={styles.statNumber}>{stats.confirmed}</span>
              <span className={styles.statLabel}>已確認</span>
            </div>
          </div>
          <div className={styles.statCardCompleted}>
            <FaUsers />
            <div>
              <span className={styles.statNumber}>{stats.completed}</span>
              <span className={styles.statLabel}>已完成</span>
            </div>
          </div>
          <div className={styles.statCardCancelled}>
            <FaTimesCircle />
            <div>
              <span className={styles.statNumber}>{stats.cancelled}</span>
              <span className={styles.statLabel}>已取消</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.tabNavigation}>
        <button
          className={activeTab === 'reservations' ? styles.tabButtonActive : styles.tabButton}
          onClick={() => setActiveTab('reservations')}
        >
          <FaCalendarAlt /> 訂位列表
        </button>
        <button
          className={activeTab === 'settings' ? styles.tabButtonActive : styles.tabButton}
          onClick={() => setActiveTab('settings')}
        >
          <FaClock /> 時段設定
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'reservations' ? (
          <ReservationList
            reservations={reservations}
            selectedDate={selectedReservationDate}
            onDateChange={setSelectedReservationDate}
            onAccept={handleAcceptClick}
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

      {/* 接受訂位對話框 */}
      {showAcceptDialog && (
        <div className={styles.dialogOverlay} onClick={resetAcceptDialog}>
          <div className={`${styles.dialogContent} ${styles.acceptDialogContent}`} onClick={(e) => e.stopPropagation()}>
            <h3>{isEditingConfirmedReservation ? '更改桌位' : '確認訂位'}</h3>
            <p>
              {isEditingConfirmedReservation
                ? '可在完成訂位前調整桌位與給顧客的備註。'
                : '可直接點選桌位（分樓層）並填寫給顧客的備註。'}
            </p>

            <div className={styles.dialogFormGroup}>
              <label>指定桌位（選填）</label>

              {tableFloors.length === 0 && (
                <small className={styles.dialogHint}>尚未設定內用桌位，可先到「內用設定」建立桌位。</small>
              )}

              {tableFloors.length > 0 && (
                <small className={styles.dialogHint}>可拖曳空白處平移地圖，或使用捲軸查看超出畫面的桌位。</small>
              )}

              {tableFloors.length > 0 && (
                <>
                  <div className={styles.tableMapToolbar}>
                    <button
                      type="button"
                      className={styles.tableMapZoomButton}
                      onClick={handleZoomOut}
                      disabled={tableMapZoom <= TABLE_MAP_MIN_ZOOM}
                    >
                      -
                    </button>
                    <span className={styles.tableMapZoomText}>{Math.round(tableMapZoom * 100)}%</span>
                    <button
                      type="button"
                      className={styles.tableMapZoomButton}
                      onClick={handleZoomIn}
                      disabled={tableMapZoom >= TABLE_MAP_MAX_ZOOM}
                    >
                      +
                    </button>
                  </div>

                  <div className={styles.tableFloorTabs}>
                    {tableFloors.map((floor) => (
                      <button
                        key={floor.id}
                        type="button"
                        className={activeTableFloor?.id === floor.id ? styles.tableFloorTabActive : styles.tableFloorTab}
                        onClick={() => setActiveTableFloorId(floor.id)}
                      >
                        {floor.name}
                      </button>
                    ))}
                  </div>

                  <div
                    ref={tableMapViewportRef}
                    className={`${styles.tablePickViewport} ${isPanningTableMap ? styles.tablePickViewportPanning : ''}`}
                    onMouseDown={handleTableMapPointerDown}
                    onMouseMove={handleTableMapPointerMove}
                    onMouseUp={() => setIsPanningTableMap(false)}
                    onMouseLeave={() => setIsPanningTableMap(false)}
                  >
                    <div
                      className={styles.tablePickCanvasScaled}
                      style={{
                        width: `${tableMapSize.width * tableMapZoom}px`,
                        height: `${tableMapSize.height * tableMapZoom}px`,
                      }}
                    >
                      <div
                        className={styles.tablePickCanvas}
                        style={{
                          width: `${tableMapSize.width}px`,
                          height: `${tableMapSize.height}px`,
                          transform: `scale(${tableMapZoom})`,
                          transformOrigin: 'top left',
                        }}
                      >
                        {(activeTableFloor?.tables || []).map((table) => {
                          const shapeClass = table.shape === 'rectangle'
                            ? styles.tablePickItemRectangle
                            : table.shape === 'square'
                              ? styles.tablePickItemSquare
                              : styles.tablePickItemCircle;
                          const tableLabel = String(table.label || '').trim();
                          const isOccupied = occupiedTableLabels.has(tableLabel);

                          return (
                            <button
                              key={table.id}
                              type="button"
                              data-table-pick="true"
                              className={`${shapeClass} ${acceptForm.tableLabel === table.label ? styles.tablePickItemSelected : ''} ${isOccupied ? styles.tablePickItemDisabled : ''}`}
                              style={{ left: table.x, top: table.y }}
                              disabled={isOccupied}
                              title={isOccupied ? '此桌位在同一天同一時段已被預約' : table.label}
                              onClick={() => {
                                if (isOccupied) return;
                                setAcceptForm((prev) => ({ ...prev, tableLabel: table.label }));
                              }}
                            >
                              <span>{table.label}</span>
                              <small>{isOccupied ? '已被預約' : `${table.seats} 人`}</small>
                            </button>
                          );
                        })}

                        {(activeTableFloor?.tables || []).length === 0 && (
                          <div className={styles.tablePickEmpty}>此樓層尚未設定桌位</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.tablePickActions}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => setAcceptForm((prev) => ({ ...prev, tableLabel: '' }))}
                    >
                      不指定桌位
                    </button>
                    {acceptForm.tableLabel && (
                      <span className={styles.selectedTableText}>已選擇：{acceptForm.tableLabel}</span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className={styles.dialogFormGroup}>
              <label>店家備註（選填）</label>
              <textarea
                value={acceptForm.merchantNote}
                onChange={(e) => setAcceptForm((prev) => ({ ...prev, merchantNote: e.target.value }))}
                placeholder="例如：已安排靠窗座位，請準時報到"
                rows="4"
              />
            </div>

            <div className={styles.dialogActions}>
              <button
                className={styles.btnSecondary}
                onClick={resetAcceptDialog}
              >
                返回
              </button>
              <button
                className={styles.btnDanger}
                onClick={handleAcceptReservation}
              >
                {isEditingConfirmedReservation ? '儲存變更' : '確認受理'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 取消訂位對話框 */}
      {showCancelDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowCancelDialog(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <h3>取消訂位</h3>
            <p>您確定要取消此訂位嗎？</p>
            <div className={styles.dialogFormGroup}>
              <label>取消原因（選填）</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="請說明取消原因..."
                rows="4"
              />
            </div>
            <div className={styles.dialogActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason('');
                  setSelectedReservationId(null);
                }}
              >
                返回
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

export default ReservationManagementPage;
