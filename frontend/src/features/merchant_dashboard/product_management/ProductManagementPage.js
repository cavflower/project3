import React, { useState, useEffect, useCallback } from 'react';
import { FaEdit, FaTrash, FaPlus, FaFolder, FaCog } from 'react-icons/fa';
import ProductForm from './ProductForm';
import ProductCategoryForm from './ProductCategoryForm';
import ProductSpecificationForm from './ProductSpecificationForm';
import FoodTags from '../../../components/common/FoodTags';
import styles from './ProductManagementPage.module.css';
import { getProducts, getProductDetail, deleteProduct, getProductCategories, deleteProductCategory } from '../../../api/productApi';
import { getMyStore, updateStore } from '../../../api/storeApi';

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
  const [storeId, setStoreId] = useState(null);
  const [enableTakeout, setEnableTakeout] = useState(true);
  const [isTakeoutUpdating, setIsTakeoutUpdating] = useState(false);
  const [takeoutError, setTakeoutError] = useState('');

  const fetchStoreSettings = useCallback(async () => {
    try {
      const response = await getMyStore({ lite: 1 });
      setStoreId(response.data.id);
      setEnableTakeout(response.data.enable_takeout !== false);
      setTakeoutError('');
    } catch (err) {
      console.error('[ProductManagement] Error fetching store settings:', err);
      setStoreId(null);
      setTakeoutError('無法讀取店家外帶設定，請先完成店家資料設定。');
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      console.log('[ProductManagement] Fetching products...');
      const response = await getProducts({ include_ingredients: 0 });
      console.log('[ProductManagement] Products loaded:', response.data);
      setProducts(response.data);
      setError('');
    } catch (err) {
      console.error('[ProductManagement] Error fetching products:', err);
      setError('無法獲取商品列表，請稍後再試。');
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      console.log('[ProductManagement] Fetching categories...');
      const response = await getProductCategories();
      console.log('[ProductManagement] Categories loaded:', response.data);
      setCategories(response.data);
    } catch (err) {
      console.error('[ProductManagement] Error fetching categories:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchProducts(), fetchCategories(), fetchStoreSettings()]);
  }, [fetchProducts, fetchCategories, fetchStoreSettings]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleEditClick = async (product) => {
    setEditingProduct(product);
    setSelectedCategory(categories.find(cat => cat.id === product.category));
    setIsFormVisible(true);
    setError('');

    try {
      const response = await getProductDetail(product.id, { include_ingredients: 1 });
      const fullProduct = response.data;
      setEditingProduct(fullProduct);

      // 找到商品所屬的類別
    } catch (err) {
      console.error('[ProductManagement] Error fetching product detail:', err);
      setError('無法載入商品詳細資料，請稍後再試。');
    }
  };

  const handleDelete = async (productId) => {
    if (window.confirm('您確定要刪除此商品嗎？')) {
      const previousProducts = products;
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
      try {
        await deleteProduct(productId);
        setError('');
      } catch (err) {
        setProducts(previousProducts);
        setError('刪除商品失敗。');
        console.error(err);
      }
    }
  };

  const handleFormSuccess = (productData, isEdit = false) => {
    setProducts(prevProducts => {
      if (isEdit) {
        return prevProducts.map(product => (
          product.id === productData.id ? { ...product, ...productData } : product
        ));
      }
      return [productData, ...prevProducts];
    });
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

  const handleToggleTakeout = async () => {
    if (!storeId) {
      setError('尚未建立店家資料，請先至店家設定完成基本資料。');
      return;
    }

    const nextValue = !enableTakeout;
    const data = new FormData();
    data.append('enable_takeout', nextValue ? 'true' : 'false');

    try {
      setIsTakeoutUpdating(true);
      await updateStore(storeId, data);
      setEnableTakeout(nextValue);
      setTakeoutError('');
    } catch (err) {
      console.error('[ProductManagement] Error updating takeout setting:', err);
      setTakeoutError('更新外帶點餐開關失敗，請稍後再試。');
    } finally {
      setIsTakeoutUpdating(false);
    }
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
    <div className={styles.productManagementPage}>
      <header className={styles.pageHeader}>
        <h1>商品管理</h1>
      </header>

      {error && <p className={styles.errorMessage}>{error}</p>}

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

      <div className={styles.productContentHeader}>
        <div className={styles.featureToggleCard}>
          <div className={styles.featureToggleText}>
            <h3>外帶點餐功能</h3>
            <p>{enableTakeout ? '顧客可進行外帶點餐' : '目前已暫停外帶點餐'}</p>
          </div>
          <button
            type="button"
            className={`${styles.toggleSwitch} ${enableTakeout ? styles.toggleOn : styles.toggleOff}`}
            onClick={handleToggleTakeout}
            disabled={isTakeoutUpdating || !storeId}
            aria-pressed={enableTakeout}
            title={enableTakeout ? '點擊可關閉外帶點餐' : '點擊可開啟外帶點餐'}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
        <button className={styles.productBtnAdd} onClick={handleAddCategoryClick}>
          <FaPlus /> 新增類別
        </button>
      </div>

      {takeoutError && <p className={styles.errorMessage}>{takeoutError}</p>}

      <div className={styles.categoriesSections}>
        {Object.values(groupProductsByCategory()).map(({ category, products: categoryProducts }) => (
          <div key={category.id} className={styles.categorySection}>
            <div className={styles.categoryHeader}>
              <div className={styles.categoryTitle}>
                <FaFolder className={styles.categoryIcon} />
                <h3>{category.name}</h3>
                {category.description && (
                  <span className={styles.categoryDescription}>{category.description}</span>
                )}
              </div>
              <div className={styles.categoryActions}>
                <button
                  className={`${styles.productBtnAdd} ${styles.btnCompact}`}
                  onClick={() => handleAddClick(category)}
                >
                  <FaPlus /> 新增商品
                </button>
                <button
                  className={`${styles.productBtnSecondary} ${styles.btnIcon}`}
                  onClick={() => handleEditCategory(category)}
                  title="編輯類別"
                >
                  <FaEdit />
                </button>
                <button
                  className={`${styles.productBtnDanger} ${styles.btnIcon}`}
                  onClick={() => handleDeleteCategory(category.id)}
                  title="刪除類別"
                >
                  <FaTrash />
                </button>
              </div>
            </div>

            <div className={styles.productList}>
              {categoryProducts.length === 0 ? (
                <div className={styles.emptyMessage}>此類別尚無商品</div>
              ) : (
                categoryProducts.map((product) => (
                  <div key={product.id} className={styles.productCardManage}>
                    <img src={getImageUrl(product.image)} alt={product.name} className={styles.productImageManage} />
                    <div className={styles.productInfoManage}>
                      <div className={styles.productNameHeader}>
                        <h3>{product.name}</h3>
                        <span className={styles.badge}>{getServiceTypeLabel(product.service_type)}</span>
                      </div>
                      <p className={styles.price}>NT$ {Number(product.price).toFixed(0)}</p>
                      <p>{product.description}</p>
                      {product.food_tags && product.food_tags.length > 0 && (
                        <FoodTags tags={product.food_tags} maxDisplay={5} />
                      )}
                    </div>
                    <div className={styles.productActionsManage}>
                      <button className={`${styles.iconBtn} ${styles.iconBtnSpec}`} onClick={() => { setSpecProduct(product); setIsSpecFormVisible(true); }} title="規格設定">
                        <FaCog />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.iconBtnEdit}`} onClick={() => handleEditClick(product)} title="編輯">
                        <FaEdit />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.iconBtnDelete}`} onClick={() => handleDelete(product.id)} title="刪除">
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
          <div className={styles.emptyState}>
            <p>尚未建立任何類別，請先新增類別</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManagementPage;
