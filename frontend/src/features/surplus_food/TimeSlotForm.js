import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import styles from './TimeSlotForm.module.css';

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
  const [peakHourWarning, setPeakHourWarning] = useState('');

  // 檢查是否在尖峰時段
  const checkPeakHours = (startTime, endTime) => {
    if (!startTime || !endTime) return '';

    const start = startTime.split(':').map(Number);
    const end = endTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];

    // 如果結束時間是 00:00，表示跨日到午夜
    const isMidnight = endTime === '00:00';

    // 尖峰時段定義
    const peakHours = [
      { start: 8 * 60, end: 13 * 60, name: '早午餐尖峰（08:00-13:00）' },
      { start: 17 * 60, end: 19 * 60, name: '晚餐尖峰（17:00-19:00）' }
    ];

    for (const peak of peakHours) {
      if (isMidnight) {
        // 跨日時段，只要開始時間不在尖峰時段內即可
        if (peak.start <= startMinutes && startMinutes < peak.end) {
          return `⚠️ 此時段與${peak.name}重疊，無法設定惜福時段`;
        }
      } else {
        // 一般時段，檢查時段是否與尖峰時段重疊
        if (!(endMinutes <= peak.start || startMinutes >= peak.end)) {
          return `⚠️ 此時段與${peak.name}重疊，無法設定惜福時段`;
        }
      }
    }

    return '';
  };

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
    const newFormData = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    };

    setFormData(newFormData);

    // 當時間改變時，檢查是否在尖峰時段
    if (name === 'start_time' || name === 'end_time') {
      const warning = checkPeakHours(
        name === 'start_time' ? value : newFormData.start_time,
        name === 'end_time' ? value : newFormData.end_time
      );
      setPeakHourWarning(warning);
    }

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

    // 驗證時間範圍（允許結束時間為 00:00 表示跨日到午夜）
    const isMidnight = formData.end_time === '00:00';
    if (!isMidnight && formData.start_time >= formData.end_time) {
      newErrors.end_time = '結束時間必須晚於開始時間（或設為 00:00 表示營業至午夜）';
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
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} ${styles.formModal}`}>
        <div className={styles.modalHeader}>
          <h2>
            {type === 'createTimeSlot' && '新增惜福時段'}
            {type === 'editTimeSlot' && '編輯惜福時段'}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formBody}>
            {/* 操作標題提示 */}
            <div className={styles.formOperationTitle}>
              {type === 'createTimeSlot' && (
                <>
                  <span className={styles.operationIcon}>➕</span>
                  <span>新增惜福時段</span>
                </>
              )}
              {type === 'editTimeSlot' && item && (
                <>
                  <span className={styles.operationIcon}>✏️</span>
                  <span>編輯時段：{item.name}</span>
                </>
              )}
            </div>

            {errors.submit && (
              <div className={styles.errorBanner}>
                {errors.submit}
              </div>
            )}

            {/* 尖峰時段警告 */}
            {peakHourWarning && (
              <div className={styles.warningBanner}>
                {peakHourWarning}
              </div>
            )}

            {/* 時段設定提示 */}
            <div className={styles.infoBanner}>
              <strong>📌 惜福時段設定說明：</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li>惜福時段<strong>不能設在尖峰時段</strong>（08:00-13:00, 17:00-19:00）</li>
                <li>建議設定時段：13:00-17:00（午後）或 19:00 之後（晚餐後）</li>
                <li>同一天不能有重複的時段設定</li>
                <li>結束時間可設為 <strong>00:00</strong> 表示營業至午夜（跨日）</li>
              </ul>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="name">時段名稱 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="例如：午餐惜福、晚餐惜福"
                className={errors.name ? styles.inputError : ''}
                required
              />
              {errors.name && (
                <span className={styles.errorMessage}>{errors.name}</span>
              )}
              <small className={styles.formHint}>
                為此惜福時段設定一個易於識別的名稱
              </small>
            </div>

            <div className={styles.formGroup}>
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

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
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

              <div className={styles.formGroup}>
                <label htmlFor="end_time">結束時間 *</label>
                <select
                  id="end_time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleChange}
                  className={errors.end_time ? styles.inputError : ''}
                  required
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
                {errors.end_time && (
                  <span className={styles.errorMessage}>{errors.end_time}</span>
                )}
              </div>
            </div>

            <div className={`${styles.formGroup} ${styles.checkboxGroup}`}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span>啟用此時段</span>
              </label>
              <small className={styles.formHint}>
                停用後將無法在此時段新增惜福食品
              </small>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? '處理中...' : (type === 'editTimeSlot' ? '更新' : '新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeSlotForm;
