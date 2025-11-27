import React, { useState, useEffect } from 'react';
import { getPointTransactions, getLoyaltyAccounts } from '../../api/loyaltyApi';
import { FaHistory, FaArrowUp, FaArrowDown, FaAdjust, FaClock } from 'react-icons/fa';
import './PointsHistory.css';

const PointsHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedStore, setSelectedStore] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transactionsRes, accountsRes] = await Promise.all([
        getPointTransactions(),
        getLoyaltyAccounts()
      ]);
      setTransactions(transactionsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error('獲取點數記錄失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'earn':
        return <FaArrowUp className="icon-earn" />;
      case 'redeem':
        return <FaArrowDown className="icon-redeem" />;
      case 'adjust':
        return <FaAdjust className="icon-adjust" />;
      case 'expire':
        return <FaClock className="icon-expire" />;
      default:
        return null;
    }
  };

  const getAccountStoreName = (accountId) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.store_name : '未知商家';
  };

  const filteredTransactions = selectedStore === 'all'
    ? transactions
    : transactions.filter(t => {
        const account = accounts.find(acc => acc.id === t.account);
        return account && account.store === parseInt(selectedStore);
      });

  if (loading) {
    return <div className="loading">載入中...</div>;
  }

  return (
    <div className="points-history">
      <div className="history-header">
        <h1><FaHistory /> 點數歷史</h1>
        <p>查看您的點數獲得與使用記錄</p>
      </div>

      {accounts.length > 0 && (
        <div className="filter-bar">
          <label>篩選商家：</label>
          <select 
            value={selectedStore} 
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <option value="all">所有商家</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.store}>
                {acc.store_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="accounts-summary">
        {accounts
          .filter(acc => selectedStore === 'all' || acc.store === parseInt(selectedStore))
          .map(acc => (
            <div key={acc.id} className="summary-card">
              <h3>{acc.store_name}</h3>
              <div className="points-info">
                <div className="point-item">
                  <label>可用點數</label>
                  <span className="points">{acc.available_points}</span>
                </div>
                <div className="point-item">
                  <label>累計點數</label>
                  <span className="points total">{acc.total_points}</span>
                </div>
              </div>
              {acc.current_level_name && (
                <div className="level-info">
                  <span className="level-badge">{acc.current_level_name}</span>
                </div>
              )}
            </div>
          ))
        }
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="no-transactions">
          <FaHistory size={60} />
          <p>沒有點數記錄</p>
        </div>
      ) : (
        <div className="transactions-list">
          <h2>交易記錄</h2>
          {filteredTransactions.map((transaction) => (
            <div key={transaction.id} className={`transaction-item ${transaction.transaction_type}`}>
              <div className="transaction-icon">
                {getTransactionIcon(transaction.transaction_type)}
              </div>
              <div className="transaction-details">
                <div className="transaction-header">
                  <span className="type-label">{transaction.transaction_type_display}</span>
                  <span className="store-name">{getAccountStoreName(transaction.account)}</span>
                </div>
                <p className="description">{transaction.description}</p>
                <span className="date">
                  {new Date(transaction.created_at).toLocaleString('zh-TW')}
                </span>
              </div>
              <div className={`points-change ${transaction.points >= 0 ? 'positive' : 'negative'}`}>
                {transaction.points >= 0 ? '+' : ''}{transaction.points}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PointsHistory;
