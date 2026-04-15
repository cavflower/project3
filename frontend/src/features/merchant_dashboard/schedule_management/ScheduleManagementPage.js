import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../store/AuthContext';
import {
  getScheduleData,
  saveScheduleData,
  exportScheduleCSV,
  getEmployeeRequests,
  updateScheduleRequest,
  getJobRoles,
  createJobRole,
  updateJobRole,
  deleteJobRole,
} from '../../../api/scheduleApi';
import styles from './ScheduleManagementPage.module.css';

const calendarWeekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

const requestShiftOptions = [
  { value: 'full_day', label: '整天' },
  { value: 'midnight', label: '凌晨' },
  { value: 'morning', label: '早上' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
];

const requestShiftLabelMap = requestShiftOptions.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const assignmentStatusLabelMap = {
  pending: '待安排',
  scheduled: '已排班',
  rejected: '已排休',
};

const staffStatusOptions = ['在職', '休假', '離職'];

const defaultStaffForm = {
  name: '',
  nickname: '',
  role: '',
  status: '在職',
};

const defaultRoleForm = {
  name: '',
  description: '',
};

const monthTitleFormatter = new Intl.DateTimeFormat('zh-TW', {
  year: 'numeric',
  month: 'long',
});

const dateToString = (dateObj) => (
  `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
    dateObj.getDate()
  ).padStart(2, '0')}`
);

const addDays = (dateValue, days) => {
  const source = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(source.getTime())) return dateValue;
  source.setDate(source.getDate() + days);
  return dateToString(source);
};

