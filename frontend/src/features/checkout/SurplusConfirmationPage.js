import React from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaReceipt, FaCreditCard, FaArrowLeft, FaLeaf, FaClock } from 'react-icons/fa';
import './ConfirmationPage.css';

function SurplusConfirmationPage() {
    const { orderId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const {
        pickupNumber,
        orderNumber,
        paymentMethod,
        isDineIn,
        tableLabel
    } = location.state || {};

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

                        {/* 取餐號碼卡片 - 惜福品專用 */}
                        <div className="pickup-number-card surplus-pickup-card">
                            <div className="card-header">
                                <FaLeaf className="header-icon" style={{ color: '#28a745' }} />
                                <h3>惜福品取餐號碼</h3>
                            </div>
                            <div className="card-body">
                                <div className="pickup-number surplus-number">
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
                                    <div className="info-value">#{orderNumber || orderId}</div>
                                </div>
                                <div className="info-item">
                                    <div className="info-label">
                                        <FaCreditCard className="me-2" />
                                        付款方式
                                    </div>
                                    <div className="info-value">{paymentMethod || '未提供'}</div>
                                </div>
                            </div>
                            {isDineIn && tableLabel && (
                                <div className="info-row mt-2">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="bi bi-geo-alt me-2"></i>
                                            桌號
                                        </div>
                                        <div className="info-value">{tableLabel}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 訂單狀態提示 */}
                        <div className="current-status-card">
                            <div className="status-header">
                                <FaClock className="me-2" />
                                <h4>訂單狀態</h4>
                            </div>
                            <div className="status-body">
                                <div className="status-message">
                                    <p>您的惜福品訂單正在準備中</p>
                                    <p className="text-muted">請留意店家叫號，聽到您的號碼後即可前往取餐</p>
                                </div>
                            </div>
                        </div>

                        {/* 惜福品特別提示 */}
                        <div className="surplus-notice">
                            <FaLeaf className="me-2" style={{ color: '#28a745' }} />
                            <div>
                                <p className="mb-2">感謝您選擇惜福品！</p>
                                <p className="text-muted small mb-0">您不僅省錢，更為減少食物浪費貢獻一份心力</p>
                            </div>
                        </div>

                        {/* 溫馨提醒 */}
                        <div className="reminder-card">
                            <h5>
                                <i className="bi bi-info-circle me-2"></i>
                                溫馨提醒
                            </h5>
                            <ul>
                                <li>請於取餐時間前往店家，出示取餐號碼</li>
                                <li>惜福品數量有限，請準時取餐</li>
                                <li>如需修改或取消訂單，請直接聯繫店家</li>
                            </ul>
                        </div>

                        {/* 動作按鈕 */}
                        <div className="action-buttons">
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

export default SurplusConfirmationPage;
