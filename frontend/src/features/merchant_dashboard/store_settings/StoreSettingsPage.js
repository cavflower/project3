import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyStore, createStore, updateStore, uploadStoreImages, deleteStoreImage, publishStore, unpublishStore, uploadMenuImages, deleteMenuImage } from '../../../api/storeApi';
import './StoreSettingsPage.css';

const StoreSettingsPage = () => {
  const navigate = useNavigate();
  const creditCardOptions = ['Visa', 'MasterCard', 'American Express', 'JCB', 'UnionPay'];
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    transportation: '',
    fixed_holidays: '',
    is_open: true,
    budget_lunch: '',
    budget_dinner: '',
    budget_banquet: '',
    credit_cards: '',
    has_wifi: false,
    parking_info: '',
    has_english_menu: false,
    smoking_policy: 'no_smoking',
    suitable_for_children: false,
    remarks: '',
    menu_type: 'text',
    menu_text: '',
  });
  const [openingHours, setOpeningHours] = useState({
    monday: { open: '09:00', close: '18:00', is_closed: false },
    tuesday: { open: '09:00', close: '18:00', is_closed: false },
    wednesday: { open: '09:00', close: '18:00', is_closed: false },
    thursday: { open: '09:00', close: '18:00', is_closed: false },
    friday: { open: '09:00', close: '18:00', is_closed: false },
    saturday: { open: '09:00', close: '18:00', is_closed: false },
    sunday: { open: '09:00', close: '18:00', is_closed: false },
  });
  const [storeImages, setStoreImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [menuImages, setMenuImages] = useState([]);
  const [newMenuImages, setNewMenuImages] = useState([]);
  const [menuImagePreviews, setMenuImagePreviews] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [selectedCreditCards, setSelectedCreditCards] = useState([]);

  const parseCreditCards = (value) =>
    value
      ? value
          .split(/[\/,]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const dayNames = {
    monday: '星期一',
    tuesday: '星期二',
    wednesday: '星期三',
    thursday: '星期四',
    friday: '星期五',
    saturday: '星期六',
    sunday: '星期日',
  };

  useEffect(() => {
    loadStoreData();
  }, []);

  const loadStoreData = async () => {
    try {
      setIsLoading(true);
      console.log('[StoreSettings] Loading store data...');
      const response = await getMyStore();
      const store = response.data;
      console.log('[StoreSettings] Store loaded:', store);
      setStoreId(store.id);
      setFormData({
        name: store.name || '',
        description: store.description || '',
        address: store.address || '',
        phone: store.phone || '',
        email: store.email || '',
        website: store.website || '',
        transportation: store.transportation || '',
        fixed_holidays: store.fixed_holidays || '',
        is_open: store.is_open !== undefined ? store.is_open : true,
        is_published: store.is_published || false,
        budget_lunch: store.budget_lunch || '',
        budget_dinner: store.budget_dinner || '',
        budget_banquet: store.budget_banquet || '',
        credit_cards: store.credit_cards || '',
        has_wifi: store.has_wifi || false,
        parking_info: store.parking_info || '',
        has_english_menu: store.has_english_menu || false,
        smoking_policy: store.smoking_policy || 'no_smoking',
        suitable_for_children: store.suitable_for_children || false,
        remarks: store.remarks || '',
        menu_type: store.menu_type || 'text',
        menu_text: store.menu_text || '',
      });
      setSelectedCreditCards(parseCreditCards(store.credit_cards || ''));
      if (store.opening_hours) {
        setOpeningHours({ ...openingHours, ...store.opening_hours });
      }
      if (store.images && store.images.length > 0) {
        const images = store.images.map(img => ({
          id: img.id,
          url: img.image.startsWith('http') ? img.image : `http://127.0.0.1:8000${img.image}`,
          order: img.order,
        }));
        setStoreImages(images);
      }
      if (store.menu_images && store.menu_images.length > 0) {
        const images = store.menu_images.map(img => ({
          id: img.id,
          url: img.image.startsWith('http') ? img.image : `http://127.0.0.1:8000${img.image}`,
          order: img.order,
        }));
        setMenuImages(images);
      }
      setIsPublished(store.is_published || false);
    } catch (err) {
      console.error('[StoreSettings] Error loading store:', err);
      console.error('[StoreSettings] Error response:', err.response);
      if (err.response?.status === 404) {
        console.log('[StoreSettings] Store not found - user needs to create one first');
        // 店家不存在，這是正常情況（第一次使用）
      } else if (err.response?.status === 403) {
        console.error('[StoreSettings] Permission denied - user might not be a merchant');
        setError('您沒有權限訪問店家資訊。請確認您是以商家帳號登入。');
      } else {
        setError('載入店家資訊失敗，請稍後再試。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleOpeningHoursChange = (day, field, value) => {
    setOpeningHours({
      ...openingHours,
      [day]: {
        ...openingHours[day],
        [field]: value,
      },
    });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setNewImages([...newImages, ...files]);
    
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, { file, preview: reader.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeNewImage = (index) => {
    const newPreviews = [...imagePreviews];
    newPreviews.splice(index, 1);
    setImagePreviews(newPreviews);
    const newFiles = [...newImages];
    newFiles.splice(index, 1);
    setNewImages(newFiles);
  };

  const removeExistingImage = async (imageId) => {
    try {
      await deleteStoreImage(storeId, imageId);
      setStoreImages(storeImages.filter(img => img.id !== imageId));
      setSuccess('圖片已刪除');
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError('刪除圖片失敗');
      setTimeout(() => setError(''), 1500);
    }
  };

  const handleMenuImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setNewMenuImages([...newMenuImages, ...files]);
    
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMenuImagePreviews(prev => [...prev, { file, preview: reader.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeNewMenuImage = (index) => {
    const newPreviews = [...menuImagePreviews];
    newPreviews.splice(index, 1);
    setMenuImagePreviews(newPreviews);
    const newFiles = [...newMenuImages];
    newFiles.splice(index, 1);
    setNewMenuImages(newFiles);
  };

  const removeExistingMenuImage = async (imageId) => {
    try {
      await deleteMenuImage(storeId, imageId);
      setMenuImages(menuImages.filter(img => img.id !== imageId));
      setSuccess('菜單圖片已刪除');
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError('刪除菜單圖片失敗');
      setTimeout(() => setError(''), 1500);
    }
  };

  const handleCreditCardToggle = (card) => {
    setSelectedCreditCards((prev) => {
      const next = prev.includes(card) ? prev.filter((item) => item !== card) : [...prev, card];
      setFormData((prevForm) => ({
        ...prevForm,
        credit_cards: next.join('/'),
      }));
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const dataToSend = new FormData();
    dataToSend.append('name', formData.name || '');
    dataToSend.append('description', formData.description || '');
    dataToSend.append('address', formData.address || '');
    dataToSend.append('phone', formData.phone || '');
    if (formData.email) {
      dataToSend.append('email', formData.email);
    }
    if (formData.website) {
      dataToSend.append('website', formData.website);
    }
    if (formData.transportation) {
      dataToSend.append('transportation', formData.transportation);
    }
    if (formData.fixed_holidays) {
      dataToSend.append('fixed_holidays', formData.fixed_holidays);
    }
    dataToSend.append('is_open', formData.is_open ? 'true' : 'false');
    dataToSend.append('opening_hours', JSON.stringify(openingHours));
    
    if (formData.budget_lunch) {
      dataToSend.append('budget_lunch', formData.budget_lunch);
    }
    if (formData.budget_dinner) {
      dataToSend.append('budget_dinner', formData.budget_dinner);
    }
    if (formData.budget_banquet) {
      dataToSend.append('budget_banquet', formData.budget_banquet);
    }
    if (formData.credit_cards) {
      dataToSend.append('credit_cards', formData.credit_cards);
    }
    dataToSend.append('has_wifi', formData.has_wifi ? 'true' : 'false');
    if (formData.parking_info) {
      dataToSend.append('parking_info', formData.parking_info);
    }
    dataToSend.append('has_english_menu', formData.has_english_menu ? 'true' : 'false');
    dataToSend.append('smoking_policy', formData.smoking_policy || 'no_smoking');
    dataToSend.append('suitable_for_children', formData.suitable_for_children ? 'true' : 'false');
    if (formData.remarks) {
      dataToSend.append('remarks', formData.remarks);
    }
    if (formData.menu_type) {
      dataToSend.append('menu_type', formData.menu_type);
    }
    if (formData.menu_text) {
      dataToSend.append('menu_text', formData.menu_text);
    }

    try {
      let currentStoreId = storeId;
      let needsReload = false;
      
      if (storeId) {
        await updateStore(storeId, dataToSend);
        setSuccess('店家資訊已成功更新！');
      } else {
        const response = await createStore(dataToSend);
        currentStoreId = response.data.id;
        setStoreId(currentStoreId);
        setSuccess('店家資訊已成功建立！');
        needsReload = true;
      }

      // 上傳新圖片
      if (newImages.length > 0 && currentStoreId) {
        await uploadStoreImages(currentStoreId, newImages);
        setNewImages([]);
        setImagePreviews([]);
        needsReload = true;
      }

      // 上傳新菜單圖片
      if (newMenuImages.length > 0 && currentStoreId) {
        await uploadMenuImages(currentStoreId, newMenuImages);
        setNewMenuImages([]);
        setMenuImagePreviews([]);
        needsReload = true;
      }

      // 只在有新資料時才重新載入一次
      if (needsReload) {
        await loadStoreData();
      }

      // 1秒後清除成功訊息
      setTimeout(() => {
        setSuccess('');
      }, 1000);
    } catch (err) {
      console.error('Failed to save store:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      // 顯示更詳細的錯誤訊息
      let errorMessage = '儲存店家資訊失敗，請檢查所有欄位是否正確。';
      
      if (err.response?.data) {
        const errorData = err.response.data;
        
        // 如果是驗證錯誤，顯示具體的欄位錯誤
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (typeof errorData === 'object') {
          // 收集所有欄位錯誤
          const fieldErrors = [];
          for (const [field, messages] of Object.entries(errorData)) {
            if (Array.isArray(messages)) {
              fieldErrors.push(`${field}: ${messages.join(', ')}`);
            } else if (typeof messages === 'string') {
              fieldErrors.push(`${field}: ${messages}`);
            }
          }
          if (fieldErrors.length > 0) {
            errorMessage = `驗證錯誤：\n${fieldErrors.join('\n')}`;
          }
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!storeId) {
      alert('請先儲存店家資訊');
      return;
    }

    if (isPublished) {
      alert('店家已經上架了');
      return;
    }

    const confirmed = window.confirm('確定要上架店家嗎？上架後顧客就可以看到您的餐廳了。');
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await publishStore(storeId);
      setIsPublished(true);
      setSuccess('店家已成功上架！');
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      console.error('Failed to publish store:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || '上架失敗，請稍後再試。';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!storeId) {
      alert('請先儲存店家資訊');
      return;
    }

    if (!isPublished) {
      alert('店家尚未上架');
      return;
    }

    const confirmed = window.confirm('確定要下架店家嗎？下架後顧客將無法看到您的餐廳。');
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await unpublishStore(storeId);
      setIsPublished(false);
      setSuccess('店家已成功下架！');
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      console.error('Failed to unpublish store:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || '下架失敗，請稍後再試。';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="store-settings-page">
        <div className="loading">載入中...</div>
      </div>
    );
  }

  return (
    <div className="store-settings-page">
      <div className="store-settings-container">
        <div className="page-header">
          <h1>餐廳設定</h1>
          <div className="header-actions">
            {storeId ? (
              <button
                className={isPublished ? 'btn-unpublish' : 'btn-publish'}
                onClick={isPublished ? handleUnpublish : handlePublish}
                disabled={loading}
              >
                {loading ? '處理中...' : (isPublished ? '下架店家' : '上架店家')}
              </button>
            ) : (
              <div className="warning-badge">
                請先儲存店家資訊
              </div>
            )}
            <button
              type="button"
              className="btn-back"
              onClick={() => navigate('/dashboard')}
            >
              ← 返回儀表板
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="store-settings-form">
          {/* 基本資訊 */}
          <div className="form-section">
            <h2>基本資訊</h2>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="name">餐廳名稱 *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="請輸入餐廳名稱"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">電話 *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="請輸入電話號碼"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="請輸入 Email（選填）"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="address">地址 *</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  placeholder="請輸入完整地址"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="website">餐廳網站</label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com（選填）"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="transportation">交通方式</label>
                <textarea
                  id="transportation"
                  name="transportation"
                  value={formData.transportation}
                  onChange={handleChange}
                  rows="3"
                  placeholder="例如：從JR新小岩站步行3分鐘（選填）"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="description">餐廳描述</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  placeholder="請描述您的餐廳特色、菜系等（選填）"
                />
              </div>
            </div>
          </div>

          {/* 營業時間 */}
          <div className="form-section">
            <h2>營業時間</h2>
            <div className="opening-hours-container">
              {Object.keys(dayNames).map((day) => (
                <div key={day} className="opening-hours-item">
                  <div className="day-label">
                    <input
                      type="checkbox"
                      checked={!openingHours[day].is_closed}
                      onChange={(e) =>
                        handleOpeningHoursChange(day, 'is_closed', !e.target.checked)
                      }
                    />
                    <label>{dayNames[day]}</label>
                  </div>
                  {!openingHours[day].is_closed && (
                    <div className="time-inputs">
                      <input
                        type="time"
                        value={openingHours[day].open}
                        onChange={(e) =>
                          handleOpeningHoursChange(day, 'open', e.target.value)
                        }
                      />
                      <span>至</span>
                      <input
                        type="time"
                        value={openingHours[day].close}
                        onChange={(e) =>
                          handleOpeningHoursChange(day, 'close', e.target.value)
                        }
                      />
                    </div>
                  )}
                  {openingHours[day].is_closed && (
                    <span className="closed-label">休息</span>
                  )}
                </div>
              ))}
            </div>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label htmlFor="fixed_holidays">固定休息日</label>
              <textarea
                id="fixed_holidays"
                name="fixed_holidays"
                value={formData.fixed_holidays}
                onChange={handleChange}
                rows="2"
                placeholder="例如：我們將於2025年11月10日及11日停業進行維護（選填）"
              />
            </div>
          </div>

          {/* 平均預算 */}
          <div className="form-section">
            <h2>平均預算</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="budget_lunch">午餐</label>
                <input
                  type="number"
                  id="budget_lunch"
                  name="budget_lunch"
                  value={formData.budget_lunch}
                  onChange={handleChange}
                  min="0"
                  placeholder="例如：1500"
                />
              </div>
              <div className="form-group">
                <label htmlFor="budget_dinner">晚餐</label>
                <input
                  type="number"
                  id="budget_dinner"
                  name="budget_dinner"
                  value={formData.budget_dinner}
                  onChange={handleChange}
                  min="0"
                  placeholder="例如：4000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="budget_banquet">宴會</label>
                <input
                  type="number"
                  id="budget_banquet"
                  name="budget_banquet"
                  value={formData.budget_banquet}
                  onChange={handleChange}
                  min="0"
                  placeholder="例如：4500"
                />
              </div>
            </div>
          </div>

          {/* 支付方式 */}
          <div className="form-section">
            <h2>支付方式</h2>
            <div className="form-group">
              <label>接受的信用卡</label>
              <div className="credit-card-options">
                {creditCardOptions.map((card) => (
                  <label key={card} className="credit-card-option">
                    <input
                      type="checkbox"
                      checked={selectedCreditCards.includes(card)}
                      onChange={() => handleCreditCardToggle(card)}
                    />
                    <span>{card}</span>
                  </label>
                ))}
              </div>
              {selectedCreditCards.length === 0 && (
                <small className="text-muted">尚未選擇信用卡，若不接受信用卡可留白。</small>
              )}
            </div>
          </div>

          {/* 設施與服務 */}
          <div className="form-section">
            <h2>設施與服務</h2>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="has_wifi"
                  checked={formData.has_wifi}
                  onChange={handleChange}
                />
                <span>提供 Wi-Fi</span>
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="has_english_menu"
                  checked={formData.has_english_menu}
                  onChange={handleChange}
                />
                <span>提供英文菜單</span>
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="parking_info">停車場資訊</label>
              <textarea
                id="parking_info"
                name="parking_info"
                value={formData.parking_info}
                onChange={handleChange}
                rows="2"
                placeholder="例如：無，附近有收費停車場（選填）"
              />
            </div>
          </div>

          {/* 吸菸政策 */}
          <div className="form-section">
            <h2>吸菸政策</h2>
            <div className="form-group">
              <label htmlFor="smoking_policy">吸菸政策</label>
              <select
                id="smoking_policy"
                name="smoking_policy"
                value={formData.smoking_policy}
                onChange={handleChange}
              >
                <option value="no_smoking">完全禁煙</option>
                <option value="smoking_allowed">可吸菸</option>
                <option value="separate_room">有專用吸菸室</option>
              </select>
            </div>
          </div>

          {/* 其他設定 */}
          <div className="form-section">
            <h2>其他設定</h2>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="suitable_for_children"
                  checked={formData.suitable_for_children}
                  onChange={handleChange}
                />
                <span>適合帶小孩</span>
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="remarks">備註</label>
              <textarea
                id="remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows="4"
                placeholder="其他備註或注意事項（選填）"
              />
            </div>
          </div>

          {/* 菜單設定 */}
          <div className="form-section">
            <h2>菜單設定（選填）</h2>
            <div className="form-group">
              <label htmlFor="menu_type">菜單類型</label>
              <select
                id="menu_type"
                name="menu_type"
                value={formData.menu_type}
                onChange={handleChange}
              >
                <option value="text">文字與價格</option>
                <option value="image">菜單圖片</option>
              </select>
            </div>

            {formData.menu_type === 'text' && (
              <div className="form-group">
                <label htmlFor="menu_text">菜單內容（文字與價格）</label>
                <textarea
                  id="menu_text"
                  name="menu_text"
                  value={formData.menu_text}
                  onChange={handleChange}
                  rows="10"
                  placeholder="例如：&#10;主餐類&#10;牛肉麵 - NT$ 150&#10;雞肉飯 - NT$ 80&#10;&#10;飲料類&#10;珍珠奶茶 - NT$ 60&#10;綠茶 - NT$ 40"
                />
                <small>請輸入菜單項目和價格，每行一個項目</small>
              </div>
            )}

            {formData.menu_type === 'image' && (
              <>
                <div className="form-group">
                  <label htmlFor="menu_images">上傳菜單圖片（可多選）</label>
                  <input
                    type="file"
                    id="menu_images"
                    name="menu_images"
                    accept="image/*"
                    multiple
                    onChange={handleMenuImageUpload}
                  />
                  <small>可以一次選擇多張菜單圖片上傳</small>
                </div>

                {/* 現有菜單圖片 */}
                {menuImages.length > 0 && (
                  <div className="images-grid">
                    <h3>現有菜單圖片</h3>
                    {menuImages.map((img) => (
                      <div key={img.id} className="image-item">
                        <img src={img.url} alt={`菜單圖片 ${img.order + 1}`} />
                        <button
                          type="button"
                          className="btn-delete-image"
                          onClick={() => removeExistingMenuImage(img.id)}
                        >
                          刪除
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 新上傳的菜單圖片預覽 */}
                {menuImagePreviews.length > 0 && (
                  <div className="images-grid">
                    <h3>新上傳的菜單圖片（待儲存）</h3>
                    {menuImagePreviews.map((item, index) => (
                      <div key={index} className="image-item">
                        <img src={item.preview} alt={`預覽 ${index + 1}`} />
                        <button
                          type="button"
                          className="btn-delete-image"
                          onClick={() => removeNewMenuImage(index)}
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 餐廳圖片 */}
          <div className="form-section">
            <h2>餐廳圖片</h2>
            <div className="form-group">
              <label htmlFor="images">上傳餐廳圖片（可多選）</label>
              <input
                type="file"
                id="images"
                name="images"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
              />
              <small>可以一次選擇多張圖片上傳</small>
            </div>

            {/* 現有圖片 */}
            {storeImages.length > 0 && (
              <div className="images-grid">
                <h3>現有圖片</h3>
                {storeImages.map((img) => (
                  <div key={img.id} className="image-item">
                    <img src={img.url} alt={`餐廳圖片 ${img.order + 1}`} />
                    <button
                      type="button"
                      className="btn-delete-image"
                      onClick={() => removeExistingImage(img.id)}
                    >
                      刪除
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 新上傳的圖片預覽 */}
            {imagePreviews.length > 0 && (
              <div className="images-grid">
                <h3>新上傳的圖片（待儲存）</h3>
                {imagePreviews.map((item, index) => (
                  <div key={index} className="image-item">
                    <img src={item.preview} alt={`預覽 ${index + 1}`} />
                    <button
                      type="button"
                      className="btn-delete-image"
                      onClick={() => removeNewImage(index)}
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => navigate('/dashboard')}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? '儲存中...' : storeId ? '更新資訊' : '儲存資訊'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreSettingsPage;