const buildCalendarCells = (baseMonthDate) => {
  const year = baseMonthDate.getFullYear();
  const month = baseMonthDate.getMonth();
  const firstDayWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDayWeek; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day);
    cells.push({
      day,
      value: dateToString(cellDate),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const formatPeriodDate = (periodType, dateValue) => {
  if (!dateValue) return '-';
  if (periodType === 'week') return `${dateValue} (週起始)`;
  if (periodType === 'month') return `${dateValue} (月)`;
  return dateValue;
};

const requestMatchesDate = (request, selectedDate) => {
  if (!selectedDate || !request?.date) return false;

  if (request.period_type === 'week') {
    const weekStart = request.week_start_date || request.date;
    const weekEnd = addDays(weekStart, 6);
    return selectedDate >= weekStart && selectedDate <= weekEnd;
  }

  return request.date === selectedDate;
};

const normalizeAssignedSlots = (request) => {
  if (Array.isArray(request.assigned_shift_types) && request.assigned_shift_types.length > 0) {
    return request.assigned_shift_types.filter((slot) => requestShiftLabelMap[slot]);
  }

  if (request.shift_type && request.shift_type !== 'full_day') {
    return [request.shift_type];
  }

  return [];
};

const normalizeAssignedSlotRoles = (request) => {
  if (request && request.assigned_slot_roles && typeof request.assigned_slot_roles === 'object') {
    return Object.entries(request.assigned_slot_roles).reduce((acc, [slot, roleName]) => {
      if (!requestShiftLabelMap[slot]) return acc;
      const normalizedRole = String(roleName || '').trim();
      if (normalizedRole) {
        acc[slot] = normalizedRole;
      }
      return acc;
    }, {});
  }

  return {};
};

const normalizeEmployeeUserId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const dedupeStaffBeforeSave = (staffList) => {
  const byEmployeeUserId = new Map();
  const byName = new Map();

  staffList.forEach((member) => {
    if (!member.name || !member.role) return;

    const normalized = {
      id: member.id,
      name: String(member.name).trim(),
      nickname: String(member.nickname || '').trim(),
      employee_user_id: normalizeEmployeeUserId(member.employee_user_id),
      role: String(member.role).trim(),
      status: String(member.status || '在職').trim() || '在職',
    };

    if (!normalized.name || !normalized.role) return;

    if (normalized.employee_user_id) {
      byEmployeeUserId.set(normalized.employee_user_id, normalized);
      return;
    }

    byName.set(normalized.name.toLowerCase(), normalized);
  });

  const namesOwnedByUserId = new Set(
    Array.from(byEmployeeUserId.values()).map((member) => member.name.toLowerCase())
  );

  const dedupedByName = Array.from(byName.values()).filter(
    (member) => !namesOwnedByUserId.has(member.name.toLowerCase())
  );

  return [
    ...Array.from(byEmployeeUserId.values()),
    ...dedupedByName,
  ];
};

const ScheduleManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const todayDate = useMemo(() => new Date(), []);
  const todayDateValue = useMemo(() => dateToString(todayDate), [todayDate]);

  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [employeeRequests, setEmployeeRequests] = useState([]);
  const [requestRoleDrafts, setRequestRoleDrafts] = useState({});
  const [requestAssignedSlotsDrafts, setRequestAssignedSlotsDrafts] = useState({});
  const [requestSlotRoleDrafts, setRequestSlotRoleDrafts] = useState({});

  const [staffForm, setStaffForm] = useState(defaultStaffForm);
  const [roleForm, setRoleForm] = useState(defaultRoleForm);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingRoleId, setEditingRoleId] = useState(null);

  const [selectedRequestDate, setSelectedRequestDate] = useState(todayDateValue);
  const [requestCalendarMonth, setRequestCalendarMonth] = useState(
    () => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
  );
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');

  const [saveStatus, setSaveStatus] = useState('');

  const loadScheduleData = useCallback(async () => {
    try {
      const response = await getScheduleData();
      const data = response.data || {};

      const formattedShifts = (data.shifts || []).map((shift) => {
        let assignedStaffIds = [];
        if (Array.isArray(shift.assigned_staff) && shift.assigned_staff.length > 0) {
          assignedStaffIds = shift.assigned_staff
            .map((item) => (typeof item === 'object' ? item.id : item))
            .filter((id) => id !== null && id !== undefined);
        }

        return {
          ...shift,
          assignedStaffIds,
          periodType: shift.period_type || 'day',
          staffNeeded: shift.staff_needed,
          startHour: shift.start_hour,
          startMinute: shift.start_minute,
          endHour: shift.end_hour,
          endMinute: shift.end_minute,
          shiftType: shift.shift_type,
        };
      });

      setShifts(formattedShifts);
      const mappedStaff = (data.staff || []).map((member) => ({
        ...member,
        nickname: member.nickname || '',
        employee_user_id: normalizeEmployeeUserId(member.employee_user_id),
        status: member.status || '在職',
      }));
      setStaff(mappedStaff);
    } catch (error) {
      console.error('載入排班資料失敗:', error);
      setShifts([]);
      setStaff([]);
    }
  }, []);

  const loadJobRoleList = useCallback(async () => {
    try {
      const response = await getJobRoles();
      setJobRoles(response.data || []);
    } catch (error) {
      console.error('載入職務清單失敗:', error);
      setJobRoles([]);
    }
  }, []);

  const loadEmployeeRequests = useCallback(async () => {
    try {
      const response = await getEmployeeRequests();
      const requestList = response.data || [];
      setEmployeeRequests(requestList);

      setRequestRoleDrafts(
        requestList.reduce((acc, request) => {
          acc[request.id] = request.role || '';
          return acc;
        }, {})
      );

      setRequestAssignedSlotsDrafts(
        requestList.reduce((acc, request) => {
          acc[request.id] = normalizeAssignedSlots(request);
          return acc;
        }, {})
      );

      setRequestSlotRoleDrafts(
        requestList.reduce((acc, request) => {
          const normalizedRoles = normalizeAssignedSlotRoles(request);
          if (Object.keys(normalizedRoles).length > 0) {
            acc[request.id] = normalizedRoles;
          } else if (request.shift_type !== 'full_day' && (request.role || '').trim()) {
            acc[request.id] = {
              [request.shift_type]: String(request.role || '').trim(),
            };
          } else {
            acc[request.id] = {};
          }
          return acc;
        }, {})
      );

    } catch (error) {
      console.error('載入員工申請失敗:', error);
      setEmployeeRequests([]);
      setRequestRoleDrafts({});
      setRequestAssignedSlotsDrafts({});
      setRequestSlotRoleDrafts({});
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setShifts([]);
      setStaff([]);
      setJobRoles([]);
      setEmployeeRequests([]);
      setRequestRoleDrafts({});
      setRequestAssignedSlotsDrafts({});
      setRequestSlotRoleDrafts({});
      setStaffForm(defaultStaffForm);
      setRoleForm(defaultRoleForm);
      setEditingStaffId(null);
      setEditingRoleId(null);
      return;
    }

    const initializePageData = async () => {
      await loadScheduleData();
      await loadJobRoleList();
      await loadEmployeeRequests();
    };

    initializePageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const summary = useMemo(() => {
    const pending = employeeRequests.filter((request) => (request.assignment_status || 'pending') === 'pending').length;
    const scheduled = employeeRequests.filter((request) => request.assignment_status === 'scheduled').length;
    const rejected = employeeRequests.filter((request) => request.assignment_status === 'rejected').length;

    return {
      pending,
      scheduled,
      rejected,
    };
  }, [employeeRequests]);

  const roleNameOptions = useMemo(
    () => jobRoles.map((role) => role.name),
    [jobRoles]
  );

  const requestCalendarCells = useMemo(
    () => buildCalendarCells(requestCalendarMonth),
    [requestCalendarMonth]
  );

  const requestsBySelectedDate = useMemo(
    () => employeeRequests.filter((request) => requestMatchesDate(request, selectedRequestDate)),
    [employeeRequests, selectedRequestDate]
  );

  const employeeFilterOptions = useMemo(() => {
    const uniqueEmployees = Array.from(
      new Set(requestsBySelectedDate.map((request) => request.employee_name).filter(Boolean))
    );
    return uniqueEmployees.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [requestsBySelectedDate]);

  const shiftFilterOptions = useMemo(() => {
    const options = requestsBySelectedDate.reduce((acc, request) => {
      const value = request.shift_type || '';
      const label = request.shift_type_display || requestShiftLabelMap[value] || value || '-';
      if (value && !acc.some((item) => item.value === value)) {
        acc.push({ value, label });
      }
      return acc;
    }, []);

    return options.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));
  }, [requestsBySelectedDate]);

  const filteredEmployeeRequests = useMemo(
    () => requestsBySelectedDate.filter((request) => {
      const employeeMatched = employeeFilter === 'all' || request.employee_name === employeeFilter;
      const shiftMatched = shiftFilter === 'all' || request.shift_type === shiftFilter;
      return employeeMatched && shiftMatched;
    }),
    [requestsBySelectedDate, employeeFilter, shiftFilter]
  );

  useEffect(() => {
    if (employeeFilter !== 'all' && !employeeFilterOptions.includes(employeeFilter)) {
      setEmployeeFilter('all');
    }
  }, [employeeFilter, employeeFilterOptions]);

  useEffect(() => {
    if (shiftFilter !== 'all' && !shiftFilterOptions.some((item) => item.value === shiftFilter)) {
      setShiftFilter('all');
    }
  }, [shiftFilter, shiftFilterOptions]);

  const goToRequestCalendarMonth = (offset) => {
    setRequestCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const handleRequestDateSelect = (dateValue) => {
    if (!dateValue) return;
    setSelectedRequestDate(dateValue);
    const nextDate = new Date(`${dateValue}T00:00:00`);
    if (!Number.isNaN(nextDate.getTime())) {
      setRequestCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  };

  const hasRequestsOnDate = (dateValue) => employeeRequests.some(
    (request) => requestMatchesDate(request, dateValue)
  );

  const handleStaffFormChange = (event) => {
    const { name, value } = event.target;
    setStaffForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleStaffSubmit = (event) => {
    event.preventDefault();
    const normalizedForm = {
      name: String(staffForm.name || '').trim(),
      nickname: String(staffForm.nickname || '').trim(),
      role: String(staffForm.role || '').trim(),
      status: String(staffForm.status || '在職').trim() || '在職',
    };

    if (!normalizedForm.name || !normalizedForm.role) {
      setSaveStatus('請輸入員工姓名與職稱');
      setTimeout(() => setSaveStatus(''), 2500);
      return;
    }

    if (editingStaffId) {
      setStaff((prev) => prev.map((member) => (
        member.id === editingStaffId
          ? { ...member, ...normalizedForm, status: member.status || '在職' }
          : member
      )));
      setSaveStatus('員工資料已更新，記得按「儲存最新資料」');
    } else {
      setStaff((prev) => [...prev, {
        id: Date.now(),
        ...normalizedForm,
        status: normalizedForm.status || '在職',
        employee_user_id: null,
      }]);
      setSaveStatus('員工已新增，記得按「儲存最新資料」');
    }

    setStaffForm(defaultStaffForm);
    setEditingStaffId(null);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleStaffEdit = (member) => {
    setStaffForm({
      name: member.name || '',
      nickname: member.nickname || '',
      role: member.role || '',
      status: member.status || '在職',
    });
    setEditingStaffId(member.id);
  };

  const handleStaffStatusChange = (id, nextStatus) => {
    setStaff((prev) => prev.map((member) => (
      member.id === id ? { ...member, status: nextStatus } : member
    )));
  };

  const handleStaffTerminate = (id) => {
    if (!window.confirm('確定要解雇此員工嗎？\n儲存最新資料後將從員工列表移除並解除其公司統編綁定。')) {
      return;
    }

    const targetMember = staff.find((member) => member.id === id);
    const shouldUnbindCompany = Boolean(normalizeEmployeeUserId(targetMember?.employee_user_id));

    setStaff((prev) => prev.filter((member) => member.id !== id));
    if (editingStaffId === id) {
      setEditingStaffId(null);
      setStaffForm(defaultStaffForm);
    }
    setSaveStatus(
      shouldUnbindCompany
        ? '員工已從列表移除，儲存後將解除該員工的統編綁定'
        : '員工已從列表移除，記得按「儲存最新資料」'
    );
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleRoleFormChange = (event) => {
    const { name, value } = event.target;
    setRoleForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: roleForm.name.trim(),
      description: roleForm.description.trim(),
    };

    if (!payload.name) {
      setSaveStatus('請輸入職務名稱');
      setTimeout(() => setSaveStatus(''), 2500);
      return;
    }

    try {
      if (editingRoleId) {
        await updateJobRole(editingRoleId, payload);
        setSaveStatus('職務已更新');
      } else {
        await createJobRole(payload);
        setSaveStatus('職務已新增');
      }

      setRoleForm(defaultRoleForm);
      setEditingRoleId(null);
      await loadJobRoleList();
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('儲存職務失敗:', error);
      const errMsg = error.response?.data?.detail || error.response?.data?.name?.[0] || '儲存職務失敗';
      setSaveStatus(errMsg);
      setTimeout(() => setSaveStatus(''), 3500);
    }
  };

  const handleRoleEdit = (roleItem) => {
    setRoleForm({
      name: roleItem.name || '',
      description: roleItem.description || '',
    });
    setEditingRoleId(roleItem.id);
  };

  const handleRoleDelete = async (roleId) => {
    if (!window.confirm('確定要刪除此職務嗎？')) {
      return;
    }

    try {
      await deleteJobRole(roleId);
      await loadJobRoleList();

      if (editingRoleId === roleId) {
        setEditingRoleId(null);
        setRoleForm(defaultRoleForm);
      }

      setSaveStatus('職務已刪除');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('刪除職務失敗:', error);
      setSaveStatus('刪除職務失敗，請稍後再試');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleSaveAll = async () => {
    if (!user) {
      setSaveStatus('請先登入店家帳號');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    try {
      const formattedShifts = shifts
        .map((shift) => ({
          id: shift.id,
          date: shift.date || '',
          period_type: shift.periodType || shift.period_type || 'day',
          shift_type: shift.shiftType || shift.shift_type || 'morning',
          role: shift.role || '',
          staff_needed: parseInt(shift.staffNeeded ?? shift.staff_needed ?? 1, 10),
          start_hour: parseInt(shift.startHour ?? shift.start_hour ?? 8, 10),
          start_minute: parseInt(shift.startMinute ?? shift.start_minute ?? 0, 10),
          end_hour: parseInt(shift.endHour ?? shift.end_hour ?? 12, 10),
          end_minute: parseInt(shift.endMinute ?? shift.end_minute ?? 0, 10),
          assigned_staff_ids: Array.isArray(shift.assignedStaffIds)
            ? shift.assignedStaffIds
            : Array.isArray(shift.assigned_staff)
              ? shift.assigned_staff
                .map((item) => (typeof item === 'object' ? item.id : item))
                .filter((id) => id !== null && id !== undefined)
              : [],
          status: shift.status || 'pending',
        }))
        .filter((shift) => shift.date && shift.role);

      const cleanedStaff = dedupeStaffBeforeSave(staff);

      await saveScheduleData({
        shifts: formattedShifts,
        staff: cleanedStaff,
      });

      await loadScheduleData();
      setSaveStatus('已儲存最新資料');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('儲存排班資料失敗:', error);
      const errMsg = error.response?.data?.error || error.message || '儲存失敗';
      setSaveStatus(`儲存失敗: ${errMsg}`);
      setTimeout(() => setSaveStatus(''), 4000);
    }
  };

  const buildSchedulePayload = (requestItem) => {
    let assignedSlots = requestAssignedSlotsDrafts[requestItem.id] || [];
    let roleName = (requestRoleDrafts[requestItem.id] || '').trim();
    let assignedSlotRoles = {};

    if (requestItem.shift_type === 'full_day') {
      if (assignedSlots.length === 0) {
        return { error: '整天申請需至少選擇一個排班時段' };
      }

      const slotRoleDraft = requestSlotRoleDrafts[requestItem.id] || {};
      const missingRoleSlots = assignedSlots.filter((slot) => !(slotRoleDraft[slot] || '').trim());
      if (missingRoleSlots.length > 0) {
        const slotText = missingRoleSlots.map((slot) => requestShiftLabelMap[slot] || slot).join('、');
        return { error: `以下時段尚未選擇職稱：${slotText}` };
      }

      assignedSlotRoles = assignedSlots.reduce((acc, slot) => {
        acc[slot] = String(slotRoleDraft[slot] || '').trim();
        return acc;
      }, {});

      roleName = Array.from(new Set(Object.values(assignedSlotRoles))).join(' / ');
    } else {
      if (!roleName) {
        return { error: '請先選擇職稱後再排班' };
      }

      assignedSlots = [requestItem.shift_type];
      assignedSlotRoles = {
        [requestItem.shift_type]: roleName,
      };
    }

    return {
      payload: {
        role: roleName,
        assignment_status: 'scheduled',
        assigned_shift_types: assignedSlots,
        assigned_slot_roles: assignedSlotRoles,
      },
    };
  };

  const handleExport = async () => {
    try {
      const response = await exportScheduleCSV();
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8-sig' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `排班表_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('匯出失敗:', error);
      setSaveStatus('匯出失敗，請稍後再試');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleRequestRoleDraftChange = (requestId, roleValue) => {
    setRequestRoleDrafts((prev) => ({
      ...prev,
      [requestId]: roleValue,
    }));
  };

  const handleRequestSlotRoleDraftChange = (requestId, slotValue, roleValue) => {
    setRequestSlotRoleDrafts((prev) => ({
      ...prev,
      [requestId]: {
        ...(prev[requestId] || {}),
        [slotValue]: roleValue,
      },
    }));
  };

  const toggleAssignedSlotDraft = (requestId, slotValue) => {
    setRequestAssignedSlotsDrafts((prev) => {
      const current = prev[requestId] || [];
      const exists = current.includes(slotValue);
      const next = exists ? current.filter((item) => item !== slotValue) : [...current, slotValue];

      return {
        ...prev,
        [requestId]: next,
      };
    });
  };

  const handleScheduleRequest = async (requestItem) => {
    const { payload, error } = buildSchedulePayload(requestItem);
    if (!payload) {
      setSaveStatus(error || '排班資料不完整');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    try {
      await updateScheduleRequest(requestItem.id, payload);

      setSaveStatus('排班成功');
      await loadEmployeeRequests();
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('排班失敗:', error);
      const errMsg = error.response?.data?.detail || error.response?.data?.error || '排班失敗，請稍後再試';
      setSaveStatus(errMsg);
      setTimeout(() => setSaveStatus(''), 3500);
    }
  };

  const handleExecuteSchedule = () => {
    navigate('/merchant/actual-schedule');
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await updateScheduleRequest(requestId, {
        role: '',
        assignment_status: 'rejected',
        assigned_shift_types: [],
        assigned_slot_roles: {},
      });

      setSaveStatus('已排休');
      await loadEmployeeRequests();
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('排休失敗:', error);
      const errMsg = error.response?.data?.detail || error.response?.data?.error || '排休失敗，請稍後再試';
      setSaveStatus(errMsg);
      setTimeout(() => setSaveStatus(''), 3500);
    }
  };

  return (
    <div className={styles.schedulePage}>
      <header className={styles.scheduleHeader}>
        <div>
          <p className={styles.pageSubtitle}>店家管理 / 排班管理</p>
          <h1>排班管理</h1>
          <p className={styles.pageDescription}>管理職務、員工與排班申請（可排班或排休）。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.ghostBtn} onClick={handleSaveAll}>
            儲存最新資料
          </button>
          <button className={styles.ghostBtn} onClick={handleExecuteSchedule}>
            實際班表
          </button>
          <button className={styles.primaryBtn} onClick={handleExport}>
            匯出班表 (CSV)
          </button>
        </div>
      </header>

      {saveStatus && <p className={styles.saveStatus}>{saveStatus}</p>}

      <section className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>待安排申請</p>
          <h2>{summary.pending} 筆</h2>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>已排班</p>
          <h2>{summary.scheduled} 筆</h2>
        </div>
        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>已排休</p>
          <h2>{summary.rejected} 筆</h2>
        </div>
      </section>

      <section className={styles.scheduleCardFullWidth}>
        <div className={styles.cardHeader}>
          <h3>員工排班申請</h3>
        </div>
        <div className={styles.requestFilterPanel}>
          <div className={styles.requestCalendarBlock}>
            <div className={styles.requestCalendarHeader}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => goToRequestCalendarMonth(-1)}
              >
                上個月
              </button>
              <strong>{monthTitleFormatter.format(requestCalendarMonth)}</strong>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => goToRequestCalendarMonth(1)}
              >
                下個月
              </button>
            </div>

            <div className={styles.requestCalendarWeekdays}>
              {calendarWeekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className={styles.requestCalendarGrid}>
              {requestCalendarCells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className={styles.requestCalendarEmptyCell} />;
                }

                const isSelected = cell.value === selectedRequestDate;
                const isToday = cell.value === todayDateValue;
                const hasRequests = hasRequestsOnDate(cell.value);

                return (
                  <button
                    type="button"
                    key={cell.value}
                    className={`${styles.requestCalendarDateBtn} ${
                      isSelected ? styles.requestCalendarDateBtnSelected : ''
                    } ${hasRequests ? styles.requestCalendarDateBtnHasData : ''}`}
                    onClick={() => handleRequestDateSelect(cell.value)}
                  >
                    <span>{cell.day}</span>
                    {isToday && <small>今天</small>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.requestFiltersBlock}>
            <div className={styles.requestFilterItem}>
              <label htmlFor="request_date">已選日期</label>
              <input
                id="request_date"
                type="date"
                value={selectedRequestDate}
                onChange={(e) => handleRequestDateSelect(e.target.value)}
              />
            </div>
            <div className={styles.requestFilterItem}>
              <label htmlFor="employee_filter">篩選員工</label>
              <select
                id="employee_filter"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <option value="all">全部員工</option>
                {employeeFilterOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.requestFilterItem}>
              <label htmlFor="shift_filter">篩選時段</label>
              <select
                id="shift_filter"
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
              >
                <option value="all">全部時段</option>
                {shiftFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className={styles.requestFilterSummary}>
              {selectedRequestDate} 共 {requestsBySelectedDate.length} 筆，篩選後 {filteredEmployeeRequests.length} 筆
            </p>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>可上班時間</th>
                <th>員工可排時段</th>
                <th>店家排班時段</th>
                <th>職務安排</th>
                <th>排班狀態</th>
                <th>備註</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployeeRequests.length === 0 && (
                <tr>
                  <td colSpan="8" className={styles.empty}>
                    所選日期沒有符合篩選條件的排班申請
                  </td>
                </tr>
              )}
              {filteredEmployeeRequests.map((request) => {
                const assignedSlots = requestAssignedSlotsDrafts[request.id] || [];
                const slotRoleDraft = requestSlotRoleDrafts[request.id] || {};
                const assignmentStatus = request.assignment_status || 'pending';

                return (
                  <tr key={request.id}>
                    <td>{request.employee_name}</td>
                    <td>{formatPeriodDate(request.period_type, request.date)}</td>
                    <td>{request.shift_type_display || requestShiftLabelMap[request.shift_type] || request.shift_type || '-'}</td>
                    <td>
                      {request.shift_type === 'full_day' ? (
                        <div className={styles.slotChecklist}>
                          {requestShiftOptions.map((slotOption) => {
                            const checked = assignedSlots.includes(slotOption.value);
                            return (
                              <label key={`${request.id}-${slotOption.value}`} className={styles.slotChecklistItem}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAssignedSlotDraft(request.id, slotOption.value)}
                                />
                                <span>{slotOption.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <span>{request.shift_type_display || requestShiftLabelMap[request.shift_type] || '-'}</span>
                      )}
                    </td>
                    <td>
                      {request.shift_type === 'full_day' ? (
                        <div className={styles.slotRoleGrid}>
                          {assignedSlots.length === 0 && (
                            <p className={styles.helperText}>請先勾選店家排班時段</p>
                          )}
                          {assignedSlots.map((slotValue) => (
                            <label key={`${request.id}-role-${slotValue}`} className={styles.slotRoleItem}>
                              <span>{requestShiftLabelMap[slotValue] || slotValue}</span>
                              <select
                                className={styles.roleInput}
                                value={slotRoleDraft[slotValue] || ''}
                                onChange={(e) => handleRequestSlotRoleDraftChange(request.id, slotValue, e.target.value)}
                              >
                                <option value="">請選擇職務</option>
                                {roleNameOptions.map((roleName) => (
                                  <option key={`${request.id}-${slotValue}-${roleName}`} value={roleName}>
                                    {roleName}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <select
                          className={styles.roleInput}
                          value={requestRoleDrafts[request.id] ?? ''}
                          onChange={(e) => handleRequestRoleDraftChange(request.id, e.target.value)}
                        >
                          <option value="">請選擇職務</option>
                          {roleNameOptions.map((roleName) => (
                            <option key={`${request.id}-${roleName}`} value={roleName}>
                              {roleName}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.assignmentStatusBadge} ${styles[`assignmentStatus${assignmentStatus}`] || ''}`}>
                        {request.assignment_status_display || assignmentStatusLabelMap[assignmentStatus] || assignmentStatus}
                      </span>
                    </td>
                    <td>{request.notes || '-'}</td>
                    <td className={styles.tableActions}>
                      <button
                        className={styles.textBtn}
                        onClick={() => handleScheduleRequest(request)}
                      >
                        排班
                      </button>
                      <button
                        className={styles.textBtnDanger}
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        排休
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.manageGrid}>
        <div className={styles.scheduleCard}>
          <div className={styles.cardHeader}>
            <h3>{editingRoleId ? '編輯職務' : '新增職務'}</h3>
          </div>
          <form className={styles.staffForm} onSubmit={handleRoleSubmit}>
            <label>
              職務名稱
              <input
                type="text"
                name="name"
                value={roleForm.name}
                placeholder="例如：外場、吧台、內場"
                onChange={handleRoleFormChange}
              />
            </label>
            <label>
              職務說明（可選）
              <input
                type="text"
                name="description"
                value={roleForm.description}
                placeholder="例如：負責點餐與收銀"
                onChange={handleRoleFormChange}
              />
            </label>
            <div className={styles.formActions}>
              {editingRoleId && (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => {
                    setEditingRoleId(null);
                    setRoleForm(defaultRoleForm);
                  }}
                >
                  取消編輯
                </button>
              )}
              <button type="submit" className={styles.primaryBtnFill}>
                {editingRoleId ? '更新職務' : '新增職務'}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.scheduleCard}>
          <div className={styles.cardHeader}>
            <h3>{editingStaffId ? '編輯員工' : '新增員工'}</h3>
          </div>
          <form className={styles.staffForm} onSubmit={handleStaffSubmit}>
            <label>
              姓名
              <input type="text" name="name" value={staffForm.name} onChange={handleStaffFormChange} />
            </label>
            <label>
              暱稱
              <input type="text" name="nickname" value={staffForm.nickname} onChange={handleStaffFormChange} />
            </label>
            <label>
              職稱
              <input type="text" name="role" value={staffForm.role} onChange={handleStaffFormChange} />
            </label>
            <div className={styles.formActions}>
              {editingStaffId && (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => {
                    setStaffForm(defaultStaffForm);
                    setEditingStaffId(null);
                  }}
                >
                  取消編輯
                </button>
              )}
              <button type="submit" className={styles.primaryBtnFill}>
                {editingStaffId ? '更新員工' : '新增員工'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className={styles.scheduleCardFullWidth}>
        <div className={styles.cardHeader}>
          <h3>職務列表</h3>
        </div>
        <div className={styles.tableWrapper}>
          <table>
            <thead>
              <tr>
                <th>職務名稱</th>
                <th>說明</th>
                <th>建立時間</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {jobRoles.length === 0 && (
                <tr>
                  <td colSpan="4" className={styles.empty}>
                    尚未新增職務
                  </td>
                </tr>
              )}
              {jobRoles.map((roleItem) => (
                <tr key={roleItem.id}>
                  <td>{roleItem.name}</td>
                  <td>{roleItem.description || '-'}</td>
                  <td>{String(roleItem.created_at || '').slice(0, 10) || '-'}</td>
                  <td className={styles.tableActions}>
                    <button className={styles.textBtn} onClick={() => handleRoleEdit(roleItem)}>
                      編輯
                    </button>
                    <button className={styles.textBtnDanger} onClick={() => handleRoleDelete(roleItem.id)}>
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.scheduleCardFullWidth}>
        <div className={styles.cardHeader}>
          <h3>員工列表</h3>
        </div>
        <div className={styles.tableWrapper}>
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>暱稱</th>
                <th>職稱</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr>
                  <td colSpan="5" className={styles.empty}>
                    尚未新增員工
                  </td>
                </tr>
              )}
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.nickname || '-'}</td>
                  <td>{member.role}</td>
                  <td>
                    <select
                      className={styles.roleInput}
                      value={member.status || '在職'}
                      onChange={(e) => handleStaffStatusChange(member.id, e.target.value)}
                    >
                      {staffStatusOptions.map((statusOption) => (
                        <option key={`${member.id}-${statusOption}`} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.tableActions}>
                    <button className={styles.textBtn} onClick={() => handleStaffEdit(member)}>
                      編輯
                    </button>
                    <button className={styles.textBtnDanger} onClick={() => handleStaffTerminate(member.id)}>
                      解雇
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ScheduleManagementPage;
