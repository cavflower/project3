import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import './CategoryForm.css';

const CategoryForm = ({ category, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 0,
    is_active: true,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
      modalContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || '',
        display_order: category.display_order || 0,
        is_active: category.is_active !== undefined ? category.is_active : true,
      });
    }
  }, [category]);

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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = '請輸入類別名稱';
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
      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        display_order: parseInt(formData.display_order) || 0,
        is_active: formData.is_active,
      };

      console.log('提交類別數據:', submitData);

      if (category?.id) {
        // 編輯模式
        console.log('編輯類別 ID:', category.id);
        const result = await surplusFoodApi.updateCategory(category.id, submitData);
        console.log('更新成功:', result);
        await onSuccess();
        alert('類別更新成功！');
        onClose();
      } else {
        // 新增模式
        console.log('新增類別');
        const result = await surplusFoodApi.createCategory(submitData);
        console.log('新增成功:', result);
        await onSuccess();
        alert('類別新增成功！');
        onClose();
      }
    } catch (error) {
      console.error('提交表單失敗:', error);
      console.error('錯誤詳情:', error.response?.data);
      setErrors({ 
        submit: error.response?.data?.name?.[0] || 
                error.response?.data?.message || 
                error.response?.data?.detail ||
                '提交失敗，請稍後再試' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content category-form-modal">
        <div className="modal-header">
          <h2>
            {category ? '編輯惜福品類別' : '新增惜福品類別'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body form-body">
            <div className="form-operation-title">
              {!category && (
                <>
                  <span className="operation-icon">📁</span>
                  <span>新增類別</span>
                </>
              )}
              {category && (
                <>
                  <span className="operation-icon">✏️</span>
                  <span>編輯類別：{category.name}</span>
                </>
              )}
            </div>

            {errors.submit && (
              <div className="error-banner">
                {errors.submit}
              </div>
            )}

            <div className="info-banner">
              <strong>📌 類別說明：</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                <li>類別可以幫助您組織管理不同種類的惜福食品</li>
                <li>顯示順序數字越小，類別排序越前面</li>
              </ul>
            </div>

            <div className="form-group">
              <label htmlFor="name">類別名稱 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="例如：麵包類、熟食類、飲料類"
                className={errors.name ? 'error' : ''}
                required
              />
              {errors.name && (
                <span className="error-message">{errors.name}</span>
              )}
              <small className="form-hint">
                為這個類別設定一個清楚易懂的名稱
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="description">類別描述</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="描述這個類別包含哪些類型的惜福食品（選填）"
                rows="3"
              />
              <small className="form-hint">
                選填：可以添加更詳細的說明
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="display_order">顯示順序</label>
              <input
                type="number"
                id="display_order"
                name="display_order"
                value={formData.display_order}
                onChange={handleChange}
                min="0"
                step="1"
              />
              <small className="form-hint">
                數字越小越前面顯示（預設為 0）
              </small>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span>啟用此類別</span>
              </label>
              <small className="form-hint">
                停用後將無法在此類別下新增惜福食品
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              取消
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '處理中...' : (category ? '更新' : '新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryForm;
