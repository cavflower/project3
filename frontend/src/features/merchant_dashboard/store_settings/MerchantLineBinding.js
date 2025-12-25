import React, { useState, useEffect } from 'react';
import { FaLine, FaCheckCircle, FaBell, FaChartLine, FaBoxes, FaExclamationTriangle } from 'react-icons/fa';
import { getMerchantLineStatus, bindMerchantLine, unbindMerchantLine, updateMerchantLinePreferences } from '../../../api/merchantLineApi';
import { getLineAuthUrl } from '../../../api/lineLoginApi';
import './MerchantLineBinding.css';

/**
 * 店家 LINE 綁定元件
 * 用於店家設定頁面，管理 LINE 綁定和通知偏好
 */
const MerchantLineBinding = () => {
    const [loading, setLoading] = useState(true);
    const [bindingStatus, setBindingStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // 通知偏好狀態
    const [preferences, setPreferences] = useState({
        notify_schedule: true,
        notify_analytics: true,
        notify_inventory: true,
        notify_order_alert: true,
    });

    useEffect(() => {
        loadBindingStatus();
        // 檢查 URL 是否帶有 LINE 綁定資料
        checkUrlForLineBinding();
    }, []);

    const loadBindingStatus = async () => {
        try {
            setLoading(true);
            const data = await getMerchantLineStatus();
            setBindingStatus(data);
            if (data.is_bound) {
                setPreferences({
                    notify_schedule: data.notify_schedule,
                    notify_analytics: data.notify_analytics,
                    notify_inventory: data.notify_inventory,
                    notify_order_alert: data.notify_order_alert,
                });
            }
        } catch (err) {
            console.error('Failed to load LINE binding status:', err);
            setError('無法載入 LINE 綁定狀態');
        } finally {
            setLoading(false);
        }
    };

    const checkUrlForLineBinding = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const lineUserId = urlParams.get('merchant_line_user_id');
        const displayName = urlParams.get('display_name');
        const pictureUrl = urlParams.get('picture_url');

        if (lineUserId) {
            try {
                await bindMerchantLine({
                    line_user_id: lineUserId,
                    display_name: displayName || '',
                    picture_url: pictureUrl || '',
                });
                setSuccessMessage('LINE 帳號綁定成功！');
                // 清除 URL 參數
                window.history.replaceState({}, document.title, window.location.pathname);
                loadBindingStatus();
            } catch (err) {
                setError(err.response?.data?.detail || '綁定失敗');
            }
        }
    };

    const handleBindLine = async () => {
        try {
            setLoading(true);
            // 使用 merchant 模式的回調 URL
            const redirectUri = `${window.location.origin}/line-callback?mode=merchant`;
            const data = await getLineAuthUrl(redirectUri);
            // 跳轉到 LINE Login 頁面
            window.location.href = data.auth_url;
        } catch (err) {
            console.error('Failed to get LINE auth URL:', err);
            setError('無法取得 LINE 授權連結，請確認平台已設定 LINE Login');
            setLoading(false);
        }
    };

    const handleUnbind = async () => {
        if (!window.confirm('確定要解除 LINE 綁定嗎？解除後將無法接收 LINE 通知。')) {
            return;
        }

        try {
            setSaving(true);
            await unbindMerchantLine();
            setBindingStatus({ is_bound: false });
            setSuccessMessage('已解除 LINE 綁定');
        } catch (err) {
            setError(err.response?.data?.detail || '解除綁定失敗');
        } finally {
            setSaving(false);
        }
    };

    const handlePreferenceChange = async (key, value) => {
        const newPreferences = { ...preferences, [key]: value };
        setPreferences(newPreferences);

        try {
            setSaving(true);
            await updateMerchantLinePreferences({ [key]: value });
            setSuccessMessage('通知設定已更新');
        } catch (err) {
            // 回滾
            setPreferences(preferences);
            setError('更新通知設定失敗');
        } finally {
            setSaving(false);
        }
    };

    // 清除訊息
    useEffect(() => {
        if (successMessage || error) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
                setError(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, error]);

    if (loading) {
        return (
            <div className="merchant-line-binding">
                <div className="merchant-line-binding__loading">
                    <div className="spinner"></div>
                    <span>載入中...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="merchant-line-binding">
            <div className="merchant-line-binding__header">
                <FaLine className="merchant-line-binding__icon" />
                <div>
                    <h3>LINE 通知綁定</h3>
                    <p>綁定 LINE 帳號以接收店家業務通知</p>
                </div>
            </div>

            {/* 訊息提示 */}
            {error && (
                <div className="merchant-line-binding__alert merchant-line-binding__alert--error">
                    {error}
                </div>
            )}
            {successMessage && (
                <div className="merchant-line-binding__alert merchant-line-binding__alert--success">
                    {successMessage}
                </div>
            )}

            {bindingStatus?.is_bound ? (
                <>
                    {/* 已綁定狀態 */}
                    <div className="merchant-line-binding__status merchant-line-binding__status--bound">
                        <FaCheckCircle className="status-icon" />
                        <div className="status-info">
                            {bindingStatus.picture_url && (
                                <img
                                    src={bindingStatus.picture_url}
                                    alt="LINE 頭像"
                                    className="line-avatar"
                                />
                            )}
                            <div>
                                <span className="status-label">已綁定</span>
                                <span className="status-name">{bindingStatus.display_name || 'LINE 用戶'}</span>
                            </div>
                        </div>
                        <button
                            className="unbind-btn"
                            onClick={handleUnbind}
                            disabled={saving}
                        >
                            解除綁定
                        </button>
                    </div>

                    {/* 通知偏好設定 */}
                    <div className="merchant-line-binding__preferences">
                        <h4>通知偏好設定</h4>
                        <div className="preference-list">
                            <div className="preference-item">
                                <div className="preference-info">
                                    <FaBell className="preference-icon" />
                                    <div>
                                        <span className="preference-label">排班通知</span>
                                        <span className="preference-desc">接收員工排班相關通知</span>
                                    </div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={preferences.notify_schedule}
                                        onChange={(e) => handlePreferenceChange('notify_schedule', e.target.checked)}
                                        disabled={saving}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="preference-item">
                                <div className="preference-info">
                                    <FaChartLine className="preference-icon" />
                                    <div>
                                        <span className="preference-label">營運分析報告</span>
                                        <span className="preference-desc">接收每日/每週營運分析</span>
                                    </div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={preferences.notify_analytics}
                                        onChange={(e) => handlePreferenceChange('notify_analytics', e.target.checked)}
                                        disabled={saving}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="preference-item">
                                <div className="preference-info">
                                    <FaBoxes className="preference-icon" />
                                    <div>
                                        <span className="preference-label">原物料不足提醒</span>
                                        <span className="preference-desc">庫存低於安全量時通知</span>
                                    </div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={preferences.notify_inventory}
                                        onChange={(e) => handlePreferenceChange('notify_inventory', e.target.checked)}
                                        disabled={saving}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            <div className="preference-item">
                                <div className="preference-info">
                                    <FaExclamationTriangle className="preference-icon" />
                                    <div>
                                        <span className="preference-label">訂單異常警報</span>
                                        <span className="preference-desc">訂單出現異常時即時通知</span>
                                    </div>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={preferences.notify_order_alert}
                                        onChange={(e) => handlePreferenceChange('notify_order_alert', e.target.checked)}
                                        disabled={saving}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* 未綁定狀態 */
                <div className="merchant-line-binding__status merchant-line-binding__status--unbound">
                    <p>尚未綁定 LINE 帳號</p>
                    <button
                        className="bind-btn"
                        onClick={handleBindLine}
                        disabled={loading}
                    >
                        <FaLine /> 綁定 LINE 帳號
                    </button>
                </div>
            )}
        </div>
    );
};

export default MerchantLineBinding;
