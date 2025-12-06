import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { createProductCategory, updateProductCategory } from '../../../api/productApi';
import './ProductCategoryForm.css';

const ProductCategoryForm = ({ category, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    display_order: 0,
    is_active: true,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 滾動到表單位置
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
      modalContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  useEffect(() => {
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
        const result = await updateProductCategory(category.id, submitData);
        console.log('更新成功:', result);
        await onSuccess();
        alert('類別更新成功！');
        onClose();
      } else {
        // 新增模式
        console.log('新增類別');
        const result = await createProductCategory(submitData);
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
      <div className="modal-content">
        <div className="modal-header">
          <h2>{category ? '編輯類別' : '新增類別'}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="category-form">
          {errors.submit && (
            <div className="error-message">{errors.submit}</div>
          )}

          <div className="form-group">
            <label htmlFor="name">
              類別名稱 <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="例如：主餐、飲料、甜點"
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="description">類別描述</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="輸入類別的詳細說明（選填）"
              rows="3"
            />
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
              placeholder="數字越小越前面"
            />
            <small>數字越小，類別在列表中的位置越前面</small>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              <span>啟用此類別</span>
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? '處理中...' : (category ? '更新' : '新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductCategoryForm;
