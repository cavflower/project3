import React, { useState } from 'react';
// 1. 移除 useNavigate，因為 AuthContext 會幫我们處理導航
// import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import './LoginPage.css';

// 1. (新增) 引入 useAuth 來取得我們在 Context 中建立的 login 函數
import { useAuth } from '../../store/AuthContext';

const LoginPage = () => {
  const [userType, setUserType] = useState('customer'); // 'customer' or 'merchant'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 2. (移除) 我們不再需要直接使用 navigate
  // const navigate = useNavigate();

  // 2. (新增) 從 AuthContext 中取得 login 函數
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
      // 這部分不變：呼叫 Firebase 進行驗證
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      console.log('Firebase 登入成功:', firebaseUser);

      // 準備要傳遞給全域狀態的使用者資料
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || email.split('@')[0], // 如果沒有顯示名稱，就用 email 當作預設
        userType: userType // 將使用者選擇的類型也傳過去
      };

      // 3. (修改) 這是最關鍵的修改！
      // 我們不再自己導航，而是呼叫全域的 login 函數
      // login 函數會 (A) 設定全域 user 狀態 (B) 幫我们導航到首頁
      login(userData); 

      // 原本的程式碼 (現在由 login() 取代):
      // setLoading(false);
      // navigate('/'); 

    } catch (err) {
      console.error("Firebase 登入失敗:", err);
      setError('登入失敗，請檢查您的信箱和密碼。');
      setLoading(false);
    }
    // 成功後 setLoading 會在 login 函數中處理 (或在這裡保留也行)
    setLoading(false);
  };

  // JSX (畫面) 的部分完全不需要修改
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-toggle">
          <button
            className={`toggle-btn ${userType === 'customer' ? 'active' : ''}`}
            onClick={() => setUserType('customer')}
          >
            會員登入
          </button>
          <button
            className={`toggle-btn ${userType === 'merchant' ? 'active' : ''}`}
            onClick={() => setUserType('merchant')}
          >
            店家登入
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>{userType === 'customer' ? '歡迎回來！' : '店家管理後台'}</h2>
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
            <a href="/forgot-password">忘記密碼？</a>
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;