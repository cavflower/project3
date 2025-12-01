import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import { getDineInProducts } from '../../api/orderApi';
import './DineInMenuPage.css';

const DineInMenuPage = () => {
  const { storeId } = useParams();
  const [searchParams] = useSearchParams();
  const tableLabel = searchParams.get('table') || '未命名桌號';
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

  return (
    <div className="dinein-menu-page">
      <div className="menu-card">
        <header className="menu-header">
          <h1>{store?.name || '餐廳菜單'}</h1>
          <p>桌號：{tableLabel}</p>
          <p className="menu-note">本頁面提供內用與共用餐點，點餐後請告知服務人員。</p>
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
