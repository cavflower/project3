import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../authentication/LoginPage.css';

const AdminLoginPage = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 硬編碼的管理員帳號密碼
  const ADMIN_USERNAME = '123123';
  const ADMIN_PASSWORD = '123123';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { username, password } = formData;

    // 驗證帳號密碼
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // 登入成功，儲存管理員狀態
      localStorage.setItem('admin_logged_in', 'true');
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 500);
    } else {
      setError('帳號或密碼錯誤');
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container admin-theme">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>平台管理員登入</h2>
          <p className="form-subtitle">
            DineVerse 後台管理系統
          </p>
          {error && <p className="error-message">{error}</p>}
          <div className="input-group">
            <label htmlFor="username">帳號</label>
            <input 
              type="text" 
              id="username" 
              placeholder="請輸入管理員帳號" 
              value={formData.username} 
              onChange={handleChange} 
              required 
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">密碼</label>
            <input 
              type="password" 
              id="password" 
              placeholder="請輸入密碼" 
              value={formData.password} 
              onChange={handleChange} 
              required 
            />
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
