import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import TimeSlotForm from './TimeSlotForm';
import styles from './ReservationManagementPage.module.css';

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

  // 星期順序定義（從一到日）
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

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

  // 按星期順序排序分組的時段
  const sortedGroupedSlots = {};
  dayOrder.forEach(day => {
    if (groupedSlots[day]) {
      sortedGroupedSlots[day] = groupedSlots[day];
    }
  });

  return (
    <div className={styles.timeSlotSettingsContainer}>
      <div className={styles.settingsHeader}>
        <div className={styles.headerLeft}>
          <h2>可訂位時段設定</h2>
          <p className={styles.description}>設定每週的可訂位時段與人數上限</p>
        </div>
        <button className={styles.btnAddSlot} onClick={handleAddNew}>
          <FaPlus /> 新增時段
        </button>
      </div>

      <div className={styles.dayFilter}>
        <label>篩選星期：</label>
        <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
          {Object.entries(daysOfWeek).map(([key, value]) => (
            <option key={key} value={key}>{value}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className={styles.formOverlay}>
          <TimeSlotForm
            slot={editingSlot}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      <div className={styles.slotsList}>
        {Object.keys(sortedGroupedSlots).length === 0 ? (
          <div className={styles.emptyState}>
            <p>尚未設定任何訂位時段</p>
          </div>
        ) : (
          Object.entries(sortedGroupedSlots).map(([day, slots]) => (
            <div key={day} className={styles.dayGroup}>
              <h3 className={styles.dayTitle}>{daysOfWeek[day]}</h3>
              <div className={styles.slotsGrid}>
                {slots.map((slot) => (
                  <div key={slot.id} className={slot.is_active ? styles.slotCard : styles.slotCardInactive}>
                    <div className={styles.slotHeader}>
                      <div className={styles.timeRange}>
                        <strong>
                          {slot.end_time ? `${slot.start_time} - ${slot.end_time}` : slot.start_time}
                        </strong>
                      </div>
                      <div>
                        {slot.is_active ? (
                          <span className={styles.activeBadge}>
                            <FaToggleOn /> 啟用中
                          </span>
                        ) : (
                          <span className={styles.inactiveBadge}>
                            <FaToggleOff /> 已停用
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className={styles.slotBody}>
                      <div className={styles.capacityInfo}>
                        <span className={styles.capacityLabel}>人數上限：</span>
                        <span className={styles.capacityValue}>{slot.max_capacity} 位</span>
                      </div>
                      <div className={styles.capacityInfo}>
                        <span className={styles.capacityLabel}>單筆最多：</span>
                        <span className={styles.capacityValue}>{slot.max_party_size || 10} 位</span>
                      </div>
                    </div>

                    <div className={styles.slotActions}>
                      <button 
                        className={styles.btnEdit}
                        onClick={() => handleEdit(slot)}
                        disabled={slot.has_reservations}
                        title={slot.has_reservations ? "此時段已有訂位，無法編輯" : "編輯時段"}
                      >
                        <FaEdit /> 編輯
                      </button>
                      <button 
                        className={styles.btnSlotDelete}
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
