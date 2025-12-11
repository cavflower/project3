import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLoyaltyAccounts } from '../../api/loyaltyApi';
import { FaGift, FaHistory, FaAward, FaStore } from 'react-icons/fa';
import './CustomerLoyalty.css';

const CustomerLoyalty = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await getLoyaltyAccounts();
      setAccounts(response.data);
    } catch (error) {
      console.error('獲取會員帳戶失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">載入中...</div>;
  }

  return (
    <div className="customer-loyalty">
      <div className="loyalty-header">
        <h1><FaAward /> 我的會員中心</h1>
        <p>查看您在各商家的會員資訊和點數</p>
      </div>

      <div className="quick-actions">
        <button 
          className="action-btn"
          onClick={() => navigate('/customer/loyalty/redemptions')}
        >
          <FaGift />
          <span>兌換商品</span>
        </button>
        <button 
          className="action-btn"
          onClick={() => navigate('/customer/loyalty/history')}
        >
          <FaHistory />
          <span>點數歷史</span>
        </button>
        <button 
          className="action-btn"
          onClick={() => navigate('/customer/loyalty/my-redemptions')}
        >
          <FaAward />
          <span>我的兌換</span>
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="no-accounts">
          <FaStore size={60} />
          <p>您尚未在任何商家建立會員</p>
          <p className="hint">完成第一筆消費後自動建立會員帳戶</p>
        </div>
      ) : (
        <div className="accounts-grid">
          {accounts.map((account) => (
            <div 
              key={account.id} 
              className="account-card"
              onClick={() => navigate(`/customer/loyalty/account/${account.id}`)}
            >
              <div className="account-header">
                <h3>{account.store_name}</h3>
                {account.current_level_name && (
                  <span className="level-badge">{account.current_level_name}</span>
                )}
              </div>
              
              <div className="points-display">
                <div className="points-main">
                  <span className="points-number">{account.available_points}</span>
                  <span className="points-label">可用點數</span>
                </div>
                <div className="points-secondary">
                  <span>累計: {account.total_points}</span>
                </div>
              </div>

              {account.current_level_benefits && (
                <div className="benefits-preview">
                  <small>會員權益</small>
                  <p>{account.current_level_benefits}</p>
                </div>
              )}

              {account.current_level_discount && (
                <div className="discount-badge">
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
