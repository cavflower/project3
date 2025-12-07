import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { authApi } from '../../api/authApi';
import './LoginPage.css';
import { Link, useSearchParams } from 'react-router-dom';

const CustomerLoginPage = () => {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { email, password } = formData;

    try {
      // 1. Firebase 登入
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const idToken = await firebaseUser.getIdToken();

      // 2. 呼叫 authApi 交換 token 並取得後端使用者資料
      // response.data 會是 { access, refresh, user }
      const backendResponse = await authApi.getBackendTokens(idToken, 'customer');

      // 3. 使用後端回傳的 user 物件進行登入
      if (backendResponse.user) {
        console.log("後端返回的使用者資料:", backendResponse.user);
        
        // 檢查角色是否為 'customer'
        const userType = backendResponse.user.user_type;
        if (!userType) {
          setError('使用者資料不完整，請重新註冊或聯絡管理員。');
          await auth.signOut();
          // 清除所有可能的 token
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('customer_accessToken');
          localStorage.removeItem('customer_refreshToken');
          localStorage.removeItem('merchant_accessToken');
          localStorage.removeItem('merchant_refreshToken');
          setLoading(false);
          return;
        }
        if (userType !== 'customer') {
            setError(`此為${userType === 'merchant' ? '店家' : '未知類型'}帳號，請從正確的登入頁面登入。`);
            await auth.signOut();
            // 清除所有可能的 token（包括舊格式）
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('customer_accessToken');
            localStorage.removeItem('customer_refreshToken');
            localStorage.removeItem('merchant_accessToken');
            localStorage.removeItem('merchant_refreshToken');
            setLoading(false);
            return;
        }
        login(backendResponse.user, redirectUrl);
      } else {
        throw new Error("後端未返回使用者資料");
      }

    } catch (err) {
      console.error("登入流程失敗:", err);
      console.error("錯誤詳情:", err.response?.data || err);
      
      // 如果是 token 相關錯誤，提供更明確的訊息
      if (err.response?.data?.error === 'Invalid Firebase ID token') {
        setError('認證失敗，請重新登入。');
      } else if (err.message.includes('user_type')) {
        setError('使用者類型錯誤，請確認您使用的是正確的登入頁面。');
      } else {
        setError(err.message || '登入失敗，請檢查您的信箱和密碼。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container customer-theme">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>會員登入</h2>
          <p className="form-subtitle">
            還不是會員？ <Link to="/register/customer">立即註冊</Link>
          </p>
          {error && <p className="error-message">{error}</p>}
          <div className="input-group">
            <label htmlFor="email">電子郵件</label>
            <input type="email" id="email" placeholder="請輸入您的電子郵件" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">密碼</label>
            <input type="password" id="password" placeholder="請輸入您的密碼" value={formData.password} onChange={handleChange} required />
          </div>
          <div className="form-footer">
            <Link to="/forgot-password">忘記密碼？</Link>
            {!redirectUrl && <Link to="/login/merchant">切換至店家登入</Link>}
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerLoginPage;
