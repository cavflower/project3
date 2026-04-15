import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../store/AuthContext';
import {
  getCompanyStores,
  submitScheduleRequest,
  getMyScheduleRequests,
  deleteScheduleRequest,
} from '../../api/scheduleApi';
import styles from './LayoutApplicationPage.module.css';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const SHIFT_SLOTS = [
  { key: 'full_day', label: '整天' },
  { key: 'midnight', label: '凌晨' },
  { key: 'morning', label: '早上' },
  { key: 'afternoon', label: '下午' },
  { key: 'evening', label: '晚上' },
];

const SHIFT_SLOT_LABEL_MAP = SHIFT_SLOTS.reduce((acc, slot) => {
  acc[slot.key] = slot.label;
  return acc;
}, {});

const SHIFT_SLOT_SORT_INDEX = SHIFT_SLOTS.reduce((acc, slot, index) => {
  acc[slot.key] = index;
  return acc;
}, {});

const ATTENDANCE_STATUS_LABEL_MAP = {
  unmarked: '未標記',
  present: '到班',
  late: '遲到',
  absent: '未到班',
};

const OFF_DUTY_STATUS_LABEL_MAP = {
  unmarked: '未標記',
  on_time: '準時',
  left_early: '早退',
  overtime: '加班',
};

const createEmptySlotSelection = () => (
  SHIFT_SLOTS.reduce((acc, slot) => {
    acc[slot.key] = [];
    return acc;
  }, {})
);

const toDateString = (year, month, day) => (
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const buildCalendarCells = (year, month) => {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, date: toDateString(year, month, day) });
  }

  return cells;
};

const getMonthLabelByDate = (dateStr) => {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length < 2) return '-';
  return `${Number(parts[1])}月`;
};

const requestMonthFormatter = new Intl.DateTimeFormat('zh-TW', {
  year: 'numeric',
  month: 'long',
});

const formatAssignedWorkSummary = (request) => {
  const assignmentStatus = request.assignment_status || 'pending';
  if (assignmentStatus === 'rejected') {
    return '店家已排休';
  }

  const slotRoleEntries = request.assigned_slot_roles && typeof request.assigned_slot_roles === 'object'
    ? Object.entries(request.assigned_slot_roles)
    : [];

  if (slotRoleEntries.length > 0) {
    const sortIndex = SHIFT_SLOTS.reduce((acc, slot, index) => {
      acc[slot.key] = index;
      return acc;
    }, {});

    return slotRoleEntries
      .filter(([slot, roleName]) => SHIFT_SLOT_LABEL_MAP[slot] && String(roleName || '').trim())
      .sort((a, b) => (sortIndex[a[0]] ?? 99) - (sortIndex[b[0]] ?? 99))
      .map(([slot, roleName]) => `${SHIFT_SLOT_LABEL_MAP[slot]}：${String(roleName || '').trim()}`)
      .join('、');
  }

  if (Array.isArray(request.assigned_shift_types) && request.assigned_shift_types.length > 0 && request.role) {
    return request.assigned_shift_types
      .filter((slot) => SHIFT_SLOT_LABEL_MAP[slot])
      .map((slot) => `${SHIFT_SLOT_LABEL_MAP[slot]}：${request.role}`)
      .join('、');
  }

  return request.role || '待店家安排';
};

const formatTodayWorkTimes = (request, todayStr) => {
  if (!request || request.date !== todayStr) {
    return '-';
  }

  if ((request.assignment_status || 'pending') !== 'scheduled') {
    return '尚未排班';
  }

  const workTimes = request.actual_slot_work_times && typeof request.actual_slot_work_times === 'object'
    ? request.actual_slot_work_times
    : {};

  const slotKeys = Object.keys(workTimes)
    .filter((slot) => slot !== 'full_day' && SHIFT_SLOT_LABEL_MAP[slot])
    .sort((a, b) => (SHIFT_SLOT_SORT_INDEX[a] ?? 99) - (SHIFT_SLOT_SORT_INDEX[b] ?? 99));

  if (slotKeys.length === 0) {
    return '尚未設定';
  }

  const entries = slotKeys
    .map((slot) => {
      const slotTime = workTimes[slot] && typeof workTimes[slot] === 'object' ? workTimes[slot] : {};
      const start = String(slotTime.start_time || '').trim();
      const end = String(slotTime.end_time || '').trim();
      if (!start || !end) {
        return '';
      }
      return `${SHIFT_SLOT_LABEL_MAP[slot]}：${start}-${end}`;
    })
    .filter(Boolean);

  return entries.length > 0 ? entries.join('、') : '尚未設定';
};

