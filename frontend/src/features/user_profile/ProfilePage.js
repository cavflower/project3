import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../store/AuthContext';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user, updateUser, loading } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone_number: '',
    address: '', // 地址欄位，將根據使用者類型決定是否顯示
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        address: user.address || '', // 商家地址
      });
      // 如果使用者有頭像 URL，則使用它，否則使用預設圖片
      setAvatarPreview(user.avatar_url || 'https://via.placeholder.com/150');
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 建立一個純粹的 JavaScript 物件來存放要提交的資料
    const submissionData = {};

    // 1. 處理頭像檔案 (Base64)
    // 如果 avatarPreview 是一個 data URL (表示有新圖片或現有圖片)，並且與使用者的原始 URL 不同
    if (avatarPreview && avatarPreview !== (user.avatar_url || 'https://via.placeholder.com/150')) {
      submissionData.avatar_url = avatarPreview;
    }

    // 2. 處理其他文字欄位
    Object.keys(formData).forEach((key) => {
      const initialValue = user[key] || '';
      // 只有在欄位有變更時才加入
      if (formData[key] !== initialValue) {
        // 如果是顧客，則不包含 address 欄位
        if (key === 'address' && user.user_type === 'customer') {
          return;
        }
        submissionData[key] = formData[key];
      }
    });

    // 檢查是否有任何資料需要更新
    if (Object.keys(submissionData).length > 0) {
      try {
        await updateUser(submissionData); // 直接傳遞 JS 物件
        alert('個人資料更新成功！');
      } catch (error) {
        console.error('更新失敗:', error);
        alert(`更新失敗：${error.response?.data?.detail || error.message || '請稍後再試。'}`);
      }
    } else {
      alert('沒有偵測到任何變更。');
    }
  };

  if (loading || !user) {
    return <div>正在載入使用者資料...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="profile-sidebar">
            <h1>編輯個人資料</h1>
            <div className="avatar-upload-container" onClick={() => fileInputRef.current.click()}>
              <img
                src={avatarPreview}
                alt="Avatar"
                className="avatar-preview"
              />
              <div className="avatar-edit-overlay">
                <span>更換頭像</span>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
              accept="image/*"
            />
          </div>

          <div className="profile-main">
            <div className="form-group">
              <label htmlFor="username">名稱</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">電子郵件 (無法修改)</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                readOnly
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone_number">電話號碼</label>
              <input
                type="tel"
                id="phone_number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
              />
            </div>

            {/* 只有商家 (merchant) 才能看到並修改地址 */}
            {user.user_type === 'merchant' && (
              <div className="form-group">
                <label htmlFor="address">地址</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
            )}

            <button type="submit" className="submit-btn">
              儲存變更
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
