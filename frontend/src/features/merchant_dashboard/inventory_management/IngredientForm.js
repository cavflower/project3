import React, { useState, useEffect } from 'react';
import { createIngredient, updateIngredient } from '../../../api/inventoryApi';
import './IngredientForm.css';

function IngredientForm({ ingredient, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: 0,
    unit: 'kg',
    cost_per_unit: 0,
    supplier: '',
    minimum_stock: 0,
    notes: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ingredient) {
      setFormData({
        name: ingredient.name || '',
        category: ingredient.category || '',
        quantity: ingredient.quantity || 0,
        unit: ingredient.unit || 'kg',
        cost_per_unit: ingredient.cost_per_unit || 0,
        supplier: ingredient.supplier || '',
        minimum_stock: ingredient.minimum_stock || 0,
        notes: ingredient.notes || ''
      });
    }
  }, [ingredient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('請輸入原料名稱');
      return;
    }

    try {
      setLoading(true);
      
      if (ingredient) {
        await updateIngredient(ingredient.id, formData);
        alert('更新成功');
      } else {
        await createIngredient(formData);
        alert('新增成功');
      }
      
      onClose();
    } catch (error) {
      console.error('操作失敗:', error);
      alert(ingredient ? '更新失敗' : '新增失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{ingredient ? '編輯原物料' : '新增原物料'}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="ingredient-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">原料名稱 *</label>
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
              <label htmlFor="category">類別</label>
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="例：蔬菜、肉類、調味料"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="quantity">數量</label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="unit">單位</label>
              <select
                id="unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
              >
                <option value="kg">公斤</option>
                <option value="g">公克</option>
                <option value="l">公升</option>
                <option value="ml">毫升</option>
                <option value="piece">個</option>
                <option value="pack">包</option>
                <option value="box">箱</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cost_per_unit">單價 (NT$)</label>
              <input
                type="number"
                id="cost_per_unit"
                name="cost_per_unit"
                value={formData.cost_per_unit}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="minimum_stock">最低庫存量</label>
              <input
                type="number"
                id="minimum_stock"
                name="minimum_stock"
                value={formData.minimum_stock}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="supplier">供應商</label>
            <input
              type="text"
              id="supplier"
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="notes">備註</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              取消
            </button>
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? '處理中...' : (ingredient ? '更新' : '新增')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default IngredientForm;
