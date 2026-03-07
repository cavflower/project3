import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import TimeSlotForm from './TimeSlotForm';
import styles from './SurplusFoodManagement.module.css';

const SurplusTimeSlotList = () => {
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState('');

  // 星期順序定義
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = {
    'monday': '星期一',
    'tuesday': '星期二',
    'wednesday': '星期三',
    'thursday': '星期四',
    'friday': '星期五',
    'saturday': '星期六',
    'sunday': '星期日'
  };

  useEffect(() => {
    loadTimeSlots();
  }, []);

  const loadTimeSlots = async () => {
    try {
      setLoading(true);
      const data = await surplusFoodApi.getTimeSlots();
      setTimeSlots(data);
    } catch (error) {
      console.error('載入時段失敗:', error);
      alert('載入時段失敗');
    } finally {
      setLoading(false);
    }
  };

  // 按星期分組時段
  const groupSlotsByDay = () => {
    const grouped = {};

    // 初始化所有星期
    dayOrder.forEach(day => {
      grouped[day] = [];
    });

    // 將時段分組到對應的星期
    timeSlots.forEach(slot => {
      if (grouped[slot.day_of_week]) {
        grouped[slot.day_of_week].push(slot);
      }
    });

    return grouped;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除嗎？')) return;

    try {
      await surplusFoodApi.deleteTimeSlot(id);
      alert('刪除成功！');
      loadTimeSlots();
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗');
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setModalType('editTimeSlot');
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setModalType('createTimeSlot');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setModalType('');
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (modalType === 'editTimeSlot' && formData.id) {
        // 編輯模式
        await surplusFoodApi.updateTimeSlot(formData.id, formData);
        alert('時段更新成功！');
      } else {
        // 新增模式
        await surplusFoodApi.createTimeSlot(formData);
        alert('時段新增成功！');
      }
      loadTimeSlots();
    } catch (error) {
      console.error('儲存時段失敗:', error);
      throw error; // 讓表單組件處理錯誤
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.contentHeader}>
        <h2>時段設定</h2>
        <button
          className={styles.btnPrimary}
          onClick={handleCreate}
        >
          <FaPlus /> 新增時段
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>載入中...</div>
      ) : (
        <div className={styles.timeslotsContainer}>
          {dayOrder.map(day => {
            const daySlots = groupSlotsByDay()[day];

            // 只顯示有時段的星期
            if (daySlots.length === 0) {
              return null;
            }

            return (
              <div key={day} className={styles.daySection}>
                <h3 className={styles.dayHeader}>{dayLabels[day]}</h3>
                <div className={styles.timeslotsList}>
                  {daySlots.map(slot => (
                    <div key={slot.id} className={styles.timeslotCard}>
                      <div className={styles.timeslotInfo}>
                        <div className={styles.timeslotTime}>
                          {slot.start_time} - {slot.end_time}
                        </div>
                        <div className={styles.timeslotDetails}>
                          <span className={styles.timeslotName}>{slot.name}</span>
                          <span className={slot.is_active ? styles.statusActive : styles.statusInactive}>
                            {slot.is_active ? '啟用中' : '已停用'}
                          </span>
                        </div>
                        <div className={styles.timeslotMeta}>
                        </div>
                      </div>
                      <div className={styles.timeslotActions}>
                        <button
                          className={styles.btnEdit}
                          onClick={() => handleEdit(slot)}
                          title="編輯"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className={styles.btnDelete}
                          onClick={() => handleDelete(slot.id)}
                          title="刪除"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {timeSlots.length === 0 && (
            <div className={styles.emptyState}>
              <p>尚未設定任何時段</p>
              <button
                className={styles.btnPrimary}
                onClick={handleCreate}
              >
                <FaPlus /> 新增第一個時段
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <TimeSlotForm
          type={modalType}
          item={selectedItem}
          onClose={handleCloseModal}
          onSuccess={handleFormSubmit}
        />
      )}
    </div>
  );
};

export default SurplusTimeSlotList;
