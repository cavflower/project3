import React, { useState, useEffect } from 'react';
import './ProductForm.css';
import { createProduct, updateProduct } from '../../../api/productApi';

const ProductForm = ({ product, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    image: null,
    service_type: 'both', // 新增服務類型
  });
  const [error, setError] = useState('');

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

  const handleServiceTypeChange = (e) => {
    setFormData(prev => ({
      ...prev,
      service_type: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('price', formData.price);
      data.append('description', formData.description);
      data.append('service_type', formData.service_type);
      if (formData.image) {
        data.append('image', formData.image);
      }

      let response;
      if (product) {
        response = await updateProduct(product.id, data);
        onSuccess(response.data, true);
      } else {
        response = await createProduct(data);
        onSuccess(response.data, false);
      }
    } catch (err) {
      setError('提交失敗，請稍後再試。');
      console.error(err);
    }
  };

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <h2>{product ? '編輯商品' : '新增商品'}</h2>

      {error && <p className="error-message">{error}</p>}

      <div className="form-group">
        <label htmlFor="name">商品名稱 *</label>
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
        <label htmlFor="price">價格 (NT$) *</label>
        <input
          type="number"
          id="price"
          name="price"
          value={formData.price}
          onChange={handleInputChange}
          step="0.01"
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

      {/* 新增：服務類型選擇 */}
      <div className="form-group">
        <label>服務類型 *</label>
        <div className="service-type-container">
          <label className="radio-item">
            <input
              type="radio"
              name="service_type"
              value="dine_in"
              checked={formData.service_type === 'dine_in'}
              onChange={handleServiceTypeChange}
            />
            <span>內用</span>
          </label>
          <label className="radio-item">
            <input
              type="radio"
              name="service_type"
              value="takeaway"
              checked={formData.service_type === 'takeaway'}
              onChange={handleServiceTypeChange}
            />
            <span>外帶</span>
          </label>
          <label className="radio-item">
            <input
              type="radio"
              name="service_type"
              value="both"
              checked={formData.service_type === 'both'}
              onChange={handleServiceTypeChange}
            />
            <span>內用與外帶</span>
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="action-btn submit-btn">
          {product ? '更新' : '新增'}
        </button>
        <button type="button" className="action-btn cancel-btn" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
