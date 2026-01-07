import React, { useState, useEffect } from 'react';
import { FaLeaf, FaPlus, FaEdit, FaTrash, FaFolder } from 'react-icons/fa';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import SurplusFoodForm from './SurplusFoodForm';
import SurplusFoodCard from '../../components/surplusfood/SurplusFoodCard';
import CategoryForm from './CategoryForm';
import styles from './SurplusFoodList.module.css';

const SurplusFoodList = () => {
  const [surplusFoods, setSurplusFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalType, setModalType] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadCategories(), loadSurplusFoods()]);
  };

  const loadCategories = async () => {
    try {
      const data = await surplusFoodApi.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('載入類別失敗:', error);
    }
  };

  const loadSurplusFoods = async () => {
    try {
      setLoading(true);
      const data = await surplusFoodApi.getSurplusFoods({});
      setSurplusFoods(data);
    } catch (error) {
      console.error('載入惜福食品失敗:', error);
      alert('載入惜福食品失敗');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (id) => {
    try {
      await surplusFoodApi.publishSurplusFood(id);
      alert('上架成功！');
      loadSurplusFoods();
    } catch (error) {
      console.error('上架失敗:', error);
      alert(error.response?.data?.error || '上架失敗');
    }
  };

  const handleUnpublish = async (id) => {
    try {
      await surplusFoodApi.unpublishSurplusFood(id);
      alert('下架成功！');
      loadSurplusFoods();
    } catch (error) {
      console.error('下架失敗:', error);
      alert('下架失敗');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除嗎？')) return;

    try {
      await surplusFoodApi.deleteSurplusFood(id);
      alert('刪除成功！');
      loadSurplusFoods();
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗');
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setModalType('editFood');
    setShowFoodModal(true);
  };

  const handleCreateFood = (category) => {
    setSelectedItem(null);
    setSelectedCategory(category);
    setModalType('createFood');
    setShowFoodModal(true);
  };

  const handleCreateCategory = () => {
    setSelectedCategory(null);
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category) => {
    setSelectedCategory(category);
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    // 檢查該類別下是否有惜福品
    const categoryFoods = surplusFoods.filter(food => food.category === categoryId);

    if (categoryFoods.length > 0) {
      alert(`此類別下還有 ${categoryFoods.length} 個惜福品，無法刪除！\n請先刪除或移動該類別下的所有惜福品。`);
      return;
    }

    if (!window.confirm('確定要刪除此類別嗎？此操作無法復原。')) return;

    try {
      await surplusFoodApi.deleteCategory(categoryId);
      alert('類別刪除成功！');
      loadData();
    } catch (error) {
      console.error('刪除失敗:', error);
      alert(error.response?.data?.error || '刪除失敗');
    }
  };

  const handleCloseFoodModal = () => {
    setShowFoodModal(false);
    setSelectedItem(null);
    setSelectedCategory(null);
    setModalType('');
  };

  const handleCloseCategoryModal = () => {
    setShowCategoryModal(false);
    setSelectedCategory(null);
  };

  // 按類別分組惜福品
  const groupFoodsByCategory = () => {
    const grouped = {};

    // 初始化所有啟用的類別
    categories
      .filter(cat => cat.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .forEach(category => {
        grouped[category.id] = {
          category,
          foods: []
        };
      });

    // 將惜福品分組到對應的類別
    surplusFoods.forEach(food => {
      if (food.category && grouped[food.category]) {
        grouped[food.category].foods.push(food);
      }
    });

    return grouped;
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.contentHeader}>
        <h2>惜福品管理</h2>
        <button
          className={styles.btnPrimary}
          onClick={handleCreateCategory}
        >
          <FaPlus /> 新增類別
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>載入中...</div>
      ) : (
        <div className={styles.categoriesSections}>
          {Object.values(groupFoodsByCategory()).map(({ category, foods }) => (
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
                    className={`${styles.btnPrimary} ${styles.btnCompact}`}
                    onClick={() => handleCreateFood(category)}
                  >
                    <FaPlus /> 新增惜福品
                  </button>
                  <button
                    className={`${styles.btnSecondary} ${styles.btnIcon}`}
                    onClick={() => handleEditCategory(category)}
                    title="編輯類別"
                  >
                    <FaEdit />
                  </button>
                  <button
                    className={`${styles.btnDanger} ${styles.btnIcon}`}
                    onClick={() => handleDeleteCategory(category.id)}
                    title="刪除類別"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className={styles.foodsList}>
                {foods.length === 0 ? (
                  <div className={styles.emptyMessage}>此類別尚無惜福品</div>
                ) : (
                  foods.map(food => (
                    <SurplusFoodCard
                      key={food.id}
                      food={food}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onPublish={handlePublish}
                      onUnpublish={handleUnpublish}
                    />
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
      )}

      {showFoodModal && (
        <SurplusFoodForm
          type={modalType}
          item={selectedItem}
          initialCategory={selectedCategory}
          onClose={handleCloseFoodModal}
          onSuccess={loadData}
        />
      )}

      {showCategoryModal && (
        <CategoryForm
          category={selectedCategory}
          onClose={handleCloseCategoryModal}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};

export default SurplusFoodList;
