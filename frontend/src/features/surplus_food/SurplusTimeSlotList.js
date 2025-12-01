import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import TimeSlotForm from './TimeSlotForm';

const SurplusTimeSlotList = () => {
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState('');

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
    <div className="surplus-tab-content">
      <div className="surplus-content-header">
        <h2>時段設定</h2>
        <button 
          className="surplus-btn-primary"
          onClick={handleCreate}
        >
          <FaPlus /> 新增時段
        </button>
      </div>

      {loading ? (
        <div className="loading">載入中...</div>
      ) : (
        <div className="timeslots-list">
          {timeSlots.map(slot => (
            <div key={slot.id} className="timeslot-card">
              <div className="timeslot-info">
                <h3>{slot.name}</h3>
                <div className="timeslot-details">
                  <span>{slot.day_of_week_display}</span>
                  <span>{slot.start_time} - {slot.end_time}</span>
                  <span className={slot.is_active ? 'status-active' : 'status-inactive'}>
                    {slot.is_active ? '啟用中' : '已停用'}
                  </span>
                </div>
              </div>
              <div className="timeslot-actions">
                <button 
                  className="btn-icon"
                  onClick={() => handleEdit(slot)}
                >
                  <FaEdit />
                </button>
                <button 
                  className="btn-icon"
                  onClick={() => handleDelete(slot.id)}
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
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
