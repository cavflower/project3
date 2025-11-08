import React, { useState, useEffect } from 'react';
import { createProduct, updateProduct } from '../../../api/productApi';
import './ProductForm.css';

const ProductForm = ({ product, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    image: null,
  });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description,
        price: Number(product.price).toFixed(0),
        image: null, // Image is not pre-filled for editing
      });
      if (product.image && !product.image.startsWith('http')) {
        setPreview(`http://127.0.0.1:8000${product.image}`);
      } else {
        setPreview(product.image);
      }
    } else {
      // Reset form for new product
      setFormData({ name: '', description: '', price: '', image: null });
      setPreview(null);
    }
  }, [product]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const dataToSend = new FormData();
    dataToSend.append('name', formData.name);
    dataToSend.append('description', formData.description);
    dataToSend.append('price', formData.price);
    // Only append image if a new one is selected
    if (formData.image) {
      dataToSend.append('image', formData.image);
    }

    try {
      if (product) {
        await updateProduct(product.id, dataToSend);
      } else {
        await createProduct(dataToSend);
      }
      onSuccess(); // Notify parent component of success
    } catch (err) {
      console.error('Failed to save product:', err.response?.data);
      setError('儲存商品失敗，請檢查所有欄位是否正確。');
    }
  };

  return (
    <div className="product-form-container">
      <h2>{product ? '編輯商品' : '新增商品'}</h2>
      {error && <p className="error-message">{error}</p>}
      <form onSubmit={handleSubmit} className="product-form">
        <div className="form-group">
          <label htmlFor="name">商品名稱</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="description">商品描述</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="4"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="price">價格</label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            required
            min="0"
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
          {product && <small>若不更新圖片，請勿選擇檔案。</small>}
        </div>
        {preview && (
          <div className="image-preview">
            <img src={preview} alt="Preview" />
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="btn-submit">
            {product ? '更新商品' : '儲存商品'}
          </button>
          <button type="button" className="btn-cancel" onClick={onCancel}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
