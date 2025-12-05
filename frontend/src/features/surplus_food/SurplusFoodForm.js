import React, { useState, useEffect } from 'react';
import { FaTimes, FaUpload } from 'react-icons/fa';
import { getProducts } from '../../api/productApi';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import './SurplusFoodForm.css';

const SurplusFoodForm = ({ type, item, initialCategory, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    product: '',
    title: '',
    description: '',
    original_price: '',
    surplus_price: '',
    quantity: 1,
    condition: 'surplus',
    dining_option: 'both',
    expiry_date: '',
    time_slot: '',
    pickup_instructions: '',
    image: null,
  });

  const [products, setProducts] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (item && type === 'editFood') {
      setFormData({
        product: item.product || '',
        title: item.title || '',
        description: item.description || '',
        original_price: item.original_price || '',
        surplus_price: item.surplus_price || '',
        quantity: item.quantity || 1,
        condition: item.condition || 'surplus',
        dining_option: item.dining_option || 'both',
        expiry_date: item.expiry_date || '',
        time_slot: item.time_slot || '',
        pickup_instructions: item.pickup_instructions || '',
        image: null,
      });
      if (item.image) {
        setImagePreview(item.image);
      }
    }
  }, [item, type]);

  const loadInitialData = async () => {
    try {
      const [productsData, timeSlotsData] = await Promise.all([
        getProducts(),
        surplusFoodApi.getTimeSlots()
      ]);
      setProducts(productsData.data || []);
      setTimeSlots(timeSlotsData || []);
    } catch (error) {
      console.error('載入資料失敗:', error);
    }
  };

  const formatDateTimeForInput = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toISOString().slice(0, 16);
  };

  const conditionOptions = [
    { value: 'near_expiry', label: '即期品' },
    { value: 'surplus', label: '剩餘品' },
    { value: 'damaged_package', label: '外包裝損傷' },
  ];

  const diningOptions = [
    { value: 'dine_in', label: '內用' },
    { value: 'takeout', label: '外帶' },
    { value: 'both', label: '內用和外帶' },
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleProductChange = (e) => {
    const productId = e.target.value;
    const selectedProduct = products.find(p => p.id === parseInt(productId));
    
    if (selectedProduct) {
      setFormData({
        ...formData,
        product: productId,
        title: selectedProduct.name,
        description: selectedProduct.description || '',
        original_price: selectedProduct.price || '',
      });
    } else {
      setFormData({
        ...formData,
        product: '',
      });
    }
    if (errors.product) {
      setErrors({ ...errors, product: '' });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = '請輸入惜福品名稱';
    }

    if (!formData.original_price || parseFloat(formData.original_price) <= 0) {
      newErrors.original_price = '請輸入有效的原價';
    }

    if (!formData.surplus_price || parseFloat(formData.surplus_price) <= 0) {
      newErrors.surplus_price = '請輸入有效的惜福價';
    }

    if (parseFloat(formData.surplus_price) >= parseFloat(formData.original_price)) {
      newErrors.surplus_price = '惜福價必須低於原價';
    }

    // 檢查惜福價是否高於原價的80%
    const maxAllowedPrice = parseFloat(formData.original_price) * 0.8;
    if (parseFloat(formData.surplus_price) > maxAllowedPrice) {
      newErrors.surplus_price = '惜福價不能高於原價的80%';
    }

    if (!formData.quantity || formData.quantity < 1) {
      newErrors.quantity = '數量必須至少為 1';
    }

    if (formData.condition === 'near_expiry' && !formData.expiry_date) {
      newErrors.expiry_date = '即期品必須填寫到期日';
    }

    if (!formData.time_slot) {
      newErrors.time_slot = '請選擇惜福時段';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const submitFormData = new FormData();
      
      // 添加所有欄位
      if (initialCategory?.id) submitFormData.append('category', initialCategory.id);
      if (formData.product) submitFormData.append('product', formData.product);
      submitFormData.append('title', formData.title);
      submitFormData.append('description', formData.description);
      submitFormData.append('original_price', formData.original_price);
      submitFormData.append('surplus_price', formData.surplus_price);
      submitFormData.append('quantity', formData.quantity);
      submitFormData.append('condition', formData.condition);
      submitFormData.append('dining_option', formData.dining_option);
      if (formData.expiry_date) submitFormData.append('expiry_date', formData.expiry_date);
      submitFormData.append('time_slot', formData.time_slot);
      submitFormData.append('pickup_instructions', formData.pickup_instructions);
      
      if (formData.image && formData.image instanceof File) {
        submitFormData.append('image', formData.image);
      }

      if (type === 'editFood' && item?.id) {
        await surplusFoodApi.updateSurplusFood(item.id, submitFormData);
        await onSuccess();
        alert('惜福品更新成功！');
        onClose();
      } else {
        await surplusFoodApi.createSurplusFood(submitFormData);
        await onSuccess();
        alert('惜福品新增成功！');
        onClose();
      }
    } catch (error) {
      console.error('提交失敗:', error);
      setErrors({
        submit: error.response?.data?.message || '提交失敗，請稍後再試'
      });
    } finally {
      setLoading(false);
    }
  };

  const discountPercent = formData.original_price && formData.surplus_price
    ? Math.round((1 - formData.surplus_price / formData.original_price) * 100)
    : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content surplus-food-form-modal">
        <div className="modal-header">
          <h2>
            {type === 'createFood' && '新增惜福品'}
            {type === 'editFood' && '編輯惜福品'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body form-body">
            {/* 操作標題提示 */}
            <div className="form-operation-title">
              {type === 'createFood' && (
                <>
                  <span className="operation-icon">➕</span>
                  <span>新增惜福品</span>
                </>
              )}
              {type === 'editFood' && item && (
                <>
                  <span className="operation-icon">✏️</span>
                  <span>編輯惜福品：{item.title}</span>
                </>
              )}
            </div>

            {errors.submit && (
              <div className="error-banner">
                {errors.submit}
              </div>
            )}

            {/* 上架規則說明 */}
            <div className="info-banner">
              <strong>📋 惜福品上架規則：</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px', marginBottom: 0 }}>
                <li>惜福價必須至少打8折（折扣20%以上）</li>
                <li>不可在尖峰時段（08:00-13:00、17:00-19:00）設定惜福時段</li>
                <li>同一店家不可在同一天有重複的時段設定</li>
                <li>建議上傳清晰的商品照片以提高銷售率</li>
              </ul>
            </div>

            {/* 關聯商品（可選） */}
            <div className="form-group">
              <label htmlFor="product">關聯商品（可選）</label>
              <select
                id="product"
                name="product"
                value={formData.product}
                onChange={handleProductChange}
              >
                <option value="">不關聯現有商品</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - ${product.price}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                可從現有商品自動帶入資訊，或手動填寫
              </small>
            </div>

            {/* 惜福品名稱 */}
            <div className="form-group">
              <label htmlFor="title">惜福品名稱 *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="例如：即期麵包組合"
                className={errors.title ? 'error' : ''}
                required
              />
              {errors.title && (
                <span className="error-message">{errors.title}</span>
              )}
            </div>

            {/* 商品描述 */}
            <div className="form-group">
              <label htmlFor="description">商品描述</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="描述商品內容、特色等..."
              />
            </div>

            {/* 價格設定 */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="original_price">原價 *</label>
                <input
                  type="number"
                  id="original_price"
                  name="original_price"
                  value={formData.original_price}
                  onChange={handleChange}
                  onWheel={(e) => e.target.blur()}
                  min="0"
                  step="1"
                  className={errors.original_price ? 'error' : ''}
                  disabled={!!formData.product}
                  required
                />
                {errors.original_price && (
                  <span className="error-message">{errors.original_price}</span>
                )}
                {formData.product && (
                  <small className="form-hint" style={{color: '#ff6b6b'}}>
                    已關聯商品，原價自動帶入不可更改
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="surplus_price">惜福價 *</label>
                <input
                  type="number"
                  id="surplus_price"
                  name="surplus_price"
                  value={formData.surplus_price}
                  onChange={handleChange}
                  onWheel={(e) => e.target.blur()}
                  min="0"
                  step="1"
                  className={errors.surplus_price ? 'error' : ''}
                  required
                />
                {errors.surplus_price && (
                  <span className="error-message">{errors.surplus_price}</span>
                )}
              </div>
            </div>

            {/* 折扣顯示 */}
            {discountPercent > 0 && (
              <div className="discount-display">
                <span className="discount-badge">{discountPercent}% OFF</span>
                <span className="discount-text">
                  顧客可節省 ${Math.floor(formData.original_price - formData.surplus_price)}
                </span>
              </div>
            )}

            {/* 數量與狀況 */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="quantity">可售數量 *</label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  onWheel={(e) => e.target.blur()}
                  min="1"
                  className={errors.quantity ? 'error' : ''}
                  disabled={type === 'editFood'}
                  required
                />
                {errors.quantity && (
                  <span className="error-message">{errors.quantity}</span>
                )}
                {type === 'editFood' && (
                  <small className="form-hint" style={{color: '#ff6b6b'}}>
                    編輯時不可修改可售數量
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="condition">商品狀況 *</label>
                <select
                  id="condition"
                  name="condition"
                  value={formData.condition}
                  onChange={handleChange}
                  required
                >
                  {conditionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 用餐方式 */}
            <div className="form-group">
              <label htmlFor="dining_option">用餐方式 *</label>
              <select
                id="dining_option"
                name="dining_option"
                value={formData.dining_option}
                onChange={handleChange}
                required
              >
                {diningOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                選擇此惜福品適用的用餐方式
              </small>
            </div>

            {/* 到期日（即期品必填） */}
            {formData.condition === 'near_expiry' && (
              <div className="form-group">
                <label htmlFor="expiry_date">到期日 *</label>
                <input
                  type="date"
                  id="expiry_date"
                  name="expiry_date"
                  value={formData.expiry_date}
                  onChange={handleChange}
                  className={errors.expiry_date ? 'error' : ''}
                  disabled={type === 'editFood'}
                  required
                />
                {errors.expiry_date && (
                  <span className="error-message">{errors.expiry_date}</span>
                )}
                {type === 'editFood' && (
                  <small className="form-hint" style={{color: '#ff6b6b'}}>
                    即期品編輯時不可修改到期日
                  </small>
                )}
              </div>
            )}

            {/* 惜福時段 */}
            <div className="form-group">
              <label htmlFor="time_slot">惜福時段 *</label>
              <select
                id="time_slot"
                name="time_slot"
                value={formData.time_slot}
                onChange={handleChange}
                className={errors.time_slot ? 'error' : ''}
                required
              >
                <option value="">請選擇時段</option>
                {timeSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name} - {slot.day_of_week_display} {slot.start_time}-{slot.end_time}
                  </option>
                ))}
              </select>
              {errors.time_slot && (
                <span className="error-message">{errors.time_slot}</span>
              )}
              <small className="form-hint">
                選擇對應的惜福時段，販售時間將依據時段設定
              </small>
            </div>

            {/* 商品圖片 */}
            <div className="form-group">
              <label>商品圖片</label>
              <div className="image-upload-area">
                {imagePreview ? (
                  <div className="image-preview">
                    <img src={imagePreview} alt="預覽" />
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={() => {
                        setFormData({ ...formData, image: null });
                        setImagePreview(null);
                      }}
                    >
                      <FaTimes />
                    </button>
                  </div>
                ) : (
                  <label className="upload-label">
                    <FaUpload />
                    <span>點擊上傳圖片</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      hidden
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 取餐說明 */}
            <div className="form-group">
              <label htmlFor="pickup_instructions">取餐說明</label>
              <textarea
                id="pickup_instructions"
                name="pickup_instructions"
                value={formData.pickup_instructions}
                onChange={handleChange}
                rows="2"
                placeholder="例如：請於時段內到店取餐，出示訂單編號"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '處理中...' : (type === 'editFood' ? '更新' : '新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SurplusFoodForm;
