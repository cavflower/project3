import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getIngredients,
  deleteIngredient,
  exportTodayIngredients
} from '../../../api/inventoryApi';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import IngredientForm from './IngredientForm';
import './InventoryManagementPage.css';

function InventoryManagementPage() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients();
      setIngredients(data);
    } catch (error) {
      console.error('取得原物料失敗:', error);
      alert('取得原物料清單失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('確定要刪除這個原物料品項嗎？')) {
      try {
        await deleteIngredient(id);
        alert('刪除成功');
        fetchIngredients();
      } catch (error) {
        console.error('刪除失敗:', error);
        alert('刪除失敗');
      }
    }
  };

  const handleEdit = (ingredient) => {
    setEditingIngredient(ingredient);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingIngredient(null);
    setShowForm(true);
  };

  const handleFormClose = (shouldRefresh = false) => {
    setShowForm(false);
    setEditingIngredient(null);
    if (shouldRefresh) {
      fetchIngredients();
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportTodayIngredients();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `inventory_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alert('匯出成功');
    } catch (error) {
      console.error('匯出失敗:', error);
      alert('匯出失敗');
    }
  };

  // 取得所有類別
  const categories = [...new Set(ingredients.map(item => item.category).filter(Boolean))];

  // 篩選原物料
  const filteredIngredients = ingredients.filter(ingredient => {
    const matchesSearch = ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ingredient.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || ingredient.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="loading">載入中...</div>;
  }

  return (
    <div className="inventory-management-page">
      <div className="page-header">
        <h1>原物料管理</h1>
        <button onClick={() => navigate('/dashboard')} className="back-button">
          返回儀表板
        </button>
      </div>

      <div className="controls">
        <div className="search-filter">
          <input
            type="text"
            placeholder="搜尋原物料名稱或供應商..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="">所有類別</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="action-buttons">
          <button onClick={handleAdd} className="add-button">
            + 新增原物料
          </button>
          <button onClick={handleExport} className="export-button">
            匯出當日清單
          </button>
        </div>
      </div>

      <div className="chart-container">
        <h3>庫存數量概覽</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={filteredIngredients}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantity" name="庫存數量">
                {filteredIngredients.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.is_low_stock ? '#f44336' : '#8884d8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="ingredients-table-container">
        <table className="ingredients-table">
          <thead>
            <tr>
              <th>名稱</th>
              <th>類別</th>
              <th>數量</th>
              <th>單位</th>
              <th>單價</th>
              <th>庫存總價值</th>
              <th>供應商</th>
              <th>最低庫存</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredIngredients.length === 0 ? (
              <tr>
                <td colSpan="10" className="no-data">
                  {searchTerm || filterCategory ? '沒有符合的原物料' : '尚未新增任何原物料'}
                </td>
              </tr>
            ) : (
              filteredIngredients.map(ingredient => (
                <tr key={ingredient.id} className={ingredient.is_low_stock ? 'low-stock-row' : ''}>
                  <td>{ingredient.name}</td>
                  <td>{ingredient.category || '-'}</td>
                  <td>{ingredient.quantity}</td>
                  <td>{ingredient.unit_display}</td>
                  <td>NT$ {ingredient.cost_per_unit}</td>
                  <td>NT$ {ingredient.total_value}</td>
                  <td>{ingredient.supplier || '-'}</td>
                  <td>{ingredient.minimum_stock}</td>
                  <td>
                    {ingredient.is_low_stock ? (
                      <span className="inventory-status-badge low-stock">庫存不足</span>
                    ) : (
                      <span className="inventory-status-badge normal">正常</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => handleEdit(ingredient)}
                      className="edit-button"
                      title="編輯"
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(ingredient.id)}
                      className="delete-button"
                      title="刪除"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <IngredientForm
          ingredient={editingIngredient}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}

export default InventoryManagementPage;