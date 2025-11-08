import React, { useState, useEffect } from 'react';
import ProductForm from './ProductForm';
import './ProductManagementPage.css';
import { getProducts, deleteProduct } from '../../../api/productApi';

const ProductManagementPage = () => {
  const [products, setProducts] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await getProducts();
      setProducts(response.data);
      setError('');
    } catch (err) {
      setError('無法獲取商品列表，請稍後再試。');
      console.error(err);
    }
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setIsFormVisible(true);
  };

  const handleEditClick = (product) => {
    setEditingProduct(product);
    setIsFormVisible(true);
  };

  const handleDelete = async (productId) => {
    if (window.confirm('您確定要刪除此商品嗎？')) {
      try {
        await deleteProduct(productId);
        fetchProducts(); // 重新獲取列表
      } catch (err) {
        setError('刪除商品失敗。');
        console.error(err);
      }
    }
  };

  const handleFormSuccess = () => {
    setIsFormVisible(false);
    setEditingProduct(null);
    fetchProducts(); // 重新獲取列表
  };

  // 處理圖片 URL，確保後端相對路徑能正確顯示
  const getImageUrl = (imagePath) => {
    if (!imagePath) {
      return 'https://via.placeholder.com/150/CCCCCC/FFFFFF?Text=No+Image';
    }
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    return `http://127.0.0.1:8000${imagePath}`;
  };

  return (
    <div className="product-management-page">
      <header className="page-header">
        <h1>商品管理</h1>
        {!isFormVisible && (
          <button className="action-btn add-btn" onClick={handleAddClick}>
            + 新增商品
          </button>
        )}
      </header>

      {error && <p className="error-message">{error}</p>}

      {isFormVisible ? (
        <ProductForm
          product={editingProduct}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormVisible(false)}
        />
      ) : (
        <div className="product-list">
          {products.length > 0 ? products.map((product) => (
            <div key={product.id} className="product-card-manage">
              <img src={getImageUrl(product.image)} alt={product.name} className="product-image-manage" />
              <div className="product-info-manage">
                <h3>{product.name}</h3>
                <p className="price">NT$ {Number(product.price).toFixed(0)}</p>
                <p>{product.description}</p>
              </div>
              <div className="product-actions-manage">
                <button className="action-btn edit-btn" onClick={() => handleEditClick(product)}>編輯</button>
                <button className="action-btn delete-btn" onClick={() => handleDelete(product.id)}>刪除</button>
              </div>
            </div>
          )) : <p>您尚未新增任何商品。</p>}
        </div>
      )}
    </div>
  );
};

export default ProductManagementPage;
