import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getEmployeeRequests, updateScheduleRequest } from '../../../api/scheduleApi';
import styles from './ActualSchedulePage.module.css';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const SLOT_CONFIG = [
  { value: 'midnight', label: '凌晨', defaultStart: '00:00', defaultEnd: '06:00' },
  { value: 'morning', label: '早上', defaultStart: '08:00', defaultEnd: '11:30' },
  { value: 'afternoon', label: '下午', defaultStart: '13:00', defaultEnd: '17:00' },
  { value: 'evening', label: '晚上', defaultStart: '18:00', defaultEnd: '22:00' },
];

const SLOT_LABEL_MAP = SLOT_CONFIG.reduce((acc, slot) => {
  acc[slot.value] = slot.label;
  return acc;
}, {});

const ATTENDANCE_OPTIONS = [
  { value: 'unmarked', label: '未標記' },
  { value: 'present', label: '到班' },
  { value: 'late', label: '遲到' },
  { value: 'absent', label: '未到班' },
];

const OFF_DUTY_STATUS_OPTIONS = [
  { value: 'unmarked', label: '未標記' },
  { value: 'on_time', label: '準時' },
  { value: 'left_early', label: '早退' },
  { value: 'overtime', label: '加班' },
];

const HALF_HOUR_MINUTE_OPTIONS = ['00', '30'];
const TWELVE_HOUR_OPTIONS = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const PERIOD_OPTIONS = ['AM', 'PM'];

const PERIOD_LABEL_MAP = {
  AM: '上午',
  PM: '下午',
};

const monthTitleFormatter = new Intl.DateTimeFormat('zh-TW', {
  year: 'numeric',
  month: 'long',
});

const toDateString = (dateObj) => (
  `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
    dateObj.getDate()
  ).padStart(2, '0')}`
);

const toTwelveHourParts = (value) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;

  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour24) || !Number.isInteger(minute) || hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) {
    return null;
  }

  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return {
    period,
    hour12: String(hour12).padStart(2, '0'),
    minute: String(minute).padStart(2, '0'),
  };
};

