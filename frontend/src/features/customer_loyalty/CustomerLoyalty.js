import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLoyaltyAccounts } from '../../api/loyaltyApi';
import { FaGift, FaHistory, FaAward, FaStore, FaArrowLeft } from 'react-icons/fa';
import styles from './CustomerLoyalty.module.css';

const CustomerLoyalty = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { storeId } = useParams(); // 獲取店家 ID（如果有）


  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await getLoyaltyAccounts();
      let accountsData = response.data;

      // 如果有 storeId，只顯示該店家的會員資料
      if (storeId) {
        accountsData = accountsData.filter(account =>
          account.store?.id === parseInt(storeId)
        );
      }

      setAccounts(accountsData);

    } catch (error) {
      console.error('獲取會員帳戶失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>載入中...</div>;
  }

  return (
    <div className={styles['customer-loyalty']}>
      <div className={styles['loyalty-header']}>
        {storeId && (
          <button
            className="back-to-store-btn"
            onClick={() => navigate(`/store/${storeId}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              marginBottom: '1rem',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <FaArrowLeft /> 返回店家頁面
          </button>
        )}
        <h1>
          <FaAward />
          {storeId ? ' 店家會員中心' : ' 我的會員中心'}
        </h1>
        <p>
          {storeId
            ? '查看您在此店家的會員資訊和點數'
            : '查看您在各商家的會員資訊和點數'}
        </p>

      </div>

      <div className={styles['quick-actions']}>
        <button
          className={styles['action-btn']}
          onClick={() => navigate('/customer/loyalty/redemptions')}
        >
          <FaGift />
          <span>兌換商品</span>
        </button>
        <button
          className={styles['action-btn']}
          onClick={() => navigate('/customer/loyalty/history')}
        >
          <FaHistory />
          <span>點數歷史</span>
        </button>
        <button
          className={styles['action-btn']}
          onClick={() => navigate('/customer/loyalty/my-redemptions')}
        >
          <FaAward />
          <span>我的兌換</span>
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className={styles['no-accounts']}>
          <FaStore size={60} />
          <p>
            {storeId
              ? '您尚未在此店家建立會員'
              : '您尚未在任何商家建立會員'}
          </p>
          <p className={styles.hint}>完成第一筆消費後自動建立會員帳戶</p>
          {storeId && (
            <button
              className="btn btn-primary mt-3"
              onClick={() => navigate(`/store/${storeId}`)}
              style={{
                padding: '0.75rem 2rem',
                borderRadius: '25px',
                border: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              前往消費建立會員
            </button>
          )}

        </div>
      ) : (
        <div className={styles['accounts-grid']}>
          {accounts.map((account) => (
            <div
              key={account.id}
              className={styles['account-card']}
              onClick={() => navigate(`/customer/loyalty/${account.store}`)}
              style={{ cursor: 'pointer' }}

            >
              <div className={styles['account-header']}>
                <h3>{account.store_name}</h3>
                {account.current_level_name && (
                  <span className={styles['level-badge']}>{account.current_level_name}</span>
                )}
              </div>

              <div className={styles['points-display']}>
                <div className={styles['points-main']}>
                  <span className={styles['points-number']}>{account.available_points}</span>
                  <span className={styles['points-label']}>可用點數</span>
                </div>
                <div className={styles['points-secondary']}>
                  <span>累計: {account.total_points}</span>
                </div>
              </div>

              {account.current_level_benefits && (
                <div className={styles['benefits-preview']}>
                  <small>會員權益</small>
                  <p>{account.current_level_benefits}</p>
                </div>
              )}

              {account.current_level_discount && (
                <div className={styles['discount-badge']}>
                  享 {account.current_level_discount}% 折扣
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerLoyalty;
