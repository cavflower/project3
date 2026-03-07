import React, { useState, useEffect } from 'react';
import { getMyRedemptions, cancelRedemption } from '../../api/loyaltyApi';
import { FaBarcode, FaClock, FaCheckCircle, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';
import styles from './MyRedemptions.module.css';

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
        return <FaHourglassHalf className={`${styles['status-icon']} ${styles.pending}`} />;
      case 'confirmed':
        return <FaClock className={`${styles['status-icon']} ${styles.confirmed}`} />;
      case 'redeemed':
        return <FaCheckCircle className={`${styles['status-icon']} ${styles.redeemed}`} />;
      case 'cancelled':
      case 'expired':
        return <FaTimesCircle className={`${styles['status-icon']} ${styles.cancelled}`} />;
      default:
        return null;
    }
  };

  const filteredRedemptions = filter === 'all'
    ? redemptions
    : redemptions.filter(r => r.status === filter);

  if (loading) {
    return <div className={styles.loading}>載入中...</div>;
  }

  return (
    <div className={styles['my-redemptions']}>
      <div className={styles['redemptions-header']}>
        <h1><FaBarcode /> 我的兌換</h1>
        <p>查看您的兌換記錄和兌換碼</p>
      </div>

      <div className={styles['filter-tabs']}>
        <button
          className={filter === 'all' ? styles.active : ''}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        <button
          className={filter === 'pending' ? styles.active : ''}
          onClick={() => setFilter('pending')}
        >
          待確認
        </button>
        <button
          className={filter === 'confirmed' ? styles.active : ''}
          onClick={() => setFilter('confirmed')}
        >
          已確認
        </button>
        <button
          className={filter === 'redeemed' ? styles.active : ''}
          onClick={() => setFilter('redeemed')}
        >
          已兌換
        </button>
      </div>

      {filteredRedemptions.length === 0 ? (
        <div className={styles['no-redemptions']}>
          <FaBarcode size={60} />
          <p>沒有兌換記錄</p>
        </div>
      ) : (
        <div className={styles['redemptions-list']}>
          {filteredRedemptions.map((redemption) => (
            <div key={redemption.id} className={`${styles['redemption-card']} ${styles[`status-${redemption.status}`] || ''}`}>
              <div className={styles['redemption-main']}>
                <div className={styles['redemption-info']}>
                  {getStatusIcon(redemption.status)}
                  <div className={styles['info-text']}>
                    <h3>{redemption.product_title}</h3>
                    <p className={styles.description}>{redemption.product_description}</p>
                    <div className={styles.meta}>
                      <span className={styles.points}>使用 {redemption.points_used} 點</span>
                      <span className={styles['status-text']}>{redemption.status_display}</span>
                    </div>
                  </div>
                </div>

                <div className={styles['redemption-code-section']}>
                  <label>兌換碼</label>
                  <div className={styles['code-display']}>
                    <FaBarcode />
                    <code>{redemption.redemption_code}</code>
                  </div>
                  {redemption.expires_at && (
                    <small className={styles.expiry}>
                      有效期限: {new Date(redemption.expires_at).toLocaleDateString('zh-TW')}
                    </small>
                  )}
                </div>
              </div>

              {redemption.redeemed_at && (
                <div className={styles['redeemed-info']}>
                  <FaCheckCircle /> 已於 {new Date(redemption.redeemed_at).toLocaleString('zh-TW')} 兌換
                </div>
              )}

              {redemption.notes && (
                <div className={styles.notes}>
                  <strong>備註：</strong>{redemption.notes}
                </div>
              )}

              <div className={styles['redemption-footer']}>
                <span className={styles.date}>
                  {new Date(redemption.created_at).toLocaleDateString('zh-TW')}
                </span>
                {redemption.status === 'pending' && (
                  <button
                    className={styles['btn-cancel-redemption']}
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
