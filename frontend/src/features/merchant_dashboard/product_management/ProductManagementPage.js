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
      console.log('[ProductManagement] Fetching products...');
      console.log('[ProductManagement] merchant_accessToken:', localStorage.getItem('merchant_accessToken')?.substring(0, 50));
      const response = await getProducts();
      console.log('[ProductManagement] Products loaded:', response.data);
      setProducts(response.data);
      setError('');
    } catch (err) {
      console.error('[ProductManagement] Error fetching products:', err);
      console.error('[ProductManagement] Error response:', err.response);
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
        fetchProducts();
      } catch (err) {
        setError('刪除商品失敗。');
        console.error(err);
      }
    }
  };

  const handleFormSuccess = () => {
    setIsFormVisible(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) {
      return 'https://via.placeholder.com/150/CCCCCC/FFFFFF?Text=No+Image';
    }
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    return `http://127.0.0.1:8000${imagePath}`;
  };

  // 新增：將服務類型轉換為中文
  const getServiceTypeLabel = (serviceType) => {
    const types = {
      'dine_in': '內用',
      'takeaway': '外帶',
      'both': '內用與外帶',
    };
    return types[serviceType] || '內用與外帶';
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
                {/* 新增：顯示服務類型 */}
                <p className="service-type-badge">
                  <span className="badge">{getServiceTypeLabel(product.service_type)}</span>
                </p>
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
