import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import './RegisterPage.css';

const CustomerRegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyTaxId: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { email, password, confirmPassword, username } = formData;

    if (password !== confirmPassword) {
      setError('密碼不相符');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: username,
      });

      const backendData = {
        firebase_uid: user.uid,
        email: user.email,
        username: username,
        user_type: 'customer',
        company_tax_id: formData.companyTaxId.trim() || null,
      };

      const response = await fetch('http://127.0.0.1:8000/api/users/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendData),
      });

      if (!response.ok) {
        // 檢查回應的 Content-Type，如果是 JSON 才解析
        const contentType = response.headers.get('content-type');
        let errorMessage = '後台儲存失敗';
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = `後台儲存失敗: ${JSON.stringify(errorData)}`;
          } catch (e) {
            errorMessage = `後台儲存失敗: HTTP ${response.status} ${response.statusText}`;
          }
        } else {
          errorMessage = `後台儲存失敗: HTTP ${response.status} ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setLoading(false);
      navigate('/login/customer');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container customer-theme">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>建立新帳戶</h2>
          <p className="form-subtitle">
            已經有帳戶了？ <Link to="/login/customer">立即登入</Link>
          </p>
          {error && <p className="error-message">{error}</p>}
          <div className="input-group">
            <label htmlFor="username">使用者名稱</label>
            <input type="text" id="username" placeholder="請輸入您的暱稱" value={formData.username} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="email">電子郵件</label>
            <input type="email" id="email" placeholder="請輸入您的電子郵件" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">密碼</label>
            <input type="password" id="password" placeholder="至少 6 個字元" value={formData.password} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="confirmPassword">確認密碼</label>
            <input type="password" id="confirmPassword" placeholder="再次輸入密碼" value={formData.confirmPassword} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="companyTaxId">公司統編 <span style={{ color: '#999', fontSize: '0.9em' }}>(選填)</span></label>
            <input 
              type="text" 
              id="companyTaxId" 
              placeholder="請輸入公司統編" 
              value={formData.companyTaxId} 
              onChange={handleChange}
              maxLength="8"
            />
          </div>
          <div className="form-footer">
            <Link to="/register/merchant">切換至店家註冊</Link>
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '註冊中...' : '註冊'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerRegisterPage;
