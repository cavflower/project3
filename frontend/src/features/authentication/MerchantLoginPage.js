import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { authApi } from '../../api/authApi';
import './LoginPage.css';
import { Link } from 'react-router-dom';

const MerchantLoginPage = () => {
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
      console.log('=== 開始登入流程 ===');
      console.log('Email:', email);
      
      // 1. Firebase 登入
      console.log('步驟 1: 嘗試 Firebase 登入...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✓ Firebase 登入成功');
      
      const firebaseUser = userCredential.user;
      console.log('Firebase UID:', firebaseUser.uid);
      
      const idToken = await firebaseUser.getIdToken();
      console.log('✓ 獲取 ID Token 成功');

      // 2. 呼叫 authApi 交換 token 並取得後端使用者資料
      // response.data 會是 { access, refresh, user }
      console.log('步驟 2: 呼叫後端 API...');
      const backendResponse = await authApi.getBackendTokens(idToken, 'merchant');
      console.log('✓ 後端 API 回應成功');

      // 3. 使用後端回傳的 user 物件進行登入
      if (backendResponse.user) {
        console.log("後端返回的使用者資料:", backendResponse.user);
        
        // 檢查角色是否為 'merchant'
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
        if (userType !== 'merchant') {
            setError(`此為${userType === 'customer' ? '顧客' : '未知類型'}帳號，請從正確的登入頁面登入。`);
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
        login(backendResponse.user);
      } else {
        throw new Error("後端未返回使用者資料");
      }

    } catch (err) {
      console.error("=== 登入流程失敗 ===");
      console.error("錯誤物件:", err);
      console.error("錯誤代碼:", err.code);
      console.error("錯誤訊息:", err.message);
      console.error("後端回應:", err.response?.data);
      
      // Firebase 特定錯誤處理
      if (err.code === 'auth/invalid-credential') {
        setError('❌ 帳號或密碼錯誤，請確認您輸入的資訊是否正確。如果您是新註冊的商家，請確保已完成 Firebase 註冊流程。');
      } else if (err.code === 'auth/user-not-found') {
        setError('❌ 找不到此帳號。請先註冊商家帳號，或檢查 Email 是否正確。');
      } else if (err.code === 'auth/wrong-password') {
        setError('❌ 密碼錯誤，請重新輸入。');
      } else if (err.code === 'auth/invalid-email') {
        setError('❌ Email 格式不正確。');
      } else if (err.code === 'auth/user-disabled') {
        setError('❌ 此帳號已被停用，請聯繫管理員。');
      } else if (err.code === 'auth/too-many-requests') {
        setError('❌ 登入嘗試次數過多，請稍後再試。');
      }
      // 後端 API 錯誤處理
      else if (err.response?.data?.error === 'Invalid Firebase ID token') {
        setError('❌ 認證失敗，請重新登入。');
      } else if (err.message.includes('user_type')) {
        setError('❌ 使用者類型錯誤，請確認您使用的是正確的登入頁面。');
      } else if (err.response?.status === 401) {
        setError('❌ 認證失敗，請檢查您的帳號權限。');
      } else {
        setError(err.message || '❌ 登入失敗，請檢查您的信箱和密碼，或聯繫技術支援。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container merchant-theme">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>店家管理登入</h2>
          <p className="form-subtitle">
            還沒有店家帳號？ <Link to="/register/merchant">立即註冊</Link>
          </p>
          {error && <p className="error-message">{error}</p>}
          <div className="input-group">
            <label htmlFor="email">店家聯絡信箱</label>
            <input type="email" id="email" placeholder="請輸入您的電子郵件" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">密碼</label>
            <input type="password" id="password" placeholder="請輸入您的密碼" value={formData.password} onChange={handleChange} required />
          </div>
          <div className="form-footer">
            <Link to="/forgot-password">忘記密碼？</Link>
            <Link to="/login/customer">切換至會員登入</Link>
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MerchantLoginPage;