const toTwentyFourHourText = (period, hour12Text, minuteText) => {
  const parsedHour12 = Number(hour12Text);
  const parsedMinute = Number(minuteText);
  if (!Number.isInteger(parsedHour12) || !Number.isInteger(parsedMinute)) {
    return '';
  }

  let hour24 = parsedHour12 % 12;
  if (period === 'PM') {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, '0')}:${String(parsedMinute).padStart(2, '0')}`;
};

const normalizeMinuteToHalfHour = (minuteText) => (Number(minuteText) >= 30 ? '30' : '00');

const normalizeTimeToHalfHour = (value, fallbackValue = '00:00') => {
  const base = toTwelveHourParts(value) || toTwelveHourParts(fallbackValue) || {
    period: 'AM',
    hour12: '12',
    minute: '00',
  };

  const normalizedMinute = base.minute === '30' ? '30' : normalizeMinuteToHalfHour(base.minute);
  return toTwentyFourHourText(base.period, base.hour12, normalizedMinute);
};

const isHalfHourTime = (value) => {
  if (!value) return true;
  const match = /^(\d{2}):(\d{2})$/.exec(String(value));
  if (!match) return false;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && (minute === 0 || minute === 30);
};

const getTimePickerValues = (value, fallbackValue) => {
  const normalized = normalizeTimeToHalfHour(value, fallbackValue);
  const parts = toTwelveHourParts(normalized) || {
    period: 'AM',
    hour12: '12',
    minute: '00',
  };

  return {
    period: parts.period,
    hour12: parts.hour12,
    minute: parts.minute === '30' ? '30' : '00',
    normalized,
  };
};

const buildCalendarCells = (baseMonthDate) => {
  const year = baseMonthDate.getFullYear();
  const month = baseMonthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(year, month, day);
    cells.push({
      day,
      value: toDateString(current),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const normalizeAssignedSlots = (request) => {
  if (Array.isArray(request.assigned_shift_types) && request.assigned_shift_types.length > 0) {
    return request.assigned_shift_types.filter((slot) => slot !== 'full_day' && SLOT_LABEL_MAP[slot]);
  }

  if (request.shift_type && request.shift_type !== 'full_day' && SLOT_LABEL_MAP[request.shift_type]) {
    return [request.shift_type];
  }

  return [];
};

const getRoleForSlot = (request, slotValue) => {
  if (request.assigned_slot_roles && typeof request.assigned_slot_roles === 'object') {
    const roleName = String(request.assigned_slot_roles[slotValue] || '').trim();
    if (roleName) return roleName;
  }

  return String(request.role || '').trim() || '-';
};

const ActualSchedulePage = () => {
  const today = useMemo(() => new Date(), []);
  const todayValue = useMemo(() => toDateString(today), [today]);

  const [requests, setRequests] = useState([]);
  const [visibleSlots, setVisibleSlots] = useState(() => SLOT_CONFIG.map((slot) => slot.value));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [draftMap, setDraftMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await getEmployeeRequests();
      setRequests(response.data || []);
    } catch (error) {
      console.error('載入實際班表資料失敗:', error);
      setErrorMessage('載入實際班表資料失敗，請稍後再試');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const scheduledRequests = useMemo(
    () => requests.filter((request) => (request.assignment_status || 'pending') === 'scheduled'),
    [requests]
  );

  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);

  const scheduledDateSet = useMemo(
    () => new Set(scheduledRequests.map((request) => request.date).filter(Boolean)),
    [scheduledRequests]
  );

  const requestsOnSelectedDate = useMemo(
    () => scheduledRequests.filter((request) => request.date === selectedDate),
    [scheduledRequests, selectedDate]
  );

  const slotSections = useMemo(() => SLOT_CONFIG.map((slot) => {
    const rows = requestsOnSelectedDate
      .filter((request) => normalizeAssignedSlots(request).includes(slot.value))
      .map((request) => {
        const rowKey = `${request.id}:${slot.value}`;
        const savedTime = (
          request.actual_slot_work_times
          && typeof request.actual_slot_work_times === 'object'
          && request.actual_slot_work_times[slot.value]
          && typeof request.actual_slot_work_times[slot.value] === 'object'
        )
          ? request.actual_slot_work_times[slot.value]
          : {};

        const savedAttendance = (
          request.actual_slot_attendance
          && typeof request.actual_slot_attendance === 'object'
          && request.actual_slot_attendance[slot.value]
        )
          ? request.actual_slot_attendance[slot.value]
          : 'unmarked';

        const savedOffDutyStatus = (
          request.actual_slot_off_duty_status
          && typeof request.actual_slot_off_duty_status === 'object'
          && request.actual_slot_off_duty_status[slot.value]
        )
          ? request.actual_slot_off_duty_status[slot.value]
          : 'unmarked';

        const savedActualEndTime = (
          request.actual_slot_actual_end_times
          && typeof request.actual_slot_actual_end_times === 'object'
          && request.actual_slot_actual_end_times[slot.value]
        )
          ? String(request.actual_slot_actual_end_times[slot.value]).trim()
          : '';

        return {
          key: rowKey,
          request,
          slotValue: slot.value,
          employeeName: request.employee_name || '-',
          roleName: getRoleForSlot(request, slot.value),
          defaultStart: savedTime.start_time || slot.defaultStart,
          defaultEnd: savedTime.end_time || slot.defaultEnd,
          defaultAttendance: savedAttendance,
          defaultOffDutyStatus: savedOffDutyStatus,
          defaultActualEndTime: savedActualEndTime,
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'zh-Hant'));

    return {
      ...slot,
      rows,
    };
  }), [requestsOnSelectedDate]);

  useEffect(() => {
    setDraftMap((prev) => {
      let hasChange = false;
      const next = { ...prev };

      slotSections.forEach((section) => {
        section.rows.forEach((row) => {
          if (!next[row.key]) {
            next[row.key] = {
              start_time: normalizeTimeToHalfHour(row.defaultStart, row.defaultStart),
              end_time: normalizeTimeToHalfHour(row.defaultEnd, row.defaultEnd),
              attendance: row.defaultAttendance,
              off_duty_status: row.defaultOffDutyStatus,
              actual_end_time: row.defaultActualEndTime
                ? normalizeTimeToHalfHour(row.defaultActualEndTime, row.defaultEnd)
                : '',
            };
            hasChange = true;
          }
        });
      });

      return hasChange ? next : prev;
    });
  }, [slotSections]);

  const isSelectedDateToday = selectedDate === todayValue;

  const visibleSlotSections = useMemo(
    () => slotSections.filter((section) => visibleSlots.includes(section.value)),
    [slotSections, visibleSlots]
  );

  const updateDraftValue = (key, field, value) => {
    setDraftMap((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      },
    }));
  };

  const updateDraftTime = (key, field, period, hour12, minute, fallbackValue = '00:00') => {
    const nextTime = toTwentyFourHourText(period, hour12, minute);
    const normalized = normalizeTimeToHalfHour(nextTime, fallbackValue);
    updateDraftValue(key, field, normalized);
  };

  const updateWorkBoundaryTime = (row, field, period, hour12, minute, fallbackValue) => {
    const draft = draftMap[row.key] || {};
    const nextTime = normalizeTimeToHalfHour(toTwentyFourHourText(period, hour12, minute), fallbackValue);

    const currentStart = String(draft.start_time || row.defaultStart || '').trim();
    const currentEnd = String(draft.end_time || row.defaultEnd || '').trim();
    const nextStart = field === 'start_time' ? nextTime : currentStart;
    const nextEnd = field === 'end_time' ? nextTime : currentEnd;

    if (nextStart && nextEnd && nextStart >= nextEnd) {
      setErrorMessage(`${row.employeeName}（${SLOT_LABEL_MAP[row.slotValue] || row.slotValue}）上班時間不可晚於或等於下班時間`);
      setTimeout(() => setErrorMessage(''), 2500);
      return;
    }

    updateDraftValue(row.key, field, nextTime);
  };

  const toggleVisibleSlot = (slotValue) => {
    setVisibleSlots((prev) => {
      if (prev.includes(slotValue)) {
        return prev.filter((item) => item !== slotValue);
      }
      return [...prev, slotValue];
    });
  };

  const handleOffDutyStatusChange = (rowKey, statusValue) => {
    setDraftMap((prev) => {
      const nextStatus = String(statusValue || 'unmarked').trim() || 'unmarked';
      const current = prev[rowKey] || {};
      return {
        ...prev,
        [rowKey]: {
          ...current,
          off_duty_status: nextStatus,
          actual_end_time: nextStatus === 'on_time' ? '' : current.actual_end_time || '',
        },
      };
    });
  };

  const moveMonth = (offset) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const handleDateSelect = (dateValue) => {
    if (!dateValue) return;
    setSelectedDate(dateValue);
  };

  const handleSaveSelectedDate = async () => {
    const allRows = slotSections.flatMap((section) => section.rows);
    if (allRows.length === 0) {
      setStatusMessage('所選日期沒有已排班員工可儲存');
      setTimeout(() => setStatusMessage(''), 2500);
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const groupedByRequestId = {};

      allRows.forEach((row) => {
        const requestId = row.request.id;
        const draft = draftMap[row.key] || {};
        const startTime = String(draft.start_time || '').trim();
        const endTime = String(draft.end_time || '').trim();

        if (!isHalfHourTime(startTime) || !isHalfHourTime(endTime)) {
          throw new Error(`${row.employeeName}（${SLOT_LABEL_MAP[row.slotValue] || row.slotValue}）時間需以半小時為單位`);
        }

        if (startTime && endTime && startTime >= endTime) {
          throw new Error(`${row.employeeName}（${SLOT_LABEL_MAP[row.slotValue] || row.slotValue}）下班時間必須晚於上班時間`);
        }

        if (!groupedByRequestId[requestId]) {
          groupedByRequestId[requestId] = {
            request: row.request,
            workTimes: {
              ...((row.request.actual_slot_work_times && typeof row.request.actual_slot_work_times === 'object')
                ? row.request.actual_slot_work_times
                : {}),
            },
            attendance: {
              ...((row.request.actual_slot_attendance && typeof row.request.actual_slot_attendance === 'object')
                ? row.request.actual_slot_attendance
                : {}),
            },
            offDutyStatus: {
              ...((row.request.actual_slot_off_duty_status && typeof row.request.actual_slot_off_duty_status === 'object')
                ? row.request.actual_slot_off_duty_status
                : {}),
            },
            actualEndTimes: {
              ...((row.request.actual_slot_actual_end_times && typeof row.request.actual_slot_actual_end_times === 'object')
                ? row.request.actual_slot_actual_end_times
                : {}),
            },
          };
        }

        groupedByRequestId[requestId].workTimes[row.slotValue] = {
          start_time: startTime,
          end_time: endTime,
        };

        const offDutyStatus = String(draft.off_duty_status || 'on_time').trim() || 'on_time';
        if (!OFF_DUTY_STATUS_OPTIONS.some((item) => item.value === offDutyStatus)) {
          throw new Error(`${row.employeeName}（${SLOT_LABEL_MAP[row.slotValue] || row.slotValue}）下班狀況無效`);
        }

        groupedByRequestId[requestId].offDutyStatus[row.slotValue] = offDutyStatus;

        const actualEndTime = String(draft.actual_end_time || '').trim();
        if (offDutyStatus === 'left_early' || offDutyStatus === 'overtime') {
          if (!actualEndTime) {
            throw new Error(`${row.employeeName}（${SLOT_LABEL_MAP[row.slotValue] || row.slotValue}）請填寫實際下班時間`);
          }
          if (!isHalfHourTime(actualEndTime)) {
            throw new Error(`${row.employeeName}（${SLOT_LABEL_MAP[row.slotValue] || row.slotValue}）實際下班時間需為 00 或 30 分`);
          }
          groupedByRequestId[requestId].actualEndTimes[row.slotValue] = actualEndTime;
        } else {
          delete groupedByRequestId[requestId].actualEndTimes[row.slotValue];
        }

        if (isSelectedDateToday) {
          const attendance = String(draft.attendance || 'unmarked').trim() || 'unmarked';
          if (attendance === 'unmarked') {
            delete groupedByRequestId[requestId].attendance[row.slotValue];
          } else {
            groupedByRequestId[requestId].attendance[row.slotValue] = attendance;
          }
        }
      });

      const requestsToSave = Object.entries(groupedByRequestId);
      const results = await Promise.allSettled(
        requestsToSave.map(([requestId, payload]) => {
          const patchPayload = {
            actual_slot_work_times: payload.workTimes,
          };

          if (isSelectedDateToday) {
            patchPayload.actual_slot_attendance = payload.attendance;
            patchPayload.actual_slot_off_duty_status = payload.offDutyStatus;
            patchPayload.actual_slot_actual_end_times = payload.actualEndTimes;
          }

          return updateScheduleRequest(Number(requestId), patchPayload);
        })
      );

      const successCount = results.filter((item) => item.status === 'fulfilled').length;
      const failedCount = results.length - successCount;

      await loadRequests();

      if (failedCount > 0) {
        setErrorMessage(`儲存完成：成功 ${successCount} 筆，失敗 ${failedCount} 筆`);
      } else {
        setStatusMessage(`已儲存 ${successCount} 筆實際班表資料`);
      }

      setTimeout(() => {
        setStatusMessage('');
        setErrorMessage('');
      }, 3500);
    } catch (error) {
      console.error('儲存實際班表失敗:', error);
      const errorText = error?.response?.data?.detail || error?.response?.data?.error || error?.message || '儲存失敗，請稍後再試';
      setErrorMessage(errorText);
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>店家管理 / 實際班表</p>
          <h1>實際班表</h1>
          <p className={styles.description}>先從日曆選日期，再設定各時段員工上下班時間與到班狀況。</p>
        </div>
        <button className={styles.ghostBtn} onClick={loadRequests} disabled={loading || saving}>
          重新載入
        </button>
      </header>

      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
      {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}

      <section className={styles.mainGrid}>
        <aside className={styles.calendarPanel}>
          <div className={styles.calendarHeader}>
            <button className={styles.ghostBtn} onClick={() => moveMonth(-1)}>
              上個月
            </button>
            <strong>{monthTitleFormatter.format(calendarMonth)}</strong>
            <button className={styles.ghostBtn} onClick={() => moveMonth(1)}>
              下個月
            </button>
          </div>

          <div className={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className={styles.calendarGrid}>
            {calendarCells.map((cell, index) => {
              if (!cell) {
                return <div key={`empty-${index}`} className={styles.emptyCell} />;
              }

              const hasShift = scheduledDateSet.has(cell.value);
              const isSelected = selectedDate === cell.value;
              const isToday = todayValue === cell.value;

              return (
                <button
                  key={cell.value}
                  type="button"
                  className={`${styles.dateBtn} ${hasShift ? styles.dateBtnHasShift : ''} ${
                    isSelected ? styles.dateBtnSelected : ''
                  }`}
                  onClick={() => handleDateSelect(cell.value)}
                >
                  <span>{cell.day}</span>
                  {isToday && <small>今天</small>}
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <h2>{selectedDate} 的實際班表</h2>
              <p className={styles.detailHint}>
                {isSelectedDateToday
                  ? '今日可調整上下班時間與到班狀況（時間以半小時為單位）。'
                  : '非當日僅可調整上下班時間，到班狀況不可變更（時間以半小時為單位）。'}
              </p>
              <div className={styles.slotFilterRow}>
                {SLOT_CONFIG.map((slot) => {
                  const checked = visibleSlots.includes(slot.value);
                  return (
                    <label key={`visible-slot-${slot.value}`} className={styles.slotFilterItem}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleVisibleSlot(slot.value)}
                      />
                      <span>{slot.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <button
              className={styles.primaryBtn}
              onClick={handleSaveSelectedDate}
              disabled={saving || loading}
            >
              {saving ? '儲存中...' : '儲存當日設定'}
            </button>
          </div>

          {loading ? (
            <p className={styles.placeholder}>載入中...</p>
          ) : (
            <div className={styles.slotSectionList}>
              {visibleSlotSections.length === 0 && (
                <p className={styles.placeholder}>請先勾選至少一個時段</p>
              )}
              {visibleSlotSections.map((section) => (
                <article key={section.value} className={styles.slotCard}>
                  <h3>{section.label}</h3>
                  {section.rows.length === 0 ? (
                    <p className={styles.placeholder}>此時段無已排班員工</p>
                  ) : (
                    <div className={styles.tableWrapper}>
                      <table>
                        <thead>
                          <tr>
                            <th>員工</th>
                            <th>職務</th>
                            <th>上班時間</th>
                            <th>下班時間</th>
                            <th>到班狀況</th>
                            <th>下班狀況</th>
                            <th>實際下班時間</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row) => {
                            const draft = draftMap[row.key] || {};
                            const startPicker = getTimePickerValues(draft.start_time || row.defaultStart, row.defaultStart);
                            const endPicker = getTimePickerValues(draft.end_time || row.defaultEnd, row.defaultEnd);
                            const actualEndPicker = getTimePickerValues(
                              draft.actual_end_time || row.defaultEnd,
                              row.defaultEnd
                            );
                            const currentOffDutyStatus = String(draft.off_duty_status || 'unmarked').trim() || 'unmarked';
                            const requiresActualEndTime = currentOffDutyStatus === 'left_early' || currentOffDutyStatus === 'overtime';
                            return (
                              <tr key={row.key}>
                                <td>{row.employeeName}</td>
                                <td>{row.roleName}</td>
                                <td>
                                  <div className={styles.halfHourPicker}>
                                    <select
                                      className={styles.periodSelect}
                                      value={startPicker.period}
                                      onChange={(e) => updateWorkBoundaryTime(
                                        row,
                                        'start_time',
                                        e.target.value,
                                        startPicker.hour12,
                                        startPicker.minute,
                                        row.defaultStart
                                      )}
                                    >
                                      {PERIOD_OPTIONS.map((periodValue) => (
                                        <option key={`${row.key}-start-period-${periodValue}`} value={periodValue}>
                                          {PERIOD_LABEL_MAP[periodValue]}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={startPicker.hour12}
                                      onChange={(e) => updateWorkBoundaryTime(
                                        row,
                                        'start_time',
                                        startPicker.period,
                                        e.target.value,
                                        startPicker.minute,
                                        row.defaultStart
                                      )}
                                    >
                                      {TWELVE_HOUR_OPTIONS.map((hourOption) => (
                                        <option key={`${row.key}-start-hour-${hourOption}`} value={hourOption}>
                                          {hourOption}
                                        </option>
                                      ))}
                                    </select>
                                    <span className={styles.pickerColon}>:</span>
                                    <select
                                      value={startPicker.minute}
                                      onChange={(e) => updateWorkBoundaryTime(
                                        row,
                                        'start_time',
                                        startPicker.period,
                                        startPicker.hour12,
                                        e.target.value,
                                        row.defaultStart
                                      )}
                                    >
                                      {HALF_HOUR_MINUTE_OPTIONS.map((minuteOption) => (
                                        <option key={`${row.key}-start-minute-${minuteOption}`} value={minuteOption}>
                                          {minuteOption}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                                <td>
                                  <div className={styles.halfHourPicker}>
                                    <select
                                      className={styles.periodSelect}
                                      value={endPicker.period}
                                      onChange={(e) => updateWorkBoundaryTime(
                                        row,
                                        'end_time',
                                        e.target.value,
                                        endPicker.hour12,
                                        endPicker.minute,
                                        row.defaultEnd
                                      )}
                                    >
                                      {PERIOD_OPTIONS.map((periodValue) => (
                                        <option key={`${row.key}-end-period-${periodValue}`} value={periodValue}>
                                          {PERIOD_LABEL_MAP[periodValue]}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      value={endPicker.hour12}
                                      onChange={(e) => updateWorkBoundaryTime(
                                        row,
                                        'end_time',
                                        endPicker.period,
                                        e.target.value,
                                        endPicker.minute,
                                        row.defaultEnd
                                      )}
                                    >
                                      {TWELVE_HOUR_OPTIONS.map((hourOption) => (
                                        <option key={`${row.key}-end-hour-${hourOption}`} value={hourOption}>
                                          {hourOption}
                                        </option>
                                      ))}
                                    </select>
                                    <span className={styles.pickerColon}>:</span>
                                    <select
                                      value={endPicker.minute}
                                      onChange={(e) => updateWorkBoundaryTime(
                                        row,
                                        'end_time',
                                        endPicker.period,
                                        endPicker.hour12,
                                        e.target.value,
                                        row.defaultEnd
                                      )}
                                    >
                                      {HALF_HOUR_MINUTE_OPTIONS.map((minuteOption) => (
                                        <option key={`${row.key}-end-minute-${minuteOption}`} value={minuteOption}>
                                          {minuteOption}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className={!isSelectedDateToday ? styles.attendanceDisabled : ''}
                                    value={draft.attendance || 'unmarked'}
                                    disabled={!isSelectedDateToday}
                                    onChange={(e) => updateDraftValue(row.key, 'attendance', e.target.value)}
                                  >
                                    {ATTENDANCE_OPTIONS.map((option) => (
                                      <option key={`${row.key}-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <select
                                    className={!isSelectedDateToday ? styles.attendanceDisabled : ''}
                                    value={currentOffDutyStatus}
                                    disabled={!isSelectedDateToday}
                                    onChange={(e) => handleOffDutyStatusChange(row.key, e.target.value)}
                                  >
                                    {OFF_DUTY_STATUS_OPTIONS.map((option) => (
                                      <option key={`${row.key}-off-duty-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  {requiresActualEndTime ? (
                                    <div className={styles.halfHourPicker}>
                                      <select
                                        className={styles.periodSelect}
                                        disabled={!isSelectedDateToday}
                                        value={actualEndPicker.period}
                                        onChange={(e) => updateDraftTime(
                                          row.key,
                                          'actual_end_time',
                                          e.target.value,
                                          actualEndPicker.hour12,
                                          actualEndPicker.minute,
                                          row.defaultEnd
                                        )}
                                      >
                                        {PERIOD_OPTIONS.map((periodValue) => (
                                          <option key={`${row.key}-actual-end-period-${periodValue}`} value={periodValue}>
                                            {PERIOD_LABEL_MAP[periodValue]}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        disabled={!isSelectedDateToday}
                                        value={actualEndPicker.hour12}
                                        onChange={(e) => updateDraftTime(
                                          row.key,
                                          'actual_end_time',
                                          actualEndPicker.period,
                                          e.target.value,
                                          actualEndPicker.minute,
                                          row.defaultEnd
                                        )}
                                      >
                                        {TWELVE_HOUR_OPTIONS.map((hourOption) => (
                                          <option key={`${row.key}-actual-end-hour-${hourOption}`} value={hourOption}>
                                            {hourOption}
                                          </option>
                                        ))}
                                      </select>
                                      <span className={styles.pickerColon}>:</span>
                                      <select
                                        disabled={!isSelectedDateToday}
                                        value={actualEndPicker.minute}
                                        onChange={(e) => updateDraftTime(
                                          row.key,
                                          'actual_end_time',
                                          actualEndPicker.period,
                                          actualEndPicker.hour12,
                                          e.target.value,
                                          row.defaultEnd
                                        )}
                                      >
                                        {HALF_HOUR_MINUTE_OPTIONS.map((minuteOption) => (
                                          <option key={`${row.key}-actual-end-minute-${minuteOption}`} value={minuteOption}>
                                            {minuteOption}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <span className={styles.mutedText}>-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
};

export default ActualSchedulePage;
