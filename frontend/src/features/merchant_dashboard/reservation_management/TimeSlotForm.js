import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

const TimeSlotForm = ({ slot, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    day_of_week: 'monday',
    start_time: '11:30',
    end_time: '',
    max_capacity: 20,
    max_party_size: 10,
    is_active: true,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (slot) {
      setFormData(slot);
    }
  }, [slot]);

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

    // 驗證開始時間和結束時間（只在有設定結束時間時）
    if (formData.end_time && formData.start_time >= formData.end_time) {
      newErrors.end_time = '結束時間不得小於開始時間';
    }

    // 驗證人數上限
    if (formData.max_capacity < 1) {
      newErrors.max_capacity = '人數上限必須大於 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
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
    <div className="time-slot-form-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{slot ? '編輯時段' : '新增時段'}</h2>
          <button className="btn-close" onClick={onCancel}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-body">
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
                <label htmlFor="end_time">結束時間</label>
                <select
                  id="end_time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleChange}
                >
                  <option value="">不設定</option>
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

            <div className="form-group">
              <label htmlFor="max_capacity">人數上限 *</label>
              <input
                type="number"
                id="max_capacity"
                name="max_capacity"
                value={formData.max_capacity}
                onChange={handleChange}
                min="1"
                max="999"
                required
              />
              {errors.max_capacity && (
                <span className="error-message">{errors.max_capacity}</span>
              )}
              <small className="form-hint">
                此時段可容納的最大人數（包含所有訂位）
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="max_party_size">單筆訂位最多人數 *</label>
              <input
                type="number"
                id="max_party_size"
                name="max_party_size"
                value={formData.max_party_size}
                onChange={handleChange}
                min="1"
                max="50"
                required
              />
              {errors.max_party_size && (
                <span className="error-message">{errors.max_party_size}</span>
              )}
              <small className="form-hint">
                單筆訂位可接受的最多人數（大人+小孩）
              </small>
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
                停用後顧客將無法預訂此時段
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              取消
            </button>
            <button type="submit" className="btn-submit">
              {slot ? '更新' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeSlotForm;
