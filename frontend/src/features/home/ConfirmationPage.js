import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaClock, FaReceipt, FaCreditCard, FaStar, FaArrowLeft } from 'react-icons/fa';
import './ConfirmationPage.css';

function ConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { pickupNumber, paymentMethod, hasSurplusOrders } = location.state || {};
  const [currentNumber, setCurrentNumber] = useState(98); // 模擬目前叫號

  // 模擬叫號更新
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentNumber(prev => prev + 1);
    }, 30000); // 每30秒更新一次

    return () => clearInterval(interval);
  }, []);

  const estimatedWaitMinutes = pickupNumber ? Math.max((parseInt(pickupNumber) - currentNumber) * 3, 0) : null;

  return (
    <div className="confirmation-page" style={{ marginTop: '70px' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            {/* 成功圖示 */}
            <div className="success-header">
              <div className="success-icon">
                <FaCheckCircle />
              </div>
              <h1 className="success-title">訂單送出成功！</h1>
              <p className="success-subtitle">感謝您的訂購，請準時前來取餐</p>
            </div>

            {/* 取餐號碼卡片 */}
            <div className="pickup-number-card">
              <div className="card-header">
                <FaReceipt className="header-icon" />
                <h3>取餐號碼</h3>
              </div>
              <div className="card-body">
                <div className="pickup-number">
                  {pickupNumber || '待通知'}
                </div>
                <p className="pickup-hint">請記下您的取餐號碼，或截圖保存</p>
              </div>
            </div>

            {/* 訂單資訊 */}
            <div className="order-info-card">
              <div className="info-row">
                <div className="info-item">
                  <div className="info-label">
                    <FaReceipt className="me-2" />
                    訂單編號
                  </div>
                  <div className="info-value">#{orderId}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">
                    <FaCreditCard className="me-2" />
                    付款方式
                  </div>
                  <div className="info-value">{paymentMethod || '未提供'}</div>
                </div>
              </div>
            </div>

            {/* 目前叫號狀態 */}
            <div className="current-status-card">
              <div className="status-header">
                <FaClock className="me-2" />
                <h4>目前叫號狀態</h4>
              </div>
              <div className="status-body">
                <div className="current-number-display">
                  <span className="label">目前叫號至</span>
                  <span className="number">{currentNumber}</span>
                </div>
                {estimatedWaitMinutes !== null && pickupNumber && parseInt(pickupNumber) > currentNumber && (
                  <div className="estimated-wait">
                    <p>預估等待時間</p>
                    <span className="wait-time">{estimatedWaitMinutes} 分鐘</span>
                  </div>
                )}
                {pickupNumber && parseInt(pickupNumber) <= currentNumber && (
                  <div className="ready-notice">
                    <FaCheckCircle className="me-2" />
                    您的餐點可能已經準備好了！請前往櫃檯取餐
                  </div>
                )}
              </div>
            </div>

            {/* 惜福品提示 */}
            {hasSurplusOrders && (
              <div className="surplus-notice">
                <i className="bi bi-leaf me-2"></i>
                您的訂單包含惜福品，請至店家惜福品專區查看詳細資訊
              </div>
            )}

            {/* 溫馨提醒 */}
            <div className="reminder-card">
              <h5>
                <i className="bi bi-info-circle me-2"></i>
                溫馨提醒
              </h5>
              <ul>
                <li>請於取餐時間前往店家，出示取餐號碼</li>
                <li>如需修改或取消訂單，請直接聯繫店家</li>
                <li>逾時未取餐，店家可能會取消訂單</li>
              </ul>
            </div>

            {/* 動作按鈕 */}
            <div className="action-buttons">
              <Link to={`/review/${orderId}`} className="btn btn-review">
                <FaStar className="me-2" />
                為本次訂單評分
              </Link>
              <button 
                className="btn btn-secondary"
                onClick={() => navigate('/customer-home')}
              >
                <FaArrowLeft className="me-2" />
                返回首頁
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationPage;
