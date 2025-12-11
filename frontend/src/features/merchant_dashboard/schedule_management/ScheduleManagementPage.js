import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../store/AuthContext';
import { getScheduleData, saveScheduleData, exportScheduleCSV } from '../../../api/scheduleApi';
import './ScheduleManagementPage.css';

const shiftPresets = {
  morning: {
    label: '早班',
    defaultStart: { hour: 8, minute: 0 },
    defaultEnd: { hour: 12, minute: 0 },
  },
  noon: {
    label: '午班',
    defaultStart: { hour: 12, minute: 0 },
    defaultEnd: { hour: 17, minute: 0 },
  },
  evening: {
    label: '晚班',
    defaultStart: { hour: 17, minute: 0 },
    defaultEnd: { hour: 22, minute: 0 },
  },
};

const formatTwoDigits = (value) => String(value).padStart(2, '0');

const defaultShiftForm = {
  date: '',
  shiftType: 'morning',
  role: '',
  staffNeeded: 1,
  startHour: shiftPresets.morning.defaultStart.hour,
  startMinute: shiftPresets.morning.defaultStart.minute,
  endHour: shiftPresets.morning.defaultEnd.hour,
  endMinute: shiftPresets.morning.defaultEnd.minute,
  assignedStaffIds: [],
  status: 'pending',
};

const defaultStaffForm = {
  name: '',
  role: '',
  status: '',
};

const initialStaff = [
  { id: 1, name: '小美', role: '外場', status: '本週可排' },
  { id: 2, name: '阿強', role: '外場', status: '可支援午班' },
  { id: 3, name: '庭瑜', role: '吧台', status: '夜班首選' },
  { id: 4, name: '阿傑', role: '主廚', status: '午班固定' },
  { id: 5, name: '心怡', role: '甜點', status: '可支援任何時段' },
];

const buildShiftName = ({ shiftType, startHour, startMinute, endHour, endMinute }) => {
  const presetLabel = shiftPresets[shiftType]?.label || '';
  return `${presetLabel} (${formatTwoDigits(startHour)}:${formatTwoDigits(startMinute)} - ${formatTwoDigits(
    endHour
  )}:${formatTwoDigits(endMinute)})`;
};

const initialShifts = [
  {
    id: 1,
    date: '2025-11-21',
    shiftType: 'morning',
    role: '外場服務',
    staffNeeded: 3,
    startHour: shiftPresets.morning.defaultStart.hour,
    startMinute: shiftPresets.morning.defaultStart.minute,
    endHour: shiftPresets.morning.defaultEnd.hour,
    endMinute: shiftPresets.morning.defaultEnd.minute,
    assignedStaffIds: [],
    status: 'pending',
    shiftName: buildShiftName({
      shiftType: 'morning',
      startHour: shiftPresets.morning.defaultStart.hour,
      startMinute: shiftPresets.morning.defaultStart.minute,
      endHour: shiftPresets.morning.defaultEnd.hour,
      endMinute: shiftPresets.morning.defaultEnd.minute,
    }),
  },
  {
    id: 2,
    date: '2025-11-21',
    shiftType: 'evening',
    role: '內場廚房',
    staffNeeded: 2,
    startHour: shiftPresets.evening.defaultStart.hour,
    startMinute: shiftPresets.evening.defaultStart.minute,
    endHour: shiftPresets.evening.defaultEnd.hour,
    endMinute: shiftPresets.evening.defaultEnd.minute,
    assignedStaffIds: [],
    status: 'pending',
    shiftName: buildShiftName({
      shiftType: 'evening',
      startHour: shiftPresets.evening.defaultStart.hour,
      startMinute: shiftPresets.evening.defaultStart.minute,
      endHour: shiftPresets.evening.defaultEnd.hour,
      endMinute: shiftPresets.evening.defaultEnd.minute,
    }),
  },
];

