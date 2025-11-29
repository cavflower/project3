import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import TimeSlotForm from './TimeSlotForm';

const TimeSlotSettings = ({ timeSlots, onSave, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [selectedDay, setSelectedDay] = useState('all');

  useEffect(() => {
    if (showForm) {
      // 當表單顯示時，滾動到頁面中間位置
      const scrollToMiddle = () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const middlePosition = (documentHeight - windowHeight) / 2;
        window.scrollTo({ top: Math.max(0, middlePosition), behavior: 'smooth' });
      };
      
      // 使用 setTimeout 確保 DOM 已更新
      setTimeout(scrollToMiddle, 100);
    }
  }, [showForm]);

  const daysOfWeek = {
    all: '全部',
    monday: '星期一',
    tuesday: '星期二',
    wednesday: '星期三',
    thursday: '星期四',
    friday: '星期五',
    saturday: '星期六',
    sunday: '星期日',
  };

  const handleAddNew = () => {
    setEditingSlot(null);
    setShowForm(true);
  };

  const handleEdit = (slot) => {
    setEditingSlot(slot);
    setShowForm(true);
  };

  const handleFormSubmit = (slotData) => {
    onSave(slotData);
    setShowForm(false);
    setEditingSlot(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSlot(null);
  };

  const filteredSlots = selectedDay === 'all' 
    ? timeSlots 
    : timeSlots.filter(slot => slot.day_of_week === selectedDay);

  const groupedSlots = filteredSlots.reduce((acc, slot) => {
    const day = slot.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {});

  return (
    <div className="time-slot-settings-container">
      <div className="settings-header">
        <div className="header-left">
          <h2>可訂位時段設定</h2>
          <p className="description">設定每週的可訂位時段與人數上限</p>
        </div>
        <button className="btn-add-slot" onClick={handleAddNew}>
          <FaPlus /> 新增時段
        </button>
      </div>

      <div className="day-filter">
        <label>篩選星期：</label>
        <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
          {Object.entries(daysOfWeek).map(([key, value]) => (
            <option key={key} value={key}>{value}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="form-overlay">
          <TimeSlotForm
            slot={editingSlot}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      <div className="slots-list">
        {Object.keys(groupedSlots).length === 0 ? (
          <div className="empty-state">
            <p>尚未設定任何訂位時段</p>
            <button className="btn-primary" onClick={handleAddNew}>
              立即新增
            </button>
          </div>
        ) : (
          Object.entries(groupedSlots).map(([day, slots]) => (
            <div key={day} className="day-group">
              <h3 className="day-title">{daysOfWeek[day]}</h3>
              <div className="slots-grid">
                {slots.map((slot) => (
                  <div key={slot.id} className={`slot-card ${!slot.is_active ? 'inactive' : ''}`}>
                    <div className="slot-header">
                      <div className="time-range">
                        <strong>
                          {slot.end_time ? `${slot.start_time} - ${slot.end_time}` : slot.start_time}
                        </strong>
                      </div>
                      <div className="slot-status">
                        {slot.is_active ? (
                          <span className="active-badge">
                            <FaToggleOn /> 啟用中
                          </span>
                        ) : (
                          <span className="inactive-badge">
                            <FaToggleOff /> 已停用
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="slot-body">
                      <div className="capacity-info">
                        <span className="label">人數上限：</span>
                        <span className="value">{slot.max_capacity} 位</span>
                      </div>
                      <div className="capacity-info">
                        <span className="label">單筆最多：</span>
                        <span className="value">{slot.max_party_size || 10} 位</span>
                      </div>
                    </div>

                    <div className="slot-actions">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEdit(slot)}
                        disabled={slot.has_reservations}
                        title={slot.has_reservations ? "此時段已有訂位，無法編輯" : "編輯時段"}
                      >
                        <FaEdit /> 編輯
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => onDelete(slot.id)}
                        disabled={slot.has_reservations}
                        title={slot.has_reservations ? "此時段已有訂位，無法刪除" : "刪除時段"}
                      >
                        <FaTrash /> 刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TimeSlotSettings;
