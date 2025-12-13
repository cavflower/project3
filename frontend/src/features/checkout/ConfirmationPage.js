import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaClock, FaReceipt, FaCreditCard, FaStar, FaArrowLeft } from 'react-icons/fa';
import './ConfirmationPage.css';

function ConfirmationPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    pickupNumber, 
    paymentMethod, 
    hasSurplusOrders,
    surplusOrderNumbers,
    surplusPickupNumbers 
  } = location.state || {};
  // 取餐號碼是 1-1000 的隨機數字，不需要模擬叫號進度
  // 只顯示取餐號碼即可

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

            {/* 訂單狀態提示 */}
            <div className="current-status-card">
              <div className="status-header">
                <FaClock className="me-2" />
                <h4>訂單狀態</h4>
              </div>
              <div className="status-body">
                <div className="status-message">
                  <p>您的訂單正在準備中</p>
                  <p className="text-muted">請留意店家叫號，聽到您的號碼後即可前往取餐</p>
                </div>
              </div>
            </div>

            {/* 惜福品提示 */}
            {hasSurplusOrders && (
              <div className="surplus-notice">
                <i className="bi bi-leaf me-2"></i>
                <div>
                  <p className="mb-2">您的訂單包含惜福品</p>
                  {surplusPickupNumbers && surplusPickupNumbers.length > 0 && (
                    <div className="surplus-order-info mt-2">
                      <strong>惜福品取單號碼：</strong>
                      <div className="surplus-numbers">
                        {surplusPickupNumbers.map((num, index) => (
                          <span key={index} className="surplus-pickup-badge">{num}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
