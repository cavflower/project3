import React, { useState } from 'react';
import { FaSearch, FaPhone } from 'react-icons/fa';
import { lookupGuestOrders } from '../../api/orderApi';
import './GuestOrderLookup.css';

/**
 * 訪客查詢訂單頁面
 * 透過手機號碼查詢訂單進度
 */
const GuestOrderLookup = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [orders, setOrders] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleInputChange = (value) => {
        setPhoneNumber(value);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setOrders([]);

        // 驗證輸入
        if (!phoneNumber.trim()) {
            setError('請輸入手機號碼');
            return;
        }

        // 驗證手機號碼格式 (09開頭，共10碼)
        const phoneRegex = /^09\d{8}$/;
        if (!phoneRegex.test(phoneNumber)) {
            setError('請輸入正確的手機號碼格式 (09xxxxxxxx)');
            return;
        }

        try {
            setLoading(true);
            setHasSearched(true);

            const response = await lookupGuestOrders(phoneNumber);

            if (response.data && response.data.orders && response.data.orders.length > 0) {
                setOrders(response.data.orders);
            } else {
                setError('找不到訂單記錄，請確認手機號碼是否正確');
            }
        } catch (error) {
            console.error('Failed to lookup orders:', error);
            const errorMsg = error.response?.data?.error || '查詢失敗，請稍後再試';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setPhoneNumber('');
        setError('');
        setOrders([]);
        setHasSearched(false);
    };

    const getStatusBadgeClass = (status) => {
        const statusMap = {
            pending: 'status-pending',
            accepted: 'status-accepted',
            confirmed: 'status-accepted',
            ready_for_pickup: 'status-ready',
            ready: 'status-ready',
            completed: 'status-completed',
            rejected: 'status-rejected',
            cancelled: 'status-rejected',
        };
        return statusMap[status] || 'status-default';
    };

    const getOrderTypeBadgeClass = (orderType) => {
        const typeMap = {
            takeout: 'type-takeout',
            dine_in: 'type-dinein',
            surplus: 'type-surplus',
        };
        return typeMap[orderType] || 'type-default';
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="guest-order-lookup-page">
            <div className="lookup-container">
                <div className="lookup-header">
                    <FaSearch className="header-icon" />
                    <h1>查詢訂單</h1>
                    <p className="subtitle">請輸入下單時填寫的手機號碼</p>
                </div>

                <form onSubmit={handleSubmit} className="lookup-form">
                    {/* 手機號碼 */}
                    <div className="form-group">
                        <label>
                            <FaPhone /> 手機號碼
                        </label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => handleInputChange(e.target.value.replace(/\D/g, ''))}
                            placeholder="請輸入手機號碼 (09xxxxxxxx)"
                            className="form-input"
                            maxLength={10}
                            pattern="09\d{8}"
                            disabled={loading}
                        />
                        <small className="input-hint">請輸入下單時填寫的手機號碼</small>
                    </div>

                    {/* 錯誤訊息 */}
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {/* 操作按鈕 */}
                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleClear}
                            disabled={loading}
                        >
                            清除
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                        >
                            {loading ? '查詢中...' : '查詢訂單'}
                        </button>
                    </div>
                </form>

                {/* 訂單列表 */}
                {hasSearched && orders.length > 0 && (
                    <div className="orders-result">
                        <h3>查詢結果 ({orders.length} 筆訂單)</h3>
                        <div className="orders-list">
                            {orders.map((order) => (
                                <div key={`${order.order_type}-${order.id}`} className="order-card">
                                    <div className="order-header">
                                        <div className="order-info">
                                            <h4>{order.store_name}</h4>
                                            <span className="order-number">#{order.order_number}</span>
                                            <span className={`order-type-badge ${getOrderTypeBadgeClass(order.order_type)}`}>
                                                {order.order_type_display}
                                            </span>
                                        </div>
                                        <div className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                                            {order.status_display}
                                        </div>
                                    </div>
                                    <div className="order-details">
                                        <div className="detail-row">
                                            <span className="label">訂單狀態:</span>
                                            <span className={`value status-text ${getStatusBadgeClass(order.status)}`}>
                                                {order.status_display}
                                            </span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="label">顧客姓名:</span>
                                            <span className="value">{order.customer_name}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="label">付款方式:</span>
                                            <span className="value">{order.payment_method}</span>
                                        </div>
                                        {order.table_label && (
                                            <div className="detail-row">
                                                <span className="label">桌號:</span>
                                                <span className="value">{order.table_label}</span>
                                            </div>
                                        )}
                                        {order.pickup_at && (
                                            <div className="detail-row">
                                                <span className="label">取餐時間:</span>
                                                <span className="value">{formatDateTime(order.pickup_at)}</span>
                                            </div>
                                        )}
                                        {order.pickup_time && (
                                            <div className="detail-row">
                                                <span className="label">取餐時間:</span>
                                                <span className="value">{formatDateTime(order.pickup_time)}</span>
                                            </div>
                                        )}
                                        <div className="detail-row">
                                            <span className="label">訂單時間:</span>
                                            <span className="value">{formatDateTime(order.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 說明資訊 */}
                <div className="info-box">
                    <h3>找不到訂單資訊？</h3>
                    <ul>
                        <li>請確認手機號碼是否為下單時填寫的號碼</li>
                        <li>手機號碼格式需為 09 開頭的 10 位數字</li>
                        <li>如果是會員，建議先<a href="/login/customer">登入</a>後查看訂單</li>
                        <li>訂單資訊保留 30 天，過期後將無法查詢</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default GuestOrderLookup;
