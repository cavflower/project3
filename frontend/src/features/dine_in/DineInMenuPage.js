import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import { getDineInProducts } from '../../api/orderApi';
import { useAuth } from '../../store/AuthContext';
import './DineInMenuPage.css';

const DineInMenuPage = () => {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const tableLabel = searchParams.get('table') || '未命名桌號';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError('');
        const [storeRes, productRes] = await Promise.all([
          getStore(storeId),
          getDineInProducts(storeId),
        ]);
        setStore(storeRes.data);
        const filtered = (productRes.data || []).filter((item) =>
          ['dine_in', 'both'].includes(item.service_type)
        );
        setProducts(filtered);
      } catch (err) {
        console.error('Failed to load dine-in menu', err);
        setError('載入菜單失敗，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [storeId]);

  if (loading) {
    return (
      <div className="dinein-menu-page">
        <div className="menu-card">
          <p>載入菜單中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dinein-menu-page">
        <div className="menu-card error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const handleLoginClick = () => {
    const currentPath = `/store/${storeId}/dine-in/menu?table=${encodeURIComponent(tableLabel)}`;
    navigate(`/login/customer?redirect=${encodeURIComponent(currentPath)}`);
  };

  const handleOrderClick = () => {
    navigate(`/store/${storeId}/dine-in/order?table=${encodeURIComponent(tableLabel)}`);
  };

  return (
    <div className="dinein-menu-page">
      <div className="menu-card">
        <header className="menu-header">
          <h1>{store?.name || '餐廳菜單'}</h1>
          <p>桌號：{tableLabel}</p>
          <p className="menu-note">本頁面提供內用與共用餐點，點餐後請告知服務人員。</p>
          <div className="menu-actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            {!user ? (
              <button 
                onClick={handleLoginClick}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#ff5252'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#ff6b6b'}
              >
                登入會員
              </button>
            ) : (
              <button 
                onClick={handleOrderClick}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
              >
                開始點餐
              </button>
            )}
          </div>
        </header>

        {products.length === 0 ? (
          <p className="empty-state">目前尚未有內用菜單，請稍後再查看。</p>
        ) : (
          <div className="menu-items">
            {products.map((item) => (
              <div key={item.id} className="menu-item">
                <div>
                  <h3>{item.name}</h3>
                  {item.description && <p>{item.description}</p>}
                </div>
                <div className="menu-price">
                  NT$ {Number(item.price).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DineInMenuPage;
