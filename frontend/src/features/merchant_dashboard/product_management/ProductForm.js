import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import './ProductForm.css';
import { createProduct, updateProduct } from '../../../api/productApi';

const ProductForm = ({ product, initialCategory, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    image: null,
    service_type: 'both',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    // 滾動到表單位置
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
      modalContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        price: product.price,
        description: product.description,
        image: null,
        service_type: product.service_type || 'both',
      });
    }
  }, [product]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    setFormData(prev => ({
      ...prev,
      image: e.target.files[0],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!initialCategory) {
      setError('無法確定商品類別');
      return;
    }

    try {
      const priceNumber = parseFloat(formData.price);
      if (Number.isNaN(priceNumber)) {
        setError('請輸入有效的價格');
        return;
      }

      const data = new FormData();
      data.append('name', formData.name);
      data.append('price', priceNumber.toFixed(2));
      data.append('description', formData.description);
      data.append('service_type', formData.service_type);
      
      // 編輯時使用產品原本的category，新增時使用initialCategory
      if (product && product.category) {
        data.append('category', product.category);
      } else if (initialCategory) {
        data.append('category', initialCategory.id);
      }
      
      if (formData.image) {
        data.append('image', formData.image);
      }

      let response;
      if (product) {
        response = await updateProduct(product.id, data);
        alert('商品更新成功！');
        onSuccess(response.data, true);
      } else {
        response = await createProduct(data);
        alert('商品新增成功！');
        onSuccess(response.data, false);
      }
    } catch (err) {
      setError('提交失敗，請稍後再試。');
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>
            {product ? '編輯商品' : `新增商品 - ${initialCategory?.name || ''}`}
          </h2>
          <button className="modal-close-btn" onClick={onCancel}>
            <FaTimes />
          </button>
        </div>

        <form className="product-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">
              商品名稱 <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="price">
              價格 (NT$) <span className="required">*</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="^\d+(\.\d{0,2})?$"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleInputChange}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="例如：67 或 67.50"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">商品描述</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="4"
            />
          </div>

          <div className="form-group">
            <label htmlFor="image">商品圖片</label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="service_type">
              服務類型 <span className="required">*</span>
            </label>
            <select
              id="service_type"
              name="service_type"
              value={formData.service_type}
              onChange={handleInputChange}
              required
            >
              <option value="both">內用與外帶</option>
              <option value="dine_in">內用</option>
              <option value="takeaway">外帶</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              {product ? '更新' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
