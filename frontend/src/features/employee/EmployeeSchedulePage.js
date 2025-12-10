import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getAllShiftsForEmployee, applyForShift, getMyApplications, proposeShiftByEmployee } from '../../api/scheduleApi';
import './EmployeeSchedulePage.css';

const shiftPresets = {
  morning: { label: '早班' },
  noon: { label: '午班' },
  evening: { label: '晚班' },
};

const formatTwoDigits = (value) => String(value).padStart(2, '0');

const formatTimeRange = (shift) => {
  const startHour = shift.start_hour || shift.startHour || 0;
  const startMinute = shift.start_minute || shift.startMinute || 0;
  const endHour = shift.end_hour || shift.endHour || 0;
  const endMinute = shift.end_minute || shift.endMinute || 0;
  return `${formatTwoDigits(startHour)}:${formatTwoDigits(startMinute)} - ${formatTwoDigits(endHour)}:${formatTwoDigits(endMinute)}`;
};

const EmployeeSchedulePage = () => {
  const { user } = useAuth();
  const [allShifts, setAllShifts] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedShift, setSelectedShift] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newShift, setNewShift] = useState({
    date: '',
    start_time: '08:00',
    end_time: '12:00',
    message: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shiftsRes, applicationsRes] = await Promise.all([
        getAllShiftsForEmployee().catch(err => {
          console.error('載入排班失敗:', err);
          if (err.response?.status === 403 || err.response?.status === 401) {
            return { data: [] };
          }
          throw err;
        }),
        getMyApplications().catch(err => {
          console.error('載入申請記錄失敗:', err);
          if (err.response?.status === 403 || err.response?.status === 401) {
            return { data: [] };
          }
          throw err;
        }),
      ]);
      setAllShifts(shiftsRes.data || []);
      setMyApplications(applicationsRes.data || []);
    } catch (error) {
      console.error('載入資料失敗:', error);
      setAllShifts([]);
      setMyApplications([]);
    } finally {
      setLoading(false);
    }
  };

  // 檢查排班的申請狀態
  const getShiftApplicationStatus = (shift) => {
    // 先檢查是否有申請記錄
    const application = myApplications.find(app => app.shift_info?.id === shift.id);
    if (application) {
      return {
        status: application.status,
        application: application
      };
    }
    
    // 檢查是否已被指派
    const assignedStaff = shift.assigned_staff || [];
    const staffProfileId = user?.staff_profile?.id;
    
    if (staffProfileId) {
      const isAssigned = assignedStaff.some(staff => {
        const staffId = typeof staff === 'object' ? staff.id : staff;
        return staffId === staffProfileId;
      });
      
      if (isAssigned) {
        return { status: 'assigned', application: null };
      }
    }
    
    // 檢查是否可以申請
    const assignedCount = assignedStaff.length;
    const staffNeeded = shift.staff_needed || shift.staffNeeded || 1;
    const canApply = assignedCount < staffNeeded;
    
    return { status: canApply ? 'available' : 'full', application: null };
  };

  const handleApply = (shift) => {
    setSelectedShift(shift);
    setMessage('');
    setShowApplyModal(true);
  };

  const handleNewShiftChange = (e) => {
    const { name, value } = e.target;
    setNewShift((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    if (!newShift.date) {
      alert('請填寫日期');
      return;
    }
    setCreating(true);
    try {
      await proposeShiftByEmployee(newShift);
      alert('已提交排班，請等待店長確認');
      // 重置表單
      setNewShift({
        date: '',
        start_time: '08:00',
        end_time: '12:00',
        message: '',
      });
      loadData();
    } catch (error) {
      console.error('提交排班失敗:', error?.response?.data || error);
      const errorData = error.response?.data;
      const errorMsg =
        (errorData && (errorData.error || errorData.detail || JSON.stringify(errorData))) ||
        error.message ||
        '提交失敗，請稍後再試';
      alert(errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!selectedShift) return;

    try {
      await applyForShift({
        shift: selectedShift.id,
        message: message.trim(),
      });
      alert('申請成功！');
      setShowApplyModal(false);
      setSelectedShift(null);
      setMessage('');
      loadData();
    } catch (error) {
      console.error('申請失敗:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.detail || '申請失敗，請稍後再試';
      alert(errorMsg);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      weekday: 'short'
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { text: '待確認', class: 'status-pending' },
      approved: { text: '已確認', class: 'status-approved' },
      rejected: { text: '已拒絕', class: 'status-rejected' },
      assigned: { text: '已指派', class: 'status-assigned' },
      available: { text: '可申請', class: 'status-available' },
      full: { text: '已滿員', class: 'status-full' },
    };
    const statusInfo = statusMap[status] || { text: status, class: '' };
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  if (loading) {
    return (
      <div className="employee-schedule-page">
        <div className="loading">載入中...</div>
      </div>
    );
  }

  return (
    <div className="employee-schedule-page schedule-management-style">
      <header className="schedule-header">
          <div>
            <p className="page-subtitle">員工功能 / 排班申請</p>
            <h1>排班申請</h1>
            <p className="page-description">填寫可工作的時段，店長會在店家帳號看到並確認。</p>
          </div>
      </header>

        <section className="schedule-card">
          <div className="card-header">
            <h3>新增排班時段</h3>
            <p>填寫想要的班別，店長會在店家帳號看到並確認</p>
          </div>
          <form className="shift-form" onSubmit={handleCreateShift}>
            <label>
              日期
              <input type="date" name="date" value={newShift.date} onChange={handleNewShiftChange} required />
            </label>
            <label>
              開始時間
              <input type="time" name="start_time" value={newShift.start_time} onChange={handleNewShiftChange} required />
            </label>
            <label>
              結束時間
              <input type="time" name="end_time" value={newShift.end_time} onChange={handleNewShiftChange} required />
            </label>
            <label>
              備註（選填）
              <textarea
                name="message"
                placeholder="可填寫希望原因或備註"
                value={newShift.message}
                onChange={handleNewShiftChange}
                rows={3}
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary-btn fill" disabled={creating}>
                {creating ? '提交中...' : '新增時段'}
              </button>
            </div>
          </form>
        </section>

      {/* 申請 Modal */}
      {showApplyModal && selectedShift && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>申請排班</h2>
            <div className="modal-shift-info">
              <p><strong>日期：</strong>{formatDate(selectedShift.date)}</p>
              <p><strong>時段：</strong>{shiftPresets[selectedShift.shift_type || selectedShift.shiftType]?.label || ''} ({formatTimeRange(selectedShift)})</p>
              <p><strong>職務：</strong>{selectedShift.role}</p>
            </div>
            <div className="form-group">
              <label htmlFor="message">備註（選填）</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="請填寫申請理由或備註..."
                rows={4}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowApplyModal(false);
                  setSelectedShift(null);
                  setMessage('');
                }}
              >
                取消
              </button>
              <button
                className="btn-submit"
                onClick={handleSubmitApplication}
              >
                確認申請
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSchedulePage;
