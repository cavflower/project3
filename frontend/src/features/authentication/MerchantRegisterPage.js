import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import './RegisterPage.css';

const MerchantRegisterPage = () => {
  const [formData, setFormData] = useState({
    storeName: '',
    companyAccount: '', // 新增公司統編欄位
    email: '',
    password: '',
    confirmPassword: '',
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

    const { email, password, confirmPassword, storeName, companyAccount } = formData; // 取得公司統編

    if (password !== confirmPassword) {
      setError('密碼不相符');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: storeName,
      });

      const backendData = {
        firebase_uid: user.uid,
        email: user.email,
        username: storeName,
        user_type: 'merchant',
        merchant_profile: { // 將公司統編包在 merchant_profile 物件中
          company_account: companyAccount,
        }
      };

      const response = await fetch('http://127.0.0.1:8000/api/users/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`後台儲存失敗: ${JSON.stringify(errorData)}`);
      }

      await response.json();
      setLoading(false);
      navigate('/login/merchant');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container merchant-theme">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>成為合作夥伴</h2>
          <p className="form-subtitle">
            已經有帳戶了？ <Link to="/login/merchant">立即登入</Link>
          </p>
          {error && <p className="error-message">{error}</p>}
          <div className="input-group">
            <label htmlFor="storeName">店家名稱</label>
            <input type="text" id="storeName" placeholder="您的餐廳或品牌名稱" value={formData.storeName} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="companyAccount">公司統編</label>
            <input type="text" id="companyAccount" placeholder="請輸入8位數統一編號" value={formData.companyAccount} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="email">店家聯絡信箱</label>
            <input type="email" id="email" placeholder="用於登入及聯絡" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="password">密碼</label>
            <input type="password" id="password" placeholder="至少 6 個字元" value={formData.password} onChange={handleChange} required />
          </div>
          <div className="input-group">
            <label htmlFor="confirmPassword">確認密碼</label>
            <input type="password" id="confirmPassword" placeholder="再次輸入密碼" value={formData.confirmPassword} onChange={handleChange} required />
          </div>
          <div className="form-footer">
            <Link to="/register/customer">切換至會員註冊</Link>
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '註冊中...' : '註冊'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MerchantRegisterPage;
