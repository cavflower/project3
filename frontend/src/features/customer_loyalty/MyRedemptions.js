import React, { useState, useEffect } from 'react';
import { getMyRedemptions, cancelRedemption } from '../../api/loyaltyApi';
import { FaBarcode, FaClock, FaCheckCircle, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';
import './MyRedemptions.css';

const MyRedemptions = () => {
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const fetchRedemptions = async () => {
    try {
      const response = await getMyRedemptions();
      setRedemptions(response.data);
    } catch (error) {
      console.error('獲取兌換記錄失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (redemptionId) => {
    if (!window.confirm('確定要取消此兌換嗎？點數將退回至您的帳戶。')) {
      return;
    }

    try {
      await cancelRedemption(redemptionId);
      alert('兌換已取消，點數已退回');
      fetchRedemptions();
    } catch (error) {
      alert(error.response?.data?.error || '取消失敗');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <FaHourglassHalf className="status-icon pending" />;
      case 'confirmed':
        return <FaClock className="status-icon confirmed" />;
      case 'redeemed':
        return <FaCheckCircle className="status-icon redeemed" />;
      case 'cancelled':
      case 'expired':
        return <FaTimesCircle className="status-icon cancelled" />;
      default:
        return null;
    }
  };

  const filteredRedemptions = filter === 'all' 
    ? redemptions 
    : redemptions.filter(r => r.status === filter);

  if (loading) {
    return <div className="loading">載入中...</div>;
  }

  return (
    <div className="my-redemptions">
      <div className="redemptions-header">
        <h1><FaBarcode /> 我的兌換</h1>
        <p>查看您的兌換記錄和兌換碼</p>
      </div>

      <div className="filter-tabs">
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        <button 
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          待確認
        </button>
        <button 
          className={filter === 'confirmed' ? 'active' : ''}
          onClick={() => setFilter('confirmed')}
        >
          已確認
        </button>
        <button 
          className={filter === 'redeemed' ? 'active' : ''}
          onClick={() => setFilter('redeemed')}
        >
          已兌換
        </button>
      </div>

      {filteredRedemptions.length === 0 ? (
        <div className="no-redemptions">
          <FaBarcode size={60} />
          <p>沒有兌換記錄</p>
        </div>
      ) : (
        <div className="redemptions-list">
          {filteredRedemptions.map((redemption) => (
            <div key={redemption.id} className={`redemption-card status-${redemption.status}`}>
              <div className="redemption-main">
                <div className="redemption-info">
                  {getStatusIcon(redemption.status)}
                  <div className="info-text">
                    <h3>{redemption.product_title}</h3>
                    <p className="description">{redemption.product_description}</p>
                    <div className="meta">
                      <span className="points">使用 {redemption.points_used} 點</span>
                      <span className="status-text">{redemption.status_display}</span>
                    </div>
                  </div>
                </div>

                <div className="redemption-code-section">
                  <label>兌換碼</label>
                  <div className="code-display">
                    <FaBarcode />
                    <code>{redemption.redemption_code}</code>
                  </div>
                  {redemption.expires_at && (
                    <small className="expiry">
                      有效期限: {new Date(redemption.expires_at).toLocaleDateString('zh-TW')}
                    </small>
                  )}
                </div>
              </div>

              {redemption.redeemed_at && (
                <div className="redeemed-info">
                  <FaCheckCircle /> 已於 {new Date(redemption.redeemed_at).toLocaleString('zh-TW')} 兌換
                </div>
              )}

              {redemption.notes && (
                <div className="notes">
                  <strong>備註：</strong>{redemption.notes}
                </div>
              )}

              <div className="redemption-footer">
                <span className="date">
                  {new Date(redemption.created_at).toLocaleDateString('zh-TW')}
                </span>
                {redemption.status === 'pending' && (
                  <button 
                    className="btn-cancel-redemption"
                    onClick={() => handleCancel(redemption.id)}
                  >
                    取消兌換
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyRedemptions;
