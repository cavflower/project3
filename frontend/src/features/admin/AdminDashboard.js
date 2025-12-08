import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' 或 'desc'
  const navigate = useNavigate();

  useEffect(() => {
    // 檢查是否已登入
    const isLoggedIn = localStorage.getItem('admin_logged_in');
    if (!isLoggedIn) {
      navigate('/login/admin');
      return;
    }

    // 載入商家資料
    loadStores();
  }, [navigate]);

  const loadStores = async () => {
    try {
      setLoading(true);
      // 使用 axios 直接調用，不通過 api.js 的 interceptor
      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';
      const response = await axios.get(`${baseURL}/stores/all/`);
      setStores(response.data || []);
    } catch (err) {
      console.error('載入商家資料失敗:', err);
      setError('載入商家資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    navigate('/login/admin');
  };

  const getPlanName = (plan) => {
    const planNames = {
      'basic': '基本方案',
      'premium': '進階方案',
      'enterprise': '企業方案'
    };
    return planNames[plan] || '未設定';
  };

  const getCuisineType = (type) => {
    const types = {
      'japanese': '日式',
      'korean': '韓式',
      'american': '美式',
      'taiwanese': '台式',
      'western': '西式',
      'beverages': '飲料',
      'desserts': '甜點',
      'other': '其他'
    };
    return types[type] || type || '未分類';
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const sortedStores = [...stores].sort((a, b) => {
    return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
  });

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-3">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1>平台管理員儀表板</h1>
              <p className="text-muted">DineVerse 後台管理系統</p>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="container py-4">
        <div className="stats-row">
          <div className="stat-card">
            <h3>{stores.length}</h3>
            <p>總商家數</p>
          </div>
          <div className="stat-card">
            <h3>{stores.filter(s => s.is_open).length}</h3>
            <p>營業中</p>
          </div>
          <div className="stat-card">
            <h3>{stores.filter(s => s.enable_reservation).length}</h3>
            <p>啟用訂位</p>
          </div>
          <div className="stat-card">
            <h3>{stores.filter(s => s.enable_surplus_food).length}</h3>
            <p>啟用惜福品</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mt-3">
            {error}
          </div>
        )}

        <div className="stores-section">
          <h2 className="mb-4">商家列表</h2>
          <div className="table-responsive">
            <table className="stores-table">
              <thead>
                <tr>
                  <th>
                    店家 ID
                    <button 
                      className="sort-btn" 
                      onClick={toggleSortOrder}
                      title={sortOrder === 'asc' ? '切換為大到小' : '切換為小到大'}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </th>
                  <th>店家名稱</th>
                  <th>類別</th>
                  <th>電話</th>
                  <th>地址</th>
                  <th>方案</th>
                  <th>營業狀態</th>
                  <th>功能啟用</th>
                  <th>惜福品訂單</th>
                </tr>
              </thead>
              <tbody>
                {sortedStores.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-5">
                      目前沒有商家資料
                    </td>
                  </tr>
                ) : (
                  sortedStores.map((store) => (
                    <tr key={store.id}>
                      <td>{store.id}</td>
                      <td className="font-weight-bold">{store.name}</td>
                      <td>{getCuisineType(store.cuisine_type)}</td>
                      <td>{store.phone}</td>
                      <td className="address-cell">{store.address}</td>
                      <td>
                        <span className={`badge badge-${store.plan || 'none'}`}>
                          {getPlanName(store.plan)}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${store.is_open ? 'status-open' : 'status-closed'}`}>
                          {store.is_open ? '營業中' : '已打烊'}
                        </span>
                      </td>
                      <td>
                        <div className="feature-tags">
                          {store.enable_reservation && <span className="feature-tag">訂位</span>}
                          {store.enable_loyalty && <span className="feature-tag">會員</span>}
                          {store.enable_surplus_food && <span className="feature-tag">惜福品</span>}
                        </div>
                      </td>
                      <td>
                        <span className="order-count-badge">
                          {store.surplus_order_count || 0} 筆
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
