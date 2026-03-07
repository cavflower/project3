import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import styles from './LoginPage.module.css';

const RegisterPage = () => {
  const [userType, setUserType] = useState('customer');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeName: '',
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

    const { email, password, confirmPassword, username, storeName } = formData;

    if (password !== confirmPassword) {
      setError('密碼不相�?);
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile
      const displayName = userType === 'customer' ? username : storeName;
      await updateProfile(user, {
        displayName: displayName,
      });

      // Send user data to your backend
      try {
        const backendData = {
          firebase_uid: user.uid,
          email: user.email,
          username: displayName,
          user_type: userType,
          // Add other fields if they exist in your form
          phone_number: '', // Example: formData.phoneNumber || ''
          address: '',      // Example: formData.address || ''
        };

        const response = await fetch('http://127.0.0.1:8000/api/users/register/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(backendData),
        });

        if (!response.ok) {
          // If backend fails, the Firebase user is already created.
          // For now, we log the error. A more robust solution might involve
          // notifying the user or attempting to delete the Firebase user.
          const errorData = await response.json();
          throw new Error(`Backend Error: ${JSON.stringify(errorData)}`);
        }

        const savedUser = await response.json();
        console.log('User saved to backend:', savedUser);

      } catch (backendError) {
        console.error('Failed to save user to backend:', backendError);
        // Optionally, set an error message for the user
        setError('帳�?已建立�?但�??��??��?步失?��?請聯繫客?��?);
        // We don't re-throw or stop the process, as the user is technically registered.
      }


      setLoading(false);
      navigate('/'); // Redirect to home page after successful registration
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const renderCustomerForm = () => (
    <>
      <div className={styles['input-group']}>
        <label htmlFor="username">使用?��?�?/label>
        <input type="text" id="username" placeholder="請輸?�您?�暱�? value={formData.username} onChange={handleChange} required />
      </div>
      <div className={styles['input-group']}>
        <label htmlFor="email">?��??�件</label>
        <input type="email" id="email" placeholder="請輸?�您?�電子郵�? value={formData.email} onChange={handleChange} required />
      </div>
      <div className={styles['input-group']}>
        <label htmlFor="password">密碼</label>
        <input type="password" id="password" placeholder="?��? 6 ?��??? value={formData.password} onChange={handleChange} required />
      </div>
      <div className={styles['input-group']}>
        <label htmlFor="confirm-password">確�?密碼</label>
        <input type="password" id="confirmPassword" placeholder="?�次輸入密碼" value={formData.confirmPassword} onChange={handleChange} required />
      </div>
    </>
  );

  const renderMerchantForm = () => (
    <>
      <div className={styles['input-group']}>
        <label htmlFor="store-name">店家?�稱</label>
        <input type="text" id="storeName" placeholder="?��?餐廳?��??��?�? value={formData.storeName} onChange={handleChange} required />
      </div>
      <div className={styles['input-group']}>
        <label htmlFor="email">店家?�絡信箱</label>
        <input type="email" id="email" placeholder="?�於?�入?�聯�? value={formData.email} onChange={handleChange} required />
      </div>
      <div className={styles['input-group']}>
        <label htmlFor="password">密碼</label>
        <input type="password" id="password" placeholder="?��? 6 ?��??? value={formData.password} onChange={handleChange} required />
      </div>
      <div className={styles['input-group']}>
        <label htmlFor="confirm-password">確�?密碼</label>
        <input type="password" id="confirmPassword" placeholder="?�次輸入密碼" value={formData.confirmPassword} onChange={handleChange} required />
      </div>
    </>
  );

  return (
    <div className={styles['auth-page']}>
      <div className={styles['auth-container']}>
        <div className="auth-toggle">
          <button
            className={`toggle-btn ${userType === 'customer' ? 'active' : ''}`}
            onClick={() => setUserType('customer')}
          >
            ?�是顧客
          </button>
          <button
            className={`toggle-btn ${userType === 'merchant' ? 'active' : ''}`}
            onClick={() => setUserType('merchant')}
          >
            ?�是店家
          </button>
        </div>

        <form className={styles['auth-form']} onSubmit={handleSubmit}>
          <h2>{userType === 'customer' ? '建�??�帳?? : '?�為?��?夥伴'}</h2>
          {error && <p className={styles['error-message']}>{error}</p>}
          {userType === 'customer' ? renderCustomerForm() : renderMerchantForm()}
          <button type="submit" className={styles['submit-btn']} disabled={loading}>
            {loading ? '註�?�?..' : '註�?'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
