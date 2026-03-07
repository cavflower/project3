import React, { useState, useEffect } from 'react';
import { FaLine, FaCheckCircle, FaBell, FaChartLine, FaBoxes, FaExclamationTriangle } from 'react-icons/fa';
import { getMerchantLineStatus, bindMerchantLine, unbindMerchantLine, updateMerchantLinePreferences } from '../../../api/merchantLineApi';
import { getLineAuthUrl } from '../../../api/lineLoginApi';
import styles from './MerchantLineBinding.module.css';

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
            <div className={styles.merchantLineBinding}>
                <div className={styles.loading}>
                    <div className={styles.loadingSpinner}></div>
                    <span>載入中...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.merchantLineBinding}>
            <div className={styles.header}>
                <FaLine className={styles.headerIcon} />
                <div>
                    <h3>LINE 通知綁定</h3>
                    <p>綁定 LINE 帳號以接收店家業務通知</p>
                </div>
            </div>

            {/* 訊息提示 */}
            {error && (
                <div className={styles.alertError}>
                    {error}
                </div>
            )}
            {successMessage && (
                <div className={styles.alertSuccess}>
                    {successMessage}
                </div>
            )}

            {bindingStatus?.is_bound ? (
                <>
                    {/* 已綁定狀態 */}
                    <div className={styles.statusBound}>
                        <FaCheckCircle className={styles.statusIcon} />
                        <div className={styles.statusInfo}>
                            {bindingStatus.picture_url && (
                                <img
                                    src={bindingStatus.picture_url}
                                    alt="LINE 頭像"
                                    className={styles.lineAvatar}
                                />
                            )}
                            <div>
                                <span className={styles.statusLabel}>已綁定</span>
                                <span className={styles.statusName}>{bindingStatus.display_name || 'LINE 用戶'}</span>
                            </div>
                        </div>
                        <button
                            className={styles.unbindBtn}
                            onClick={handleUnbind}
                            disabled={saving}
                        >
                            解除綁定
                        </button>
                    </div>

                    {/* 通知偏好設定 */}
                    <div className={styles.preferences}>
                        <h4>通知偏好設定</h4>
                        <div className={styles.preferenceList}>
                            <div className={styles.preferenceItem}>
                                <div className={styles.preferenceInfo}>
                                    <FaBell className={styles.preferenceIcon} />
                                    <div>
                                        <span className={styles.preferenceLabel}>排班通知</span>
                                        <span className={styles.preferenceDesc}>接收員工排班相關通知</span>
                                    </div>
                                </div>
                                <label className={styles.toggleSwitch}>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notify_schedule}
                                        onChange={(e) => handlePreferenceChange('notify_schedule', e.target.checked)}
                                        disabled={saving}
                                    />
                                    <span className={styles.toggleSlider}></span>
                                </label>
                            </div>

                            <div className={styles.preferenceItem}>
                                <div className={styles.preferenceInfo}>
                                    <FaChartLine className={styles.preferenceIcon} />
                                    <div>
                                        <span className={styles.preferenceLabel}>營運分析報告</span>
                                        <span className={styles.preferenceDesc}>接收每日/每週營運分析</span>
                                    </div>
                                </div>
                                <label className={styles.toggleSwitch}>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notify_analytics}
                                        onChange={(e) => handlePreferenceChange('notify_analytics', e.target.checked)}
                                        disabled={saving}
                                    />
                                    <span className={styles.toggleSlider}></span>
                                </label>
                            </div>

                            <div className={styles.preferenceItem}>
                                <div className={styles.preferenceInfo}>
                                    <FaBoxes className={styles.preferenceIcon} />
                                    <div>
                                        <span className={styles.preferenceLabel}>原物料不足提醒</span>
                                        <span className={styles.preferenceDesc}>庫存低於安全量時通知</span>
                                    </div>
                                </div>
                                <label className={styles.toggleSwitch}>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notify_inventory}
                                        onChange={(e) => handlePreferenceChange('notify_inventory', e.target.checked)}
                                        disabled={saving}
                                    />
                                    <span className={styles.toggleSlider}></span>
                                </label>
                            </div>

                            <div className={styles.preferenceItem}>
                                <div className={styles.preferenceInfo}>
                                    <FaExclamationTriangle className={styles.preferenceIcon} />
                                    <div>
                                        <span className={styles.preferenceLabel}>訂單異常警報</span>
                                        <span className={styles.preferenceDesc}>訂單出現異常時即時通知</span>
                                    </div>
                                </div>
                                <label className={styles.toggleSwitch}>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notify_order_alert}
                                        onChange={(e) => handlePreferenceChange('notify_order_alert', e.target.checked)}
                                        disabled={saving}
                                    />
                                    <span className={styles.toggleSlider}></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* 未綁定狀態 */
                <div className={styles.statusUnbound}>
                    <p>尚未綁定 LINE 帳號</p>
                    <button
                        className={styles.bindBtn}
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
