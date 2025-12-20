import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaPlus, FaFolder, FaCog } from 'react-icons/fa';
import ProductForm from './ProductForm';
import ProductCategoryForm from './ProductCategoryForm';
import ProductSpecificationForm from './ProductSpecificationForm';
import FoodTags from '../../../components/common/FoodTags';
import './ProductManagementPage.css';
import { getProducts, deleteProduct, getProductCategories, deleteProductCategory } from '../../../api/productApi';

const ProductManagementPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isCategoryFormVisible, setIsCategoryFormVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [error, setError] = useState('');
  const [isSpecFormVisible, setIsSpecFormVisible] = useState(false);
  const [specProduct, setSpecProduct] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchProducts(), fetchCategories()]);
  };

  const fetchProducts = async () => {
    try {
      console.log('[ProductManagement] Fetching products...');
      const response = await getProducts();
      console.log('[ProductManagement] Products loaded:', response.data);
      setProducts(response.data);
      setError('');
    } catch (err) {
      console.error('[ProductManagement] Error fetching products:', err);
      setError('無法獲取商品列表，請稍後再試。');
    }
  };

  const fetchCategories = async () => {
    try {
      console.log('[ProductManagement] Fetching categories...');
      const response = await getProductCategories();
      console.log('[ProductManagement] Categories loaded:', response.data);
      setCategories(response.data);
    } catch (err) {
      console.error('[ProductManagement] Error fetching categories:', err);
    }
  };

  const handleAddCategoryClick = () => {
    setEditingCategory(null);
    setIsCategoryFormVisible(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setIsCategoryFormVisible(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    const categoryProducts = products.filter(p => p.category === categoryId);

    if (categoryProducts.length > 0) {
      alert(`此類別下還有 ${categoryProducts.length} 個商品，無法刪除！\n請先刪除或移動該類別下的所有商品。`);
      return;
    }

    if (!window.confirm('確定要刪除此類別嗎？')) return;

    try {
      await deleteProductCategory(categoryId);
      alert('類別刪除成功！');
      fetchData();
    } catch (err) {
      alert('刪除類別失敗。');
      console.error(err);
    }
  };

  const handleAddClick = (category = null) => {
    setEditingProduct(null);
    setSelectedCategory(category);
    setIsFormVisible(true);
  };

  const handleEditClick = (product) => {
    setEditingProduct(product);
    // 找到商品所屬的類別
    const productCategory = categories.find(cat => cat.id === product.category);
    setSelectedCategory(productCategory);
    setIsFormVisible(true);
  };

  const handleDelete = async (productId) => {
    if (window.confirm('您確定要刪除此商品嗎？')) {
      try {
        await deleteProduct(productId);
        setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
        setError('');
      } catch (err) {
        setError('刪除商品失敗。');
        console.error(err);
      }
    }
  };

  const handleFormSuccess = (productData, isEdit = false) => {
    fetchData();
    setIsFormVisible(false);
    setEditingProduct(null);
    setSelectedCategory(null);
    setError('');
  };

  const handleCategoryFormSuccess = () => {
    fetchData();
    setIsCategoryFormVisible(false);
    setEditingCategory(null);
  };

  // 按類別分組產品
  const groupProductsByCategory = () => {
    const grouped = {};

    // 初始化所有啟用的類別
    categories
      .filter(cat => cat.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .forEach(category => {
        grouped[category.id] = {
          category,
          products: []
        };
      });

    // 將產品分組到對應的類別
    products.forEach(product => {
      if (product.category && grouped[product.category]) {
        grouped[product.category].products.push(product);
      }
    });

    return grouped;
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
      </header>

      {error && <p className="error-message">{error}</p>}

      {isCategoryFormVisible && (
        <ProductCategoryForm
          category={editingCategory}
          onClose={() => {
            setIsCategoryFormVisible(false);
            setEditingCategory(null);
          }}
          onSuccess={handleCategoryFormSuccess}
        />
      )}

      {isFormVisible && (
        <ProductForm
          product={editingProduct}
          initialCategory={selectedCategory}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setIsFormVisible(false);
            setEditingProduct(null);
            setSelectedCategory(null);
          }}
        />
      )}

      {isSpecFormVisible && specProduct && (
        <ProductSpecificationForm
          product={specProduct}
          onClose={() => {
            setIsSpecFormVisible(false);
            setSpecProduct(null);
          }}
        />
      )}

      <div className="product-content-header">
        <button className="product-btn-add" onClick={handleAddCategoryClick}>
          <FaPlus /> 新增類別
        </button>
      </div>

      <div className="categories-sections">
        {Object.values(groupProductsByCategory()).map(({ category, products: categoryProducts }) => (
          <div key={category.id} className="category-section">
            <div className="category-header">
              <div className="category-title">
                <FaFolder className="category-icon" />
                <h3>{category.name}</h3>
                {category.description && (
                  <span className="category-description">{category.description}</span>
                )}
              </div>
              <div className="category-actions">
                <button
                  className="product-btn-add btn-compact"
                  onClick={() => handleAddClick(category)}
                >
                  <FaPlus /> 新增商品
                </button>
                <button
                  className="product-btn-secondary btn-icon"
                  onClick={() => handleEditCategory(category)}
                  title="編輯類別"
                >
                  <FaEdit />
                </button>
                <button
                  className="product-btn-danger btn-icon"
                  onClick={() => handleDeleteCategory(category.id)}
                  title="刪除類別"
                >
                  <FaTrash />
                </button>
              </div>
            </div>

            <div className="product-list">
              {categoryProducts.length === 0 ? (
                <div className="empty-message">此類別尚無商品</div>
              ) : (
                categoryProducts.map((product) => (
                  <div key={product.id} className="product-card-manage">
                    <img src={getImageUrl(product.image)} alt={product.name} className="product-image-manage" />
                    <div className="product-info-manage">
                      <div className="product-name-header">
                        <h3>{product.name}</h3>
                        <span className="badge">{getServiceTypeLabel(product.service_type)}</span>
                      </div>
                      <p className="price">NT$ {Number(product.price).toFixed(0)}</p>
                      <p>{product.description}</p>
                      {product.food_tags && product.food_tags.length > 0 && (
                        <FoodTags tags={product.food_tags} maxDisplay={5} />
                      )}
                    </div>
                    <div className="product-actions-manage">
                      <button className="icon-btn spec-btn" onClick={() => { setSpecProduct(product); setIsSpecFormVisible(true); }} title="規格設定">
                        <FaCog />
                      </button>
                      <button className="icon-btn edit-btn" onClick={() => handleEditClick(product)} title="編輯">
                        <FaEdit />
                      </button>
                      <button className="icon-btn delete-btn" onClick={() => handleDelete(product.id)} title="刪除">
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

        {categories.filter(cat => cat.is_active).length === 0 && (
          <div className="empty-state">
            <p>尚未建立任何類別，請先新增類別</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManagementPage;
