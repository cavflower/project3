import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import './TimeSlotForm.css';

const TimeSlotForm = ({ type, item, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    day_of_week: 'monday',
    start_time: '11:30',
    end_time: '14:00',
    is_active: true,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item && type === 'editTimeSlot') {
      // 處理時間格式：如果是 "HH:MM:SS" 格式，只取前 5 個字元 "HH:MM"
      const formatTime = (time) => {
        if (!time) return '11:30';
        return time.length > 5 ? time.substring(0, 5) : time;
      };

      setFormData({
        name: item.name || '',
        day_of_week: item.day_of_week || 'monday',
        start_time: formatTime(item.start_time),
        end_time: formatTime(item.end_time),
        is_active: item.is_active !== undefined ? item.is_active : true,
      });
    }
  }, [item, type]);

  const daysOfWeek = [
    { value: 'monday', label: '星期一' },
    { value: 'tuesday', label: '星期二' },
    { value: 'wednesday', label: '星期三' },
    { value: 'thursday', label: '星期四' },
    { value: 'friday', label: '星期五' },
    { value: 'saturday', label: '星期六' },
    { value: 'sunday', label: '星期日' },
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    // 清除該欄位的錯誤
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // 驗證時段名稱
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = '請輸入時段名稱';
    }

    // 驗證時間範圍
    if (formData.start_time >= formData.end_time) {
      newErrors.end_time = '結束時間必須晚於開始時間';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      // 準備提交的資料
      const submitData = {
        ...formData,
      };

      // 如果是編輯模式，帶上 id
      if (type === 'editTimeSlot' && item?.id) {
        submitData.id = item.id;
      }

      await onSuccess(submitData);
      onClose();
    } catch (error) {
      console.error('提交表單失敗:', error);
      setErrors({ 
        submit: error.response?.data?.message || '提交失敗，請稍後再試' 
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(time);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  return (
    <div className="modal-overlay">
      <div className="modal-content time-slot-form-modal">
        <div className="modal-header">
          <h2>
            {type === 'createTimeSlot' && '新增惜福時段'}
            {type === 'editTimeSlot' && '編輯惜福時段'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body form-body">
            {/* 操作標題提示 */}
            <div className="form-operation-title">
              {type === 'createTimeSlot' && (
                <>
                  <span className="operation-icon">➕</span>
                  <span>新增惜福時段</span>
                </>
              )}
              {type === 'editTimeSlot' && item && (
                <>
                  <span className="operation-icon">✏️</span>
                  <span>編輯時段：{item.name}</span>
                </>
              )}
            </div>

            {errors.submit && (
              <div className="error-banner">
                {errors.submit}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="name">時段名稱 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="例如：午餐惜福、晚餐惜福"
                className={errors.name ? 'error' : ''}
                required
              />
              {errors.name && (
                <span className="error-message">{errors.name}</span>
              )}
              <small className="form-hint">
                為此惜福時段設定一個易於識別的名稱
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="day_of_week">星期 *</label>
              <select
                id="day_of_week"
                name="day_of_week"
                value={formData.day_of_week}
                onChange={handleChange}
                required
              >
                {daysOfWeek.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_time">開始時間 *</label>
                <select
                  id="start_time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleChange}
                  required
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="end_time">結束時間 *</label>
                <select
                  id="end_time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleChange}
                  className={errors.end_time ? 'error' : ''}
                  required
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
                {errors.end_time && (
                  <span className="error-message">{errors.end_time}</span>
                )}
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span>啟用此時段</span>
              </label>
              <small className="form-hint">
                停用後將無法在此時段新增惜福食品
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '處理中...' : (type === 'editTimeSlot' ? '更新' : '新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeSlotForm;
