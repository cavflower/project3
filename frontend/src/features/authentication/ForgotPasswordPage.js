import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import './ForgotPasswordPage.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    // 簡單的 email 格式驗證
    if (!email || !email.includes('@')) {
      setError('請輸入有效的電子郵件地址');
      setLoading(false);
      return;
    }

    try {
      // 使用 Firebase 發送密碼重置郵件
      await sendPasswordResetEmail(auth, email, {
        url: window.location.origin + '/customer-login', // 重置後導向的頁面
        handleCodeInApp: false,
      });
      
      setSuccess(true);
      setLoading(false);
      
      // 3 秒後自動導向登入頁
      setTimeout(() => {
        navigate('/customer-login');
      }, 3000);

    } catch (err) {
      console.error('發送密碼重置郵件失敗:', err);
      
      // 根據不同的錯誤代碼顯示不同的錯誤訊息
      switch (err.code) {
        case 'auth/user-not-found':
          setError('找不到此電子郵件對應的帳號');
          break;
        case 'auth/invalid-email':
          setError('電子郵件格式不正確');
          break;
        case 'auth/too-many-requests':
          setError('請求次數過多，請稍後再試');
          break;
        default:
          setError('發送重置郵件失敗，請稍後再試');
      }
      
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        <div className="forgot-password-header">
          <h1>忘記密碼</h1>
          <p className="subtitle">請輸入您的電子郵件地址，我們將發送密碼重置連結給您</p>
        </div>

        {success ? (
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>郵件已發送！</h2>
            <p>
              我們已將密碼重置連結發送到 <strong>{email}</strong>
            </p>
            <p className="instruction">
              請檢查您的電子郵件信箱（包括垃圾郵件），點擊連結重置密碼。
            </p>
            <p className="redirect-notice">
              即將自動返回登入頁面...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="forgot-password-form">
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠</span>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">電子郵件</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="請輸入您的電子郵件"
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
            >
              {loading ? '發送中...' : '發送重置郵件'}
            </button>

            <div className="back-to-login">
              <button 
                type="button"
                onClick={() => navigate('/customer-login')}
                className="back-btn"
                disabled={loading}
              >
                ← 返回登入
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
