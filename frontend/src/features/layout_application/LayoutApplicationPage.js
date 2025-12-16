import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getCompanyStores, submitScheduleRequest, getMyScheduleRequests, deleteScheduleRequest } from '../../api/scheduleApi';
import './LayoutApplicationPage.css';

const SHIFT_TYPES = [
  { value: 'morning', label: '早班' },
  { value: 'noon', label: '午班' },
  { value: 'evening', label: '晚班' },
];

const LayoutApplicationPage = () => {
  const authContext = useAuth();
  const user = authContext?.user || null;
  const authLoading = authContext?.loading !== undefined ? authContext.loading : true;
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [weekStartDate, setWeekStartDate] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 計算當週週一日期
  const getWeekStart = (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 調整為週一開始
    return new Date(d.setDate(diff));
  };

  const loadStores = useCallback(async () => {
    if (!user || !user.company_tax_id) {
      return;
    }
    try {
      setError(''); // 清除之前的錯誤
      const response = await getCompanyStores();
      const storesData = response.data || [];
      setStores(storesData);
      if (storesData.length > 0) {
        setSelectedStore(storesData[0].id.toString());
      } else {
        // 不要設定錯誤，只是沒有店家而已
        setSelectedStore('');
      }
    } catch (err) {
      console.error('載入店家列表失敗:', err);
      const errorMsg = err.response?.data?.error || err.message || '載入店家列表失敗';
      setError(errorMsg);
      // 即使載入失敗，也設定空陣列避免後續錯誤
      setStores([]);
      setSelectedStore('');
    }
  }, [user]);

  const loadMyRequests = useCallback(async () => {
    if (!user || !user.company_tax_id) {
      return;
    }
    try {
      const response = await getMyScheduleRequests();
      setRequests(response.data || []);
    } catch (err) {
      console.error('載入申請記錄失敗:', err);
      // 靜默失敗，不顯示錯誤訊息
      setRequests([]);
    }
  }, [user]);

  useEffect(() => {
    // 只在用戶有統編時才載入資料
    if (user && user.company_tax_id) {
      try {
        loadStores();
        loadMyRequests();
        // 設定預設週起始日期為本週週一
        const weekStart = getWeekStart();
        setWeekStartDate(weekStart.toISOString().split('T')[0]);
      } catch (err) {
        console.error('載入資料時發生錯誤:', err);
        setError('載入資料時發生錯誤，請重新整理頁面');
      }
    } else {
      // 如果沒有統編，清空資料
      setStores([]);
      setRequests([]);
      setSelectedStore('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.company_tax_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData(e.target);
    const date = formData.get('date');
    const shiftType = formData.get('shift_type');
    const role = formData.get('role');
    const notes = formData.get('notes');

    if (!selectedStore || !date || !shiftType || !role) {
      setError('請填寫所有必填欄位');
      setLoading(false);
      return;
    }

    try {
      const weekStart = getWeekStart(new Date(date));
      await submitScheduleRequest({
        store: parseInt(selectedStore),
        date: date,
        shift_type: shiftType,
        role: role,
        notes: notes || '',
        week_start_date: weekStart.toISOString().split('T')[0],
      });

      setSuccess('排班申請已提交！');
      e.target.reset();
      loadMyRequests();
    } catch (err) {
      console.error('提交申請失敗:', err);
      setError(err.response?.data?.error || '提交申請失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除此申請嗎？')) {
      return;
    }

    try {
      await deleteScheduleRequest(id);
      setSuccess('申請已刪除');
      loadMyRequests();
    } catch (err) {
      console.error('刪除申請失敗:', err);
      setError('刪除申請失敗');
    }
  };

  // 如果認證還在載入中，顯示載入狀態
  if (authLoading) {
    return (
      <div className="layout-application-page">
        <div className="container">
          <div className="error-message">
            <p>載入中...</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果用戶不存在，顯示錯誤
  if (!user) {
    return (
      <div className="layout-application-page">
        <div className="container">
          <div className="error-message">
            <p>請先登入</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果用戶沒有統編，顯示錯誤訊息
  if (!user.company_tax_id) {
    return (
      <div className="layout-application-page">
        <div className="container">
          <div className="error-message">
            <p>只有公司員工才能使用此功能</p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              請在註冊時填寫公司統編
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-application-page">
      <div className="container">
        <h1>排版申請</h1>
        <p className="page-description">請填寫您本週可行的排班時段</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="form-section">
          <h2>新增排班申請</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="store">選擇店家 *</label>
              <select
                id="store"
                value={selectedStore || ''}
                onChange={(e) => setSelectedStore(e.target.value)}
                required
                disabled={stores.length === 0}
              >
                <option value="">{stores.length === 0 ? '暫無可用店家' : '請選擇店家'}</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name || `店家 ${store.id}`}
                  </option>
                ))}
              </select>
              {stores.length === 0 && (
                <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem' }}>
                  <p>目前沒有可用的店家</p>
                  <p style={{ marginTop: '0.25rem', color: '#666' }}>
                    可能原因：
                  </p>
                  <ul style={{ marginTop: '0.25rem', paddingLeft: '1.5rem', color: '#666' }}>
                    <li>與您統編相同的商家尚未創建店家</li>
                    <li>請確認您的統編是否正確，或聯繫管理員協助</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="date">日期 *</label>
              <input
                type="date"
                id="date"
                name="date"
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="form-group">
              <label htmlFor="shift_type">時段 *</label>
              <select id="shift_type" name="shift_type" required>
                <option value="">請選擇時段</option>
                {SHIFT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="role">職務 *</label>
              <input
                type="text"
                id="role"
                name="role"
                placeholder="例如：服務生、廚師、收銀員"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">備註</label>
              <textarea
                id="notes"
                name="notes"
                rows="3"
                placeholder="可選填，例如：可支援加班、只能上半天等"
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '提交中...' : '提交申請'}
            </button>
          </form>
        </div>

        <div className="requests-section">
          <h2>我的申請記錄</h2>
          {requests.length === 0 ? (
            <p className="empty-message">尚無申請記錄</p>
          ) : (
            <table className="requests-table">
              <thead>
                <tr>
                  <th>店家</th>
                  <th>日期</th>
                  <th>時段</th>
                  <th>職務</th>
                  <th>備註</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(request => (
                  <tr key={request.id || Math.random()}>
                    <td>{request.store_name || '-'}</td>
                    <td>{request.date || '-'}</td>
                    <td>{request.shift_type_display || request.shift_type || '-'}</td>
                    <td>{request.role || '-'}</td>
                    <td>{request.notes || '-'}</td>
                    <td>
                      {request.id && (
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(request.id)}
                        >
                          刪除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayoutApplicationPage;

