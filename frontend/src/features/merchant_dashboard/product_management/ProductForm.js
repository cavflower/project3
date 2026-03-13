import React, { useState, useEffect } from 'react';
import { FaTimes, FaTag } from 'react-icons/fa';
import styles from './ProductForm.module.css';
import { createProduct, updateProduct } from '../../../api/productApi';
import { getIngredients } from '../../../api/inventoryApi';

const ProductForm = ({ product, initialCategory, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    description: '',
    image: null,
    service_type: 'both',
    food_tags: [],
  });
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [selectedIngredientUsage, setSelectedIngredientUsage] = useState('');

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
        food_tags: product.food_tags || [],
      });

      const existingRecipe = Array.isArray(product.ingredient_links)
        ? product.ingredient_links.map(link => ({
            ingredient: link.ingredient,
            ingredient_name: link.ingredient_name,
            ingredient_unit_display: link.ingredient_unit_display,
            quantity_used: String(link.quantity_used),
          }))
        : [];
      setRecipeIngredients(existingRecipe);
    } else {
      setRecipeIngredients([]);
    }
  }, [product]);

  useEffect(() => {
    const loadIngredients = async () => {
      try {
        const ingredientData = await getIngredients();
        setIngredients(ingredientData || []);
      } catch (err) {
        console.error('[ProductForm] Failed to load ingredients:', err);
      }
    };

    loadIngredients();
  }, []);

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

  const handleAddTag = (e) => {
    e.preventDefault();
    const trimmedTag = tagInput.trim();

    if (!trimmedTag) return;

    // 檢查是否已存在
    if (formData.food_tags.includes(trimmedTag)) {
      alert('此標籤已存在');
      return;
    }

    setFormData(prev => ({
      ...prev,
      food_tags: [...prev.food_tags, trimmedTag]
    }));
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      food_tags: prev.food_tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(e);
    }
  };

  const handleAddRecipeIngredient = () => {
    if (!selectedIngredientId) {
      setError('請先選擇原物料');
      return;
    }

    const usage = Number(selectedIngredientUsage);
    if (!selectedIngredientUsage || Number.isNaN(usage) || usage <= 0) {
      setError('請輸入有效的每份使用量（需大於 0）');
      return;
    }

    const ingredientId = Number(selectedIngredientId);
    const picked = ingredients.find(item => item.id === ingredientId);
    if (!picked) {
      setError('找不到該原物料');
      return;
    }

    if (recipeIngredients.some(item => item.ingredient === ingredientId)) {
      setError('此原物料已在配方中');
      return;
    }

    setRecipeIngredients(prev => [
      ...prev,
      {
        ingredient: ingredientId,
        ingredient_name: picked.name,
        ingredient_unit_display: picked.unit_display,
        quantity_used: usage.toString(),
      },
    ]);
    setSelectedIngredientId('');
    setSelectedIngredientUsage('');
    setError('');
  };

  const handleRemoveRecipeIngredient = (ingredientId) => {
    setRecipeIngredients(prev => prev.filter(item => item.ingredient !== ingredientId));
  };

  const handleRecipeUsageChange = (ingredientId, value) => {
    setRecipeIngredients(prev =>
      prev.map(item => (
        item.ingredient === ingredientId ? { ...item, quantity_used: value } : item
      ))
    );
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

      // 加入食物標籤（每個標籤單獨 append）
      formData.food_tags.forEach(tag => {
        data.append('food_tags', tag);
      });

      const normalizedRecipe = recipeIngredients.map(item => ({
        ingredient: Number(item.ingredient),
        quantity_used: Number(item.quantity_used),
      }));

      const hasInvalidRecipe = normalizedRecipe.some(
        item => Number.isNaN(item.quantity_used) || item.quantity_used <= 0
      );
      if (hasInvalidRecipe) {
        setError('配方中的每份使用量必須是大於 0 的數字');
        return;
      }

      data.append('recipe_ingredients', JSON.stringify(normalizedRecipe));

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
      const data = err?.response?.data;
      if (typeof data === 'string') {
        setError(data);
      } else if (data && typeof data === 'object') {
        const firstEntry = Object.entries(data)[0];
        if (firstEntry) {
          const [field, value] = firstEntry;
          const message = Array.isArray(value) ? value.join('、') : String(value);
          setError(`${field}: ${message}`);
        } else {
          setError('提交失敗，請稍後再試。');
        }
      } else {
        setError('提交失敗，請稍後再試。');
      }
      console.error(err);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>
            {product ? '編輯商品' : `新增商品 - ${initialCategory?.name || ''}`}
          </h2>
          <button className={styles.modalCloseBtn} onClick={onCancel}>
            <FaTimes />
          </button>
        </div>

        <form className={styles.productForm} onSubmit={handleSubmit}>
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="name">
              商品名稱 <span className={styles.required}>*</span>
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

          <div className={styles.formGroup}>
            <label htmlFor="price">
              價格 (NT$) <span className={styles.required}>*</span>
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

          <div className={styles.formGroup}>
            <label htmlFor="description">商品描述</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="4"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="image">商品圖片</label>
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="service_type">
              服務類型 <span className={styles.required}>*</span>
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

          <div className={styles.formGroup}>
            <label>
              <FaTag /> 食物標籤（用於個人化推薦）
            </label>
            <p className={styles.formHint}>輸入此商品的特性標籤，例如：辣、素食、健康</p>

            <div className={styles.tagInputContainer}>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="輸入標籤後按 Enter"
                maxLength={20}
              />
              <button
                type="button"
                className={styles.addTagBtn}
                onClick={handleAddTag}
              >
                新增
              </button>
            </div>

            {formData.food_tags.length > 0 && (
              <div className={styles.foodTagsDisplay}>
                {formData.food_tags.map((tag, index) => (
                  <span key={index} className={styles.foodTagItem}>
                    {tag}
                    <button
                      type="button"
                      className={styles.removeTagBtn}
                      onClick={() => handleRemoveTag(tag)}
                      title="移除標籤"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label>商品原物料配方（每售出 1 份自動扣庫存）</label>
            <p className={styles.formHint}>設定每份商品會使用的原物料和數量，建立訂單時會自動扣減。</p>

            <div className={styles.recipeAddRow}>
              <select
                value={selectedIngredientId}
                onChange={(e) => setSelectedIngredientId(e.target.value)}
              >
                <option value="">請選擇原物料</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}（目前庫存: {ingredient.quantity} {ingredient.unit_display}）
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="0"
                step="0.01"
                value={selectedIngredientUsage}
                onChange={(e) => setSelectedIngredientUsage(e.target.value)}
                placeholder="每份使用量"
              />

              <button
                type="button"
                className={styles.addTagBtn}
                onClick={handleAddRecipeIngredient}
              >
                加入配方
              </button>
            </div>

            {recipeIngredients.length > 0 && (
              <div className={styles.recipeList}>
                {recipeIngredients.map((item) => (
                  <div key={item.ingredient} className={styles.recipeItem}>
                    <div className={styles.recipeItemName}>
                      {item.ingredient_name}
                    </div>
                    <div className={styles.recipeItemUsage}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantity_used}
                        onChange={(e) => handleRecipeUsageChange(item.ingredient, e.target.value)}
                      />
                      <span>{item.ingredient_unit_display}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.removeTagBtn}
                      onClick={() => handleRemoveRecipeIngredient(item.ingredient)}
                      title="移除原物料"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
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
