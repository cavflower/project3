import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getStore } from '../../api/storeApi';
import { getDineInProducts } from '../../api/orderApi';
import { useAuth } from '../../store/AuthContext';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import styles from './DineInMenuPage.module.css';

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
      <div className={styles.dineinMenuPage}>
        <SkeletonLoader variant="cards" cards={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dineinMenuPage}>
        <div className={styles.menuCardError}>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const handleOrderClick = () => {
    navigate(`/store/${storeId}/dine-in/order?table=${encodeURIComponent(tableLabel)}`);
  };

  // 構建登入 URL 與 redirect 參數 - 使用完整的 URL 對象
  const currentUrl = window.location.pathname + window.location.search;
  const loginUrl = `/login/customer?redirect=${encodeURIComponent(currentUrl)}`;

  console.log('Current URL:', currentUrl);
  console.log('Login URL will be:', loginUrl);
  console.log('Encoded redirect:', encodeURIComponent(currentUrl));

  return (
    <div className={styles.dineinMenuPage}>
      <div className={styles.menuCard}>
        <header className={styles.menuHeader}>
          <h1>{store?.name || '餐廳菜單'}</h1>
          <p>桌號：{tableLabel}</p>
          <p className={styles.menuNote}>本頁面提供內用與共用餐點，點餐後請告知服務人員。</p>
          <div className={styles.menuActions}>
            {!user ? (
              <a
                href={loginUrl}
                className={styles.loginButton}
              >
                登入會員
              </a>
            ) : (
              <button
                onClick={handleOrderClick}
                className={styles.orderButton}
              >
                開始點餐
              </button>
            )}
          </div>
        </header>

        {products.length === 0 ? (
          <p className={styles.emptyState}>目前尚未有內用菜單，請稍後再查看。</p>
        ) : (
          <div className={styles.menuItems}>
            {products.map((item) => (
              <div key={item.id} className={styles.menuItem}>
                <div>
                  <h3>{item.name}</h3>
                  {item.description && <p>{item.description}</p>}
                </div>
                <div className={styles.menuPrice}>
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