const getRequestScheduledSlots = (request) => {
  const slotSet = new Set();

  const appendSlot = (slot) => {
    if (slot !== 'full_day' && SHIFT_SLOT_LABEL_MAP[slot]) {
      slotSet.add(slot);
    }
  };

  const assignedShiftTypes = Array.isArray(request?.assigned_shift_types) ? request.assigned_shift_types : [];
  assignedShiftTypes.forEach(appendSlot);

  if (!slotSet.size && request?.shift_type) {
    appendSlot(request.shift_type);
  }

  const slotMaps = [
    request?.assigned_slot_roles,
    request?.actual_slot_work_times,
    request?.actual_slot_attendance,
    request?.actual_slot_attendance_display,
    request?.actual_slot_off_duty_status,
    request?.actual_slot_off_duty_status_display,
    request?.actual_slot_actual_end_times,
  ];

  slotMaps.forEach((slotMap) => {
    if (slotMap && typeof slotMap === 'object') {
      Object.keys(slotMap).forEach(appendSlot);
    }
  });

  return [...slotSet].sort((a, b) => (SHIFT_SLOT_SORT_INDEX[a] ?? 99) - (SHIFT_SLOT_SORT_INDEX[b] ?? 99));
};

const buildShiftStatusLines = (request) => {
  if (!request || (request.assignment_status || 'pending') !== 'scheduled') {
    return ['待店家排班'];
  }

  const slotKeys = getRequestScheduledSlots(request);
  if (slotKeys.length === 0) {
    return ['尚未設定'];
  }

  const attendanceDisplayMap = request.actual_slot_attendance_display && typeof request.actual_slot_attendance_display === 'object'
    ? request.actual_slot_attendance_display
    : {};
  const attendanceRawMap = request.actual_slot_attendance && typeof request.actual_slot_attendance === 'object'
    ? request.actual_slot_attendance
    : {};

  const offDutyDisplayMap = request.actual_slot_off_duty_status_display && typeof request.actual_slot_off_duty_status_display === 'object'
    ? request.actual_slot_off_duty_status_display
    : {};
  const offDutyRawMap = request.actual_slot_off_duty_status && typeof request.actual_slot_off_duty_status === 'object'
    ? request.actual_slot_off_duty_status
    : {};

  const actualEndMap = request.actual_slot_actual_end_times && typeof request.actual_slot_actual_end_times === 'object'
    ? request.actual_slot_actual_end_times
    : {};

  return slotKeys.map((slot) => {
    const attendanceRaw = String(attendanceRawMap[slot] || '').trim();
    const offDutyRaw = String(offDutyRawMap[slot] || '').trim();

    const attendanceLabel = String(attendanceDisplayMap[slot] || ATTENDANCE_STATUS_LABEL_MAP[attendanceRaw] || '未標記').trim();
    const offDutyLabel = String(offDutyDisplayMap[slot] || OFF_DUTY_STATUS_LABEL_MAP[offDutyRaw] || '未標記').trim();

    const actualEndTime = String(actualEndMap[slot] || '').trim();
    const actualEndText = (offDutyRaw === 'left_early' || offDutyRaw === 'overtime') && actualEndTime
      ? `（實際下班 ${actualEndTime}）`
      : '';

    return `${SHIFT_SLOT_LABEL_MAP[slot] || slot}：上班 ${attendanceLabel} / 下班 ${offDutyLabel}${actualEndText}`;
  });
};