const statusOptions = [
  { value: 'ready', label: '準備就緒' },
  { value: 'ongoing', label: '進行中' },
  { value: 'pending', label: '待排班' },
];

const ScheduleManagementPage = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [shiftForm, setShiftForm] = useState(defaultShiftForm);
  const [staffForm, setStaffForm] = useState(defaultStaffForm);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  // 當用戶改變時，從 API 載入該店家的資料
  useEffect(() => {
    if (!user) {
      setShifts([]);
      setStaff([]);
      setShiftForm(defaultShiftForm);
      setStaffForm(defaultStaffForm);
      setEditingShiftId(null);
      setEditingStaffId(null);
      return;
    }

    const loadScheduleData = async () => {
      try {
        const response = await getScheduleData();
        const data = response.data;
        
        // 轉換 API 資料格式為前端格式
        if (data.shifts) {
          const formattedShifts = data.shifts.map(shift => {
            // 確保 assignedStaffIds 正確設置
            let assignedStaffIds = [];
            if (Array.isArray(shift.assigned_staff) && shift.assigned_staff.length > 0) {
              assignedStaffIds = shift.assigned_staff.map(s => (typeof s === 'object' ? s.id : s)).filter(id => id != null && id !== undefined);
            }
            
            return {
              ...shift,
              assignedStaffIds: assignedStaffIds,
              staffNeeded: shift.staff_needed,
              startHour: shift.start_hour,
              startMinute: shift.start_minute,
              endHour: shift.end_hour,
              endMinute: shift.end_minute,
              shiftType: shift.shift_type,
              // 保留 assigned_staff 以便向後兼容，但優先使用 assignedStaffIds
            };
          });
          setShifts(formattedShifts);
        } else {
          setShifts([]);
        }
        
        if (data.staff) {
          setStaff(data.staff);
        } else {
          setStaff([]);
        }
      } catch (error) {
        console.error('載入排班資料失敗:', error);
        console.error('錯誤詳情:', error.response?.data);
        // 如果是 401 或 403 錯誤，顯示特定訊息
        if (error.response?.status === 401 || error.response?.status === 403) {
          // 權限錯誤，但不顯示在頁面上，只在控制台記錄
          console.warn('權限不足，請確認您已登入店家帳號');
        } else if (error.response?.status === 404) {
          // API 不存在，但不顯示錯誤
          console.warn('API 路徑不存在');
        } else if (error.response?.status === 500) {
          // 500 錯誤可能是資料表不存在，不顯示錯誤，只記錄
          console.warn('伺服器錯誤（可能是資料表尚未建立）:', error.response?.data?.error);
        } else {
          // 其他錯誤，只在控制台記錄，不顯示在頁面上
          console.warn('載入資料時發生錯誤:', error.response?.data?.error || error.message);
        }
        // 無論如何都設置為空資料，不顯示錯誤訊息
        setShifts([]);
        setStaff([]);
      }
      // 注意：不在載入資料後重置表單，避免用戶輸入時被清空
      // 表單狀態應該由用戶操作來控制，而不是由資料載入來控制
    };

    loadScheduleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // 只依賴 user.id，避免 user 對象變化時重新執行

  const staffIdSet = useMemo(() => new Set(staff.map((member) => member.id)), [staff]);

  const summary = useMemo(() => {
    const totalNeeded = shifts.reduce((sum, shift) => sum + (shift.staffNeeded || shift.staff_needed || 0), 0);
    const assignedIds = shifts.reduce((acc, shift) => {
      const ids = shift.assignedStaffIds || (shift.assigned_staff ? shift.assigned_staff.map(s => s.id) : []);
      return acc.concat(ids);
    }, []);
    const totalAssigned = assignedIds.filter((id) => staffIdSet.has(id)).length;
    return {
      totalNeeded,
      totalAssigned,
      shortage: Math.max(totalNeeded - totalAssigned, 0),
    };
  }, [shifts, staffIdSet]);

  const handleShiftFormChange = (event) => {
    const { name, value } = event.target;
    setShiftForm((prev) => ({
      ...prev,
      [name]:
        name === 'staffNeeded' ||
        name === 'startHour' ||
        name === 'startMinute' ||
        name === 'endHour' ||
        name === 'endMinute'
          ? Number(value)
          : value,
    }));
  };

  const handleStaffFormChange = (event) => {
    const { name, value } = event.target;
    setStaffForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTimeInputChange = (field, value, max) => {
    const sanitized = value.replace(/[^\d]/g, '');
    const numeric = sanitized === '' ? 0 : Math.min(max, Math.max(0, Number(sanitized)));
    setShiftForm((prev) => ({
      ...prev,
      [field]: numeric,
    }));
  };

  const handleShiftSubmit = (event) => {
    event.preventDefault();
    if (!shiftForm.date || !shiftForm.role) return;

    const shiftName = buildShiftName(shiftForm);
    // 確保 assignedStaffIds 是陣列
    const assignedStaffIds = Array.isArray(shiftForm.assignedStaffIds) 
      ? shiftForm.assignedStaffIds.filter(id => id != null && id !== undefined)
      : [];

    if (editingShiftId) {
      setShifts((prev) =>
        prev.map((shift) =>
          shift.id === editingShiftId
            ? { 
                ...shift, 
                ...shiftForm, 
                shiftName, 
                assignedStaffIds: assignedStaffIds,
                // 確保移除舊的 assigned_staff 欄位，避免混淆
                assigned_staff: undefined
              }
            : shift
        )
      );
    } else {
      setShifts((prev) => [
        ...prev,
        {
          id: Date.now(),
          ...shiftForm,
          shiftName,
          assignedStaffIds: assignedStaffIds,
        },
      ]);
    }

    setShiftForm(defaultShiftForm);
    setEditingShiftId(null);
  };

  const handleStaffSubmit = (event) => {
    event.preventDefault();
    if (!staffForm.name || !staffForm.role) return;

    if (editingStaffId) {
      setStaff((prev) =>
        prev.map((member) =>
          member.id === editingStaffId ? { ...member, ...staffForm } : member
        )
      );
    } else {
      setStaff((prev) => [
        ...prev,
        { id: Date.now(), ...staffForm },
      ]);
    }

    setStaffForm(defaultStaffForm);
    setEditingStaffId(null);
  };

  const handleShiftEdit = (shift) => {
    // 確保 assignedStaffIds 正確讀取
    let assignedStaffIds = [];
    if (Array.isArray(shift.assignedStaffIds)) {
      assignedStaffIds = shift.assignedStaffIds.filter(id => id != null && id !== undefined);
    } else if (Array.isArray(shift.assigned_staff) && shift.assigned_staff.length > 0) {
      assignedStaffIds = shift.assigned_staff.map(s => (typeof s === 'object' ? s.id : s)).filter(id => id != null && id !== undefined);
    }
    
    setShiftForm({
      date: shift.date,
      shiftType: shift.shiftType || shift.shift_type,
      role: shift.role,
      staffNeeded: shift.staffNeeded || shift.staff_needed,
      startHour: shift.startHour || shift.start_hour,
      startMinute: shift.startMinute || shift.start_minute,
      endHour: shift.endHour || shift.end_hour,
      endMinute: shift.endMinute || shift.end_minute,
      assignedStaffIds: assignedStaffIds,
      status: shift.status,
    });
    setEditingShiftId(shift.id);
  };

  const handleStaffEdit = (member) => {
    setStaffForm({
      name: member.name,
      role: member.role,
      status: member.status,
    });
    setEditingStaffId(member.id);
  };

  const handleShiftDelete = (id) => {
    setShifts((prev) => prev.filter((shift) => shift.id !== id));
    if (editingShiftId === id) {
      setShiftForm(defaultShiftForm);
      setEditingShiftId(null);
    }
  };

  const handleStaffDelete = (id) => {
    setStaff((prev) => prev.filter((member) => member.id !== id));
    setShifts((prev) =>
      prev.map((shift) => {
        // 確保正確讀取和更新 assignedStaffIds
        let assignedIds = [];
        if (Array.isArray(shift.assignedStaffIds)) {
          assignedIds = shift.assignedStaffIds;
        } else if (Array.isArray(shift.assigned_staff) && shift.assigned_staff.length > 0) {
          assignedIds = shift.assigned_staff.map(s => (typeof s === 'object' ? s.id : s));
        }
        
        return {
          ...shift,
          assignedStaffIds: assignedIds.filter((staffId) => staffId !== id),
          assigned_staff: undefined, // 移除舊的 assigned_staff 欄位
        };
      })
    );
    if (editingStaffId === id) {
      setStaffForm(defaultStaffForm);
      setEditingStaffId(null);
    }
  };

  const handleExport = async () => {
    if (!shifts.length) return;
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
      console.error('Failed to export schedule:', error);
      setSaveStatus('匯出失敗，請稍後再試');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const assignedIdsExceptCurrent = useMemo(() => {
    const ids = new Set();
    shifts.forEach((shift) => {
      if (shift.id === editingShiftId) return;
      // 確保正確讀取 assignedStaffIds
      let assignedIds = [];
      if (Array.isArray(shift.assignedStaffIds)) {
        assignedIds = shift.assignedStaffIds;
      } else if (Array.isArray(shift.assigned_staff) && shift.assigned_staff.length > 0) {
        assignedIds = shift.assigned_staff.map(s => (typeof s === 'object' ? s.id : s));
      }
      assignedIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [shifts, editingShiftId]);

  const availableStaffForForm = staff.filter(
    (member) => !assignedIdsExceptCurrent.has(member.id) || shiftForm.assignedStaffIds.includes(member.id)
  );

  const handleStaffSelectChange = (event) => {
    const values = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
    setShiftForm((prev) => ({
      ...prev,
      assignedStaffIds: values,
    }));
  };

  const formatTimeRange = (shift) => {
    const startHour = shift.startHour ?? shift.start_hour ?? 0;
    const startMinute = shift.startMinute ?? shift.start_minute ?? 0;
    const endHour = shift.endHour ?? shift.end_hour ?? 0;
    const endMinute = shift.endMinute ?? shift.end_minute ?? 0;
    return `${formatTwoDigits(startHour)}:${formatTwoDigits(startMinute)} - ${formatTwoDigits(endHour)}:${formatTwoDigits(endMinute)}`;
  };

  const handleSaveAll = async () => {
    if (!user) {
      setSaveStatus('請先登入店家帳號');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    
    try {
      // 轉換前端格式為 API 格式
      // 只發送有真實資料庫 ID 的資料（臨時 ID 會被當作新資料處理）
      // 去重：根據 date, shift_type, role, start_hour, start_minute, end_hour, end_minute 組合去重
      const uniqueShifts = [];
      const shiftKeys = new Set();
      
      for (const shift of shifts) {
        if (!shift.id && !shift.date) continue; // 跳過無效資料
        
        // 為每個排班創建唯一鍵（用於去重）
        const key = `${shift.date}_${shift.shiftType || shift.shift_type}_${shift.role}_${shift.startHour || shift.start_hour}_${shift.startMinute || shift.start_minute}_${shift.endHour || shift.end_hour}_${shift.endMinute || shift.end_minute}`;
        
        // 如果已經有相同的排班（除了 ID），只保留有 ID 的那個，或者第一個
        if (!shiftKeys.has(key)) {
          shiftKeys.add(key);
          uniqueShifts.push(shift);
        } else {
          // 如果已經存在，保留有資料庫 ID 的那個（ID 較小的通常是資料庫 ID）
          const existingIndex = uniqueShifts.findIndex(s => {
            const existingKey = `${s.date}_${s.shiftType || s.shift_type}_${s.role}_${s.startHour || s.start_hour}_${s.startMinute || s.start_minute}_${s.endHour || s.end_hour}_${s.endMinute || s.end_minute}`;
            return existingKey === key;
          });
          
          if (existingIndex !== -1) {
            const existing = uniqueShifts[existingIndex];
            // 如果新的有 ID 且舊的沒有，或者新的 ID 更小（更可能是資料庫 ID），則替換
            if (shift.id && (!existing.id || (existing.id > 1000000000000 && shift.id < 1000000000000))) {
              uniqueShifts[existingIndex] = shift;
            }
          }
        }
      }
      
      console.log(`去重前: ${shifts.length} 個排班, 去重後: ${uniqueShifts.length} 個排班`);
      
      const formattedShifts = uniqueShifts
        .filter(shift => {
          // 過濾掉沒有 ID 且沒有必填欄位的資料
          const id = shift.id;
          if (!id && (!shift.date || !shift.role)) return false;
          return true;
        })
        .map(shift => {
          // 確保所有必填欄位都有正確的值和類型
          const startHour = parseInt(shift.startHour ?? shift.start_hour ?? 0, 10);
          const startMinute = parseInt(shift.startMinute ?? shift.start_minute ?? 0, 10);
          const endHour = parseInt(shift.endHour ?? shift.end_hour ?? 0, 10);
          const endMinute = parseInt(shift.endMinute ?? shift.end_minute ?? 0, 10);
          const staffNeeded = parseInt(shift.staffNeeded ?? shift.staff_needed ?? 1, 10);
          
          return {
            id: shift.id,
            date: shift.date || '',
            shift_type: shift.shiftType || shift.shift_type || 'morning',
            role: shift.role || '',
            staff_needed: staffNeeded,
            start_hour: startHour,
            start_minute: startMinute,
            end_hour: endHour,
            end_minute: endMinute,
            assigned_staff_ids: (() => {
              // 確保 assigned_staff_ids 總是陣列格式
              if (Array.isArray(shift.assignedStaffIds)) {
                return shift.assignedStaffIds.filter(id => id != null && id !== undefined);
              }
              if (Array.isArray(shift.assigned_staff) && shift.assigned_staff.length > 0) {
                return shift.assigned_staff.map(s => (typeof s === 'object' ? s.id : s)).filter(id => id != null && id !== undefined);
              }
              return [];
            })(),
            status: shift.status || 'pending',
          };
        })
        .filter(shift => {
          // 驗證必填欄位
          return shift.date && shift.shift_type && shift.role;
        });
      
      // 清理 staff 資料，移除不需要的欄位，並去重
      const uniqueStaff = [];
      const staffKeys = new Set();
      
      for (const s of staff) {
        if (!s.id) continue;
        
        // 根據 ID 去重
        if (!staffKeys.has(s.id)) {
          staffKeys.add(s.id);
          uniqueStaff.push(s);
        }
      }
      
      console.log(`員工去重前: ${staff.length} 個, 去重後: ${uniqueStaff.length} 個`);
      
      const cleanedStaff = uniqueStaff.map(s => ({
        id: s.id,
        name: s.name,
        role: s.role,
        status: s.status || '',
      }));
      
      const payload = {
        shifts: formattedShifts,
        staff: cleanedStaff,
      };
      
      // 調試日誌：檢查發送的資料
      console.log('準備儲存的資料:', JSON.stringify(payload, null, 2));
      console.log('排班資料中的 assigned_staff_ids:', formattedShifts.map(s => ({ id: s.id, assigned_staff_ids: s.assigned_staff_ids })));
      
      const response = await saveScheduleData(payload);
      
      // 強制重新載入資料，確保取得最新的資料庫狀態（避免重複）
      let data;
      try {
        const reloadResponse = await getScheduleData();
        data = reloadResponse.data;
      } catch (reloadError) {
        console.warn('重新載入資料失敗:', reloadError);
        // 如果重新載入失敗，嘗試使用後端返回的資料
        data = response?.data;
      }
      
      // 轉換 API 資料格式為前端格式，並去重
      if (data && data.shifts) {
        console.log('後端返回的 shifts 資料:', JSON.stringify(data.shifts, null, 2));
        
        // 先轉換格式
        const formattedShifts = data.shifts.map(shift => {
          // 確保 assignedStaffIds 正確設置
          let assignedStaffIds = [];
          if (Array.isArray(shift.assigned_staff) && shift.assigned_staff.length > 0) {
            assignedStaffIds = shift.assigned_staff.map(s => (typeof s === 'object' ? s.id : s)).filter(id => id != null && id !== undefined);
          }
          
          return {
            ...shift,
            assignedStaffIds: assignedStaffIds,
            staffNeeded: shift.staff_needed,
            startHour: shift.start_hour,
            startMinute: shift.start_minute,
            endHour: shift.end_hour,
            endMinute: shift.end_minute,
            shiftType: shift.shift_type,
          };
        });
        
        // 根據 ID 去重（保留最後一個）
        const uniqueShiftsMap = new Map();
        formattedShifts.forEach(shift => {
          if (shift.id) {
            uniqueShiftsMap.set(shift.id, shift);
          }
        });
        const uniqueShifts = Array.from(uniqueShiftsMap.values());
        
        console.log(`去重前: ${formattedShifts.length} 個排班, 去重後: ${uniqueShifts.length} 個排班`);
        setShifts(uniqueShifts);
      } else {
        setShifts([]);
      }
      
      if (data && data.staff) {
        // 根據 ID 去重員工（保留最後一個）
        const uniqueStaffMap = new Map();
        data.staff.forEach(member => {
          if (member.id) {
            uniqueStaffMap.set(member.id, member);
          }
        });
        const uniqueStaff = Array.from(uniqueStaffMap.values());
        console.log(`員工去重前: ${data.staff.length} 個, 去重後: ${uniqueStaff.length} 個`);
        setStaff(uniqueStaff);
      } else {
        setStaff([]);
      }
      
      setSaveStatus('已儲存最新資料');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('儲存排班資料失敗:', error);
      console.error('錯誤詳情:', error.response?.data);
      // 顯示詳細錯誤訊息
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        let errorMsg = '';
        
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.details) {
          // 如果有詳細的驗證錯誤，顯示具體的欄位錯誤
          const details = errorData.details;
          const fieldErrors = Object.entries(details)
            .map(([field, errors]) => {
              const fieldName = field === 'shifts' ? '排班時段' : field === 'staff' ? '員工' : field;
              const errorList = Array.isArray(errors) ? errors.join(', ') : String(errors);
              return `${fieldName}: ${errorList}`;
            })
            .join('; ');
          errorMsg = fieldErrors || errorData.error || errorData.detail || '資料格式錯誤';
        } else {
          errorMsg = errorData.error || errorData.detail || JSON.stringify(errorData);
        }
        
        setSaveStatus(`儲存失敗: ${errorMsg}`);
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        setSaveStatus('權限不足，請確認您已登入店家帳號');
      } else {
        const errorMsg = error.response?.data?.error || error.response?.data?.detail || error.message || '儲存失敗，請稍後再試';
        setSaveStatus(`儲存失敗: ${errorMsg}`);
      }
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  return (
    <div className="schedule-page">
      <header className="schedule-header">
        <div>
          <p className="page-subtitle">店家管理 / 排班管理</p>
          <h1>排班管理</h1>
          <p className="page-description">規劃日常班表、管理員工資料並可匯出班表。</p>
        </div>
        <div className="header-actions">
          <button className="ghost-btn" onClick={handleSaveAll}>
            儲存最新資料
          </button>
          <button className="primary-btn" onClick={handleExport}>
            匯出班表 (CSV)
          </button>
        </div>
      </header>
      {saveStatus && <p className="save-status">{saveStatus}</p>}

      <section className="summary-grid">
        <div className="summary-card">
          <p className="summary-label">需求人數</p>
          <h2>{summary.totalNeeded} 位</h2>
        </div>
        <div className="summary-card">
          <p className="summary-label">已排人數</p>
          <h2>{summary.totalAssigned} 位</h2>
        </div>
        <div className="summary-card">
          <p className="summary-label">缺口</p>
          <h2 className={summary.shortage ? 'text-warning' : ''}>
            {summary.shortage ? `缺 ${summary.shortage} 位` : '0'}
          </h2>
        </div>
      </section>

      <section className="manage-grid">
        <div className="schedule-card">
          <div className="card-header">
            <h3>{editingShiftId ? '編輯排班時段' : '新增排班時段'}</h3>
          </div>
          <form className="shift-form" onSubmit={handleShiftSubmit}>
            <label>
              日期
              <input type="date" name="date" value={shiftForm.date} onChange={handleShiftFormChange} />
            </label>
            <label>
              時段名稱
              <select
                name="shiftType"
                value={shiftForm.shiftType}
                onChange={(e) => {
                  const type = e.target.value;
                  setShiftForm((prev) => ({
                    ...prev,
                    shiftType: type,
                    startHour: shiftPresets[type].defaultStart.hour,
                    startMinute: shiftPresets[type].defaultStart.minute,
                    endHour: shiftPresets[type].defaultEnd.hour,
                    endMinute: shiftPresets[type].defaultEnd.minute,
                  }));
                }}
              >
                {Object.entries(shiftPresets).map(([value, info]) => (
                  <option key={value} value={value}>
                    {info.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              需求職務
              <input
                type="text"
                name="role"
                value={shiftForm.role}
                placeholder="外場／內場／外送"
                onChange={handleShiftFormChange}
              />
            </label>
            <label className="time-inputs">
              開始時間
              <div className="time-pickers">
                <input
                  type="text"
                  inputMode="numeric"
                  min="0"
                  max="23"
                  name="startHour"
                  value={formatTwoDigits(shiftForm.startHour)}
                  onChange={(e) => handleTimeInputChange('startHour', e.target.value, 23)}
                />
                <span>:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  name="startMinute"
                  value={formatTwoDigits(shiftForm.startMinute)}
                  onChange={(e) => handleTimeInputChange('startMinute', e.target.value, 59)}
                />
              </div>
            </label>
            <label className="time-inputs">
              結束時間
              <div className="time-pickers">
                <input
                  type="text"
                  inputMode="numeric"
                  min="0"
                  max="23"
                  name="endHour"
                  value={formatTwoDigits(shiftForm.endHour)}
                  onChange={(e) => handleTimeInputChange('endHour', e.target.value, 23)}
                />
                <span>:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  name="endMinute"
                  value={formatTwoDigits(shiftForm.endMinute)}
                  onChange={(e) => handleTimeInputChange('endMinute', e.target.value, 59)}
                />
              </div>
            </label>
            <label>
              需求人數
              <input
                type="number"
                min="1"
                name="staffNeeded"
                value={shiftForm.staffNeeded}
                onChange={handleShiftFormChange}
              />
            </label>
            <label>
              已指派員工
              {availableStaffForForm.length === 0 && shiftForm.assignedStaffIds.length === 0 ? (
                <div className="no-staff-box">目前沒有可指派員工</div>
              ) : (
                <>
                  <select
                    multiple
                    className="staff-multi-select"
                    value={shiftForm.assignedStaffIds.map(String)}
                    onChange={handleStaffSelectChange}
                  >
                    {availableStaffForForm.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}（{member.role}）
                      </option>
                    ))}
                  </select>
                  <p className="helper-text">提示：按住 Ctrl 或 ⌘ 可多選員工</p>
                </>
              )}
              {shiftForm.assignedStaffIds.length > 0 && (
                <div className="selected-staff">
                  {shiftForm.assignedStaffIds.map((staffId) => {
                    const member = staff.find((item) => item.id === staffId);
                    if (!member) return null;
                    return (
                      <span key={member.id} className="staff-chip selected">
                        {member.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </label>
            <label>
              狀態
              <select name="status" value={shiftForm.status} onChange={handleShiftFormChange}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              {editingShiftId && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setShiftForm(defaultShiftForm);
                    setEditingShiftId(null);
                  }}
                >
                  取消編輯
                </button>
              )}
              <button type="submit" className="primary-btn fill">
                {editingShiftId ? '更新時段' : '新增時段'}
              </button>
            </div>
          </form>
        </div>

        <div className="schedule-card">
          <div className="card-header">
            <h3>{editingStaffId ? '編輯員工' : '新增員工'}</h3>
          </div>
          <form className="staff-form" onSubmit={handleStaffSubmit}>
            <label>
              姓名
              <input type="text" name="name" value={staffForm.name} onChange={handleStaffFormChange} />
            </label>
            <label>
              職務
              <input type="text" name="role" value={staffForm.role} onChange={handleStaffFormChange} />
            </label>
            <label>
              備註／出勤狀態
              <input type="text" name="status" value={staffForm.status} onChange={handleStaffFormChange} />
            </label>
            <div className="form-actions">
              {editingStaffId && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setStaffForm(defaultStaffForm);
                    setEditingStaffId(null);
                  }}
                >
                  取消編輯
                </button>
              )}
              <button type="submit" className="primary-btn fill">
                {editingStaffId ? '更新員工' : '新增員工'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="schedule-card full-width">
        <div className="card-header">
          <h3>排班列表</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>時段</th>
                <th>職務 / 時間</th>
                <th>需求人數</th>
                <th>已排人員</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty">
                    尚未建立任何班表
                  </td>
                </tr>
              )}
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  <td>{shift.date}</td>
                  <td>
                    <p className="table-shift-name">{shiftPresets[shift.shiftType || shift.shift_type].label}</p>
                    <p className="table-shift-time">{formatTimeRange(shift)}</p>
                  </td>
                  <td>{shift.role}</td>
                  <td>{shift.staffNeeded || shift.staff_needed}</td>
                  <td>
                    {(() => {
                      // 確保正確讀取 assignedStaffIds
                      let assignedIds = [];
                      if (Array.isArray(shift.assignedStaffIds)) {
                        assignedIds = shift.assignedStaffIds;
                      } else if (Array.isArray(shift.assigned_staff) && shift.assigned_staff.length > 0) {
                        assignedIds = shift.assigned_staff.map(s => (typeof s === 'object' ? s.id : s));
                      }
                      
                      const names = assignedIds
                        .map((id) => staff.find((member) => member.id === id)?.name)
                        .filter(Boolean);
                      
                      return names.length > 0 ? names.join(', ') : '-';
                    })()}
                  </td>
                  <td>{statusOptions.find((opt) => opt.value === shift.status)?.label || shift.status}</td>
                  <td className="table-actions">
                    <button className="text-btn" onClick={() => handleShiftEdit(shift)}>
                      編輯
                    </button>
                    <button className="text-btn danger" onClick={() => handleShiftDelete(shift.id)}>
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="schedule-card full-width">
        <div className="card-header">
          <h3>員工列表</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>姓名</th>
                <th>職務</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty">
                    尚未新增員工
                  </td>
                </tr>
              )}
              {staff.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.role}</td>
                  <td>{member.status || '-'}</td>
                  <td className="table-actions">
                    <button className="text-btn" onClick={() => handleStaffEdit(member)}>
                      編輯
                    </button>
                    <button className="text-btn danger" onClick={() => handleStaffDelete(member.id)}>
                      刪除
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

