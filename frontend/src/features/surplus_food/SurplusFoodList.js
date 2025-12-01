import React, { useState, useEffect } from 'react';
import { FaLeaf, FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash } from 'react-icons/fa';
import { surplusFoodApi } from '../../api/surplusFoodApi';
import SurplusFoodForm from './SurplusFoodForm';

const SurplusFoodList = () => {
  const [surplusFoods, setSurplusFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState('');

  useEffect(() => {
    loadSurplusFoods();
  }, [statusFilter]);

  const loadSurplusFoods = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await surplusFoodApi.getSurplusFoods(params);
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
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setModalType('createFood');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setModalType('');
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { text: '上架中', class: 'status-active' },
      inactive: { text: '已下架', class: 'status-inactive' },
      sold_out: { text: '已售完', class: 'status-sold-out' },
    };
    const { text, class: className } = statusMap[status] || { text: status, class: '' };
    return <span className={`status-badge ${className}`}>{text}</span>;
  };

  return (
    <div className="surplus-tab-content">
      <div className="surplus-content-header">
        <div className="filter-group">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">全部狀態</option>
            <option value="active">上架中</option>
            <option value="inactive">已下架</option>
            <option value="sold_out">已售完</option>
          </select>
        </div>
        <button 
          className="surplus-btn-primary btn-compact"
          onClick={handleCreate}
        >
          <FaPlus /> 新增惜福品
        </button>
      </div>

      {loading ? (
        <div className="loading">載入中...</div>
      ) : (
        <div className="foods-grid">
          {surplusFoods.map(food => (
            <div key={food.id} className="food-card">
              <div className="food-image">
                {food.image ? (
                  <img src={food.image} alt={food.title} />
                ) : (
                  <div className="no-image">
                    <FaLeaf />
                  </div>
                )}
                {getStatusBadge(food.status)}
              </div>
              <div className="food-info">
                <h3>{food.title}</h3>
                <div className="food-code">編號: {food.code}</div>
                <div className="food-price">
                  <span className="original-price">NT$ {Math.floor(food.original_price)}</span>
                  <span className="surplus-price">NT$ {Math.floor(food.surplus_price)}</span>
                  <span className="discount">省 {food.discount_percent}%</span>
                </div>
                <div className="food-quantity">
                  剩餘: {food.remaining_quantity} / {food.quantity}
                </div>
              </div>
              <div className="food-actions">
                <button 
                  className="surplus-btn-icon"
                  onClick={() => handleEdit(food)}
                  title="編輯"
                >
                  <FaEdit />
                </button>
                {food.status === 'inactive' ? (
                  <button 
                    className="surplus-btn-icon btn-success"
                    onClick={() => handlePublish(food.id)}
                    title="上架"
                  >
                    <FaEye />
                  </button>
                ) : (
                  <button 
                    className="surplus-btn-icon btn-warning"
                    onClick={() => handleUnpublish(food.id)}
                    title="下架"
                  >
                    <FaEyeSlash />
                  </button>
                )}
                <button 
                  className="surplus-btn-icon btn-danger"
                  onClick={() => handleDelete(food.id)}
                  title="刪除"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SurplusFoodForm
          type={modalType}
          item={selectedItem}
          onClose={handleCloseModal}
          onSuccess={() => {
            handleCloseModal();
            loadSurplusFoods();
          }}
        />
      )}
    </div>
  );
};

export default SurplusFoodList;