const LayoutApplicationPage = () => {
  const authContext = useAuth();
  const user = authContext?.user || null;
  const authLoading = authContext?.loading !== undefined ? authContext.loading : true;

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const todayStr = toDateString(currentYear, currentMonth, today.getDate());

  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedSlots, setSelectedSlots] = useState(() => SHIFT_SLOTS.map((slot) => slot.key));
  const [selectedDatesBySlot, setSelectedDatesBySlot] = useState(createEmptySlotSelection);
  const [notes, setNotes] = useState('');
  const [requests, setRequests] = useState([]);
  const [requestCalendarMonth, setRequestCalendarMonth] = useState(
    () => new Date(currentYear, currentMonth - 1, 1)
  );
  const [selectedRequestDate, setSelectedRequestDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const calendarCells = useMemo(
    () => buildCalendarCells(currentYear, selectedMonth),
    [currentYear, selectedMonth]
  );

  const requestCalendarCells = useMemo(
    () => buildCalendarCells(requestCalendarMonth.getFullYear(), requestCalendarMonth.getMonth() + 1),
    [requestCalendarMonth]
  );

  const requestDateSet = useMemo(
    () => new Set(requests.map((request) => request.date).filter(Boolean)),
    [requests]
  );

  const requestsBySelectedDate = useMemo(
    () => requests.filter((request) => request.date === selectedRequestDate),
    [requests, selectedRequestDate]
  );

  const loadStores = useCallback(async () => {
    if (!user || !user.company_tax_id) {
      return;
    }
    try {
      setError('');
      const response = await getCompanyStores();
      const storesData = response.data || [];
      setStores(storesData);
      if (storesData.length > 0) {
        setSelectedStore(storesData[0].id.toString());
      } else {
        setSelectedStore('');
      }
    } catch (err) {
      console.error('載入店家列表失敗:', err);
      const errorMsg = err.response?.data?.error || err.message || '載入店家列表失敗';
      setError(errorMsg);
      setStores([]);
      setSelectedStore('');
    }
  }, [user]);

  const loadMyRequests = useCallback(async () => {
    if (!user || !user.company_tax_id) {
      return;
    }
    try {
      const response = await getMyScheduleRequests();
      setRequests(response.data || []);
    } catch (err) {
      console.error('載入申請記錄失敗:', err);
      setRequests([]);
    }
  }, [user]);

  useEffect(() => {
    if (user?.company_tax_id) {
      loadStores();
      loadMyRequests();
    } else {
      setStores([]);
      setRequests([]);
      setSelectedStore('');
    }
  }, [user?.company_tax_id, loadStores, loadMyRequests]);

  useEffect(() => {
    setSelectedDatesBySlot(createEmptySlotSelection());
  }, [selectedMonth]);

  const toggleSlotSelection = (slotKey) => {
    setSelectedSlots((prev) => {
      if (prev.includes(slotKey)) {
        return prev.filter((key) => key !== slotKey);
      }
      return [...prev, slotKey];
    });
  };

  const toggleDateSelection = (slotKey, dateValue) => {
    if (!dateValue || dateValue < todayStr) return;

    setSelectedDatesBySlot((prev) => {
      const currentDates = prev[slotKey] || [];
      const nextDates = currentDates.includes(dateValue)
        ? currentDates.filter((item) => item !== dateValue)
        : [...currentDates, dateValue].sort();

      return {
        ...prev,
        [slotKey]: nextDates,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (selectedSlots.length === 0) {
      setError('請至少勾選一個時段');
      setLoading(false);
      return;
    }

    const totalSelectedCount = selectedSlots.reduce(
      (sum, slotKey) => sum + ((selectedDatesBySlot[slotKey] || []).length),
      0
    );

    if (!selectedStore || totalSelectedCount === 0) {
      setError('請先選擇店家、月份與至少一個時段日期');
      setLoading(false);
      return;
    }

    try {
      const storeId = parseInt(selectedStore, 10);
      const payloadItems = SHIFT_SLOTS
        .filter((slot) => selectedSlots.includes(slot.key))
        .flatMap((slot) => {
        const uniqueDates = [...new Set(selectedDatesBySlot[slot.key] || [])].sort();
        return uniqueDates.map((dateValue) => ({
          date: dateValue,
          shiftType: slot.key,
        }));
      });

      const results = await Promise.allSettled(
        payloadItems.map((item) =>
          submitScheduleRequest({
            store: storeId,
            date: item.date,
            period_type: 'month',
            shift_type: item.shiftType,
            notes: notes.trim(),
          })
        )
      );

      const successCount = results.filter((item) => item.status === 'fulfilled').length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        setSuccess(`已提交 ${successCount} 筆可上班日期`);
        setSelectedDatesBySlot(createEmptySlotSelection());
        setNotes('');
        await loadMyRequests();
      }

      if (failCount > 0) {
        setError(`有 ${failCount} 筆提交失敗（可能重複申請同日期）`);
      }

      if (successCount === 0 && failCount > 0) {
        setError('全部提交失敗，請確認日期是否重複或稍後重試');
      }
    } catch (err) {
      console.error('提交申請失敗:', err);
      setError(err.response?.data?.error || '提交申請失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除此申請嗎？')) {
      return;
    }

    try {
      await deleteScheduleRequest(id);
      setSuccess('申請已刪除');
      await loadMyRequests();
    } catch (err) {
      console.error('刪除申請失敗:', err);
      setError('刪除申請失敗');
    }
  };

  const moveRequestCalendarMonth = (offset) => {
    setRequestCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const handleRequestDateSelect = (dateValue) => {
    if (!dateValue) {
      return;
    }

    setSelectedRequestDate(dateValue);

    const parsed = new Date(`${dateValue}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      setRequestCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  };

  if (authLoading) {
    return (
      <div className={styles.layoutApplicationPage}>
        <div className={styles.container}>
          <div className={styles.errorMessage}>
            <p>載入中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.layoutApplicationPage}>
        <div className={styles.container}>
          <div className={styles.errorMessage}>
            <p>請先登入</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user.company_tax_id) {
    return (
      <div className={styles.layoutApplicationPage}>
        <div className={styles.container}>
          <div className={styles.errorMessage}>
            <p>只有公司員工才能使用此功能</p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              請在註冊時填寫公司統編
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layoutApplicationPage}>
      <div className={styles.container}>
        <h1>排班申請</h1>
        <p className={styles.pageDescription}>請先選月份，再於各時段月曆複選可上班日期</p>

        {error && <div className={styles.alertError}>{error}</div>}
        {success && <div className={styles.alertSuccess}>{success}</div>}

        <div className={styles.formSection}>
          <h2>新增排班申請</h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="store">選擇店家 *</label>
              <select
                id="store"
                value={selectedStore || ''}
                onChange={(e) => setSelectedStore(e.target.value)}
                required
                disabled={stores.length === 0}
              >
                <option value="">{stores.length === 0 ? '暫無可用店家' : '請選擇店家'}</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name || `店家 ${store.id}`}
                  </option>
                ))}
              </select>
              {stores.length === 0 && (
                <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem' }}>
                  <p>目前沒有可用的店家</p>
                  <p style={{ marginTop: '0.25rem', color: '#666' }}>可能原因：</p>
                  <ul style={{ marginTop: '0.25rem', paddingLeft: '1.5rem', color: '#666' }}>
                    <li>與您統編相同的商家尚未創建店家</li>
                    <li>請確認您的統編是否正確，或聯繫管理員協助</li>
                  </ul>
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="month_select">月份 *</label>
              <select
                id="month_select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                required
              >
                {MONTH_OPTIONS.map((month) => {
                  const disabled = month < currentMonth;
                  return (
                    <option key={month} value={month} disabled={disabled}>
                      {month}月{disabled ? '（已過）' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>勾選時段（只顯示有勾選的時段日曆） *</label>
              <div className={styles.slotFilterRow}>
                {SHIFT_SLOTS.map((slot) => {
                  const checked = selectedSlots.includes(slot.key);
                  return (
                    <label key={`slot-filter-${slot.key}`} className={styles.slotFilterItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSlotSelection(slot.key)}
                      />
                      <span>{slot.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>可上班日期（各時段可獨立複選） *</label>

              <div className={styles.slotCalendarGrid}>
                {SHIFT_SLOTS.filter((slot) => selectedSlots.includes(slot.key)).map((slot) => {
                  const slotDates = selectedDatesBySlot[slot.key] || [];
                  return (
                    <div key={slot.key} className={styles.slotCalendarCard}>
                      <div className={styles.slotCalendarHeader}>
                        <h3>{slot.label}</h3>
                        <span>已選 {slotDates.length} 天</span>
                      </div>

                      <div className={styles.calendarBox}>
                        <div className={styles.weekdayRow}>
                          {WEEKDAY_LABELS.map((label) => (
                            <div key={`${slot.key}-${label}`} className={styles.weekdayCell}>{label}</div>
                          ))}
                        </div>
                        <div className={styles.calendarGrid}>
                          {calendarCells.map((cell, index) => {
                            if (!cell) {
                              return <div key={`${slot.key}-empty-${index}`} className={styles.emptyDateCell} />;
                            }

                            const isDisabled = cell.date < todayStr;
                            const isSelected = slotDates.includes(cell.date);

                            return (
                              <button
                                key={`${slot.key}-${cell.date}`}
                                type="button"
                                className={`${styles.dateCell} ${isSelected ? styles.dateCellSelected : ''} ${isDisabled ? styles.dateCellDisabled : ''}`}
                                disabled={isDisabled}
                                onClick={() => toggleDateSelection(slot.key, cell.date)}
                              >
                                {cell.day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="notes">備註</label>
              <textarea
                id="notes"
                rows="3"
                placeholder="可選填，例如：可支援加班、只能上半天等"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? '提交中...' : '提交申請'}
            </button>
          </form>
        </div>

        <div className={styles.requestsSection}>
          <h2>我的申請記錄</h2>
          {requests.length === 0 ? (
            <p className={styles.emptyMessage}>尚無申請記錄</p>
          ) : (
            <>
              <div className={styles.requestHistoryPanel}>
                <div className={styles.historyCalendarHeader}>
                  <button
                    type="button"
                    className={styles.btnMonthNav}
                    onClick={() => moveRequestCalendarMonth(-1)}
                  >
                    上個月
                  </button>
                  <strong>{requestMonthFormatter.format(requestCalendarMonth)}</strong>
                  <button
                    type="button"
                    className={styles.btnMonthNav}
                    onClick={() => moveRequestCalendarMonth(1)}
                  >
                    下個月
                  </button>
                </div>

                <div className={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={`history-weekday-${label}`} className={styles.weekdayCell}>{label}</div>
                  ))}
                </div>

                <div className={styles.historyCalendarGrid}>
                  {requestCalendarCells.map((cell, index) => {
                    if (!cell) {
                      return <div key={`history-empty-${index}`} className={styles.historyEmptyDateCell} />;
                    }

                    const hasRequest = requestDateSet.has(cell.date);
                    const isSelected = selectedRequestDate === cell.date;
                    const isToday = todayStr === cell.date;

                    return (
                      <button
                        key={`history-date-${cell.date}`}
                        type="button"
                        className={`${styles.historyDateCell} ${hasRequest ? styles.historyDateCellHasRequest : ''} ${
                          isSelected ? styles.historyDateCellSelected : ''
                        }`}
                        onClick={() => handleRequestDateSelect(cell.date)}
                      >
                        <span>{cell.day}</span>
                        {isToday && <small>今天</small>}
                      </button>
                    );
                  })}
                </div>

                <p className={styles.requestHistorySummary}>
                  {selectedRequestDate} 共 {requestsBySelectedDate.length} 筆申請
                </p>
              </div>

              <div className={styles.requestsTableWrapper}>
                <table className={styles.requestsTable}>
                  <thead>
                    <tr>
                      <th>店家</th>
                      <th>月份</th>
                      <th>時段</th>
                      <th>可上班日期</th>
                      <th>今日上下班時間</th>
                      <th>排班上下班狀況</th>
                      <th>店家排班結果</th>
                      <th>排班狀態</th>
                      <th>備註</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestsBySelectedDate.length === 0 && (
                      <tr>
                        <td colSpan="10" className={styles.emptyMessage}>
                          {selectedRequestDate === todayStr ? '當日無申請排班' : '此日期尚無申請記錄'}
                        </td>
                      </tr>
                    )}
                    {requestsBySelectedDate.map((request) => (
                      <tr key={request.id || `${request.store_name}-${request.date}-${request.shift_type}`}>
                        <td>{request.store_name || '-'}</td>
                        <td>{getMonthLabelByDate(request.date)}</td>
                        <td>{request.shift_type_display || '-'}</td>
                        <td>{request.date || '-'}</td>
                        <td>{formatTodayWorkTimes(request, todayStr)}</td>
                        <td>
                          <div className={styles.slotStatusList}>
                            {buildShiftStatusLines(request).map((line) => (
                              <div key={`${request.id}-status-${line}`} className={styles.slotStatusLine}>{line}</div>
                            ))}
                          </div>
                        </td>
                        <td>{formatAssignedWorkSummary(request)}</td>
                        <td>{request.assignment_status_display || '待安排'}</td>
                        <td>{request.notes || '-'}</td>
                        <td>
                          {request.id && (
                            <button
                              className={styles.btnDelete}
                              onClick={() => handleDelete(request.id)}
                            >
                              刪除
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayoutApplicationPage;

