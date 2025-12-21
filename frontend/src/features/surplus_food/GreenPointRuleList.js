import React, { useState, useEffect } from 'react';
import {
    FaEdit,
    FaTrash,
    FaToggleOn,
    FaToggleOff,
    FaCoins,
    FaUtensils,
    FaLeaf,
    FaCogs,
    FaGift,
    FaSave,
    FaPercent,
    FaPlus,
    FaTimes
} from 'react-icons/fa';
import surplusFoodApi from '../../api/surplusFoodApi';

// 環保行為類型（只保留兩種）
const ACTION_TYPES = [
    { value: 'no_utensils', label: '外帶不要餐具', icon: FaUtensils, color: '#4CAF50' },
    { value: 'dine_in_eco', label: '內用自備環保餐具', icon: FaLeaf, color: '#00BCD4' },
];

const GreenPointRuleList = () => {
    const [subTab, setSubTab] = useState('rules');

    // 設定規則（獲得點數）
    const [rules, setRules] = useState([]);
    const [loadingRules, setLoadingRules] = useState(true);
    const [savingRule, setSavingRule] = useState(false);
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [ruleFormData, setRuleFormData] = useState({
        action_type: 'no_utensils',
        name: '外帶不要餐具回饋',
        description: '',
        points_reward: 1,
        is_active: true
    });

    // 設定回饋（兌換規則）
    const [redemptionRules, setRedemptionRules] = useState([]);
    const [loadingRedemption, setLoadingRedemption] = useState(true);
    const [savingRedemption, setSavingRedemption] = useState(false);
    const [showRedemptionModal, setShowRedemptionModal] = useState(false);
    const [editingRedemption, setEditingRedemption] = useState(null);
    const [redemptionFormData, setRedemptionFormData] = useState({
        name: '',
        description: '',
        redemption_type: 'discount',
        required_points: '',
        discount_type: 'percent',
        discount_value: '',
        product_name: '',
        product_description: '',
        max_quantity_per_order: 1,
        is_active: true
    });

    useEffect(() => {
        fetchRules();
        fetchRedemptionRules();
    }, []);

    // ========== 設定規則相關 ==========
    const fetchRules = async () => {
        try {
            setLoadingRules(true);
            const data = await surplusFoodApi.getGreenPointRules();
            setRules(data);
        } catch (error) {
            console.error('獲取規則失敗:', error);
        } finally {
            setLoadingRules(false);
        }
    };

    const handleRuleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setRuleFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleActionTypeChange = (actionType) => {
        const selected = ACTION_TYPES.find(t => t.value === actionType);
        setRuleFormData(prev => ({
            ...prev,
            action_type: actionType,
            name: selected ? selected.label + '回饋' : prev.name
        }));
    };

    const openRuleModal = (rule = null) => {
        if (rule) {
            setEditingRule(rule);
            setRuleFormData({
                action_type: rule.action_type,
                name: rule.name,
                description: rule.description || '',
                points_reward: rule.points_reward,
                is_active: rule.is_active
            });
        } else {
            setEditingRule(null);
            const firstAvailable = ACTION_TYPES.find(t => !rules.some(r => r.action_type === t.value));
            setRuleFormData({
                action_type: firstAvailable?.value || 'no_utensils',
                name: firstAvailable ? firstAvailable.label + '回饋' : '',
                description: '',
                points_reward: 1,
                is_active: true
            });
        }
        setShowRuleModal(true);
    };

    const closeRuleModal = () => {
        setShowRuleModal(false);
        setEditingRule(null);
    };

    const handleRuleSubmit = async (e) => {
        e.preventDefault();
        const submitData = {
            action_type: ruleFormData.action_type,
            name: ruleFormData.name,
            description: ruleFormData.description,
            points_reward: parseInt(ruleFormData.points_reward),
            is_active: ruleFormData.is_active
        };

        try {
            setSavingRule(true);
            if (editingRule) {
                await surplusFoodApi.updateGreenPointRule(editingRule.id, submitData);
            } else {
                await surplusFoodApi.createGreenPointRule(submitData);
            }
            fetchRules();
            closeRuleModal();
        } catch (error) {
            console.error('保存設定失敗:', error);
            alert('保存失敗: ' + (error.response?.data?.action_type?.[0] || '請檢查輸入資料'));
        } finally {
            setSavingRule(false);
        }
    };

    const handleRuleDelete = async (id) => {
        if (!window.confirm('確定要刪除此規則嗎？')) return;
        try {
            await surplusFoodApi.deleteGreenPointRule(id);
            fetchRules();
        } catch (error) {
            console.error('刪除失敗:', error);
        }
    };

    const handleRuleToggleActive = async (id) => {
        try {
            await surplusFoodApi.toggleGreenPointRuleActive(id);
            fetchRules();
        } catch (error) {
            console.error('切換狀態失敗:', error);
        }
    };

    const getActionTypeConfig = (actionType) => ACTION_TYPES.find(t => t.value === actionType) || {};

    // ========== 設定回饋（兌換）相關 ==========
    const fetchRedemptionRules = async () => {
        try {
            setLoadingRedemption(true);
            const data = await surplusFoodApi.getRedemptionRules();
            setRedemptionRules(data);
        } catch (error) {
            console.error('獲取兌換規則失敗:', error);
        } finally {
            setLoadingRedemption(false);
        }
    };

    const handleRedemptionInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setRedemptionFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const openRedemptionModal = (rule = null) => {
        if (rule) {
            setEditingRedemption(rule);
            setRedemptionFormData({
                name: rule.name,
                description: rule.description || '',
                redemption_type: rule.redemption_type,
                required_points: rule.required_points,
                discount_type: rule.discount_type || 'percent',
                discount_value: rule.discount_value || '',
                product_name: rule.product_name || '',
                product_description: rule.product_description || '',
                max_quantity_per_order: rule.max_quantity_per_order || 1,
                is_active: rule.is_active
            });
        } else {
            setEditingRedemption(null);
            setRedemptionFormData({
                name: '',
                description: '',
                redemption_type: 'discount',
                required_points: '',
                discount_type: 'percent',
                discount_value: '',
                product_name: '',
                product_description: '',
                max_quantity_per_order: 1,
                is_active: true
            });
        }
        setShowRedemptionModal(true);
    };

    const closeRedemptionModal = () => {
        setShowRedemptionModal(false);
        setEditingRedemption(null);
    };

    const handleRedemptionSubmit = async (e) => {
        e.preventDefault();

        const submitData = {
            name: redemptionFormData.name,
            description: redemptionFormData.description,
            redemption_type: redemptionFormData.redemption_type,
            required_points: parseInt(redemptionFormData.required_points),
            is_active: redemptionFormData.is_active
        };

        if (redemptionFormData.redemption_type === 'discount') {
            submitData.discount_type = redemptionFormData.discount_type;
            submitData.discount_value = parseFloat(redemptionFormData.discount_value);
            // 折扣兌換僅限一份
            submitData.max_quantity_per_order = 1;
        } else {
            submitData.product_name = redemptionFormData.product_name;
            submitData.product_description = redemptionFormData.product_description;
            submitData.max_quantity_per_order = parseInt(redemptionFormData.max_quantity_per_order) || 1;
        }

        try {
            setSavingRedemption(true);
            if (editingRedemption) {
                await surplusFoodApi.updateRedemptionRule(editingRedemption.id, submitData);
            } else {
                await surplusFoodApi.createRedemptionRule(submitData);
            }
            fetchRedemptionRules();
            closeRedemptionModal();
        } catch (error) {
            console.error('保存失敗:', error);
            alert('保存失敗: ' + (error.response?.data?.detail || '請檢查輸入資料'));
        } finally {
            setSavingRedemption(false);
        }
    };

    const handleRedemptionDelete = async (id) => {
        if (!window.confirm('確定要刪除此兌換規則嗎？')) return;
        try {
            await surplusFoodApi.deleteRedemptionRule(id);
            fetchRedemptionRules();
        } catch (error) {
            console.error('刪除失敗:', error);
        }
    };

    const handleRedemptionToggleActive = async (id) => {
        try {
            await surplusFoodApi.toggleRedemptionRuleActive(id);
            fetchRedemptionRules();
        } catch (error) {
            console.error('切換狀態失敗:', error);
        }
    };

    if (loadingRules || loadingRedemption) {
        return <div className="loading">載入中...</div>;
    }

    return (
        <div className="surplus-tab-content green-points-content">
            {/* 子標籤導覽列 */}
            <div className="sub-tabs">
                <button className={`sub-tab-button ${subTab === 'rules' ? 'active' : ''}`} onClick={() => setSubTab('rules')}>
                    <FaCogs /> 設定規則
                </button>
                <button className={`sub-tab-button ${subTab === 'rewards' ? 'active' : ''}`} onClick={() => setSubTab('rewards')}>
                    <FaGift /> 設定回饋
                </button>
            </div>

            {/* ========== 設定規則頁面 ========== */}
            {subTab === 'rules' && (
                <div className="sub-tab-content">
                    <div className="surplus-content-header">
                        <h2>設定規則</h2>
                        <button className="surplus-btn-primary green-btn" onClick={() => openRuleModal()}>
                            <FaPlus /> 新增規則
                        </button>
                    </div>
                    <p className="reward-description">設定顧客透過環保行為可以獲得的綠色點數</p>

                    {rules.length === 0 ? (
                        <div className="empty-state">
                            <FaCoins style={{ fontSize: '3rem', color: '#4CAF50', marginBottom: '1rem' }} />
                            <p>尚未設定任何規則</p>
                        </div>
                    ) : (
                        <div className="rules-grid">
                            {rules.map(rule => {
                                const config = getActionTypeConfig(rule.action_type);
                                const IconComponent = config.icon || FaLeaf;
                                return (
                                    <div key={rule.id} className={`rule-card ${!rule.is_active ? 'inactive' : ''}`}>
                                        <div className="rule-header" style={{ background: `linear-gradient(135deg, ${config.color}20 0%, ${config.color}10 100%)` }}>
                                            <div className="rule-type-badge" style={{ color: config.color }}><IconComponent /><span>{rule.action_type_display}</span></div>
                                            <button className="toggle-btn" onClick={() => handleRuleToggleActive(rule.id)}>
                                                {rule.is_active ? <FaToggleOn className="active" /> : <FaToggleOff />}
                                            </button>
                                        </div>
                                        <div className="rule-body">
                                            <h3>{rule.name}</h3>
                                            <div className="rule-points reward-points"><FaCoins className="points-icon" /><span>+{rule.points_reward} 點</span></div>
                                        </div>
                                        <div className="rule-actions">
                                            <button className="btn-icon btn-edit" onClick={() => openRuleModal(rule)}><FaEdit /></button>
                                            <button className="btn-icon btn-delete" onClick={() => handleRuleDelete(rule.id)}><FaTrash /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ========== 設定回饋頁面 ========== */}
            {subTab === 'rewards' && (
                <div className="sub-tab-content">
                    <div className="surplus-content-header">
                        <h2>設定回饋</h2>
                        <button className="surplus-btn-primary green-btn" onClick={() => openRedemptionModal()}>
                            <FaPlus /> 新增回饋
                        </button>
                    </div>
                    <p className="reward-description">設定顧客可以用綠色點數兌換的折扣或商品</p>

                    {redemptionRules.length === 0 ? (
                        <div className="empty-state">
                            <FaGift style={{ fontSize: '3rem', color: '#FF9800', marginBottom: '1rem' }} />
                            <p>尚未設定任何兌換規則</p>
                        </div>
                    ) : (
                        <div className="rules-grid">
                            {redemptionRules.map(rule => (
                                <div key={rule.id} className={`rule-card ${!rule.is_active ? 'inactive' : ''}`}>
                                    <div className="rule-header" style={{ background: rule.redemption_type === 'discount' ? 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)' : 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)' }}>
                                        <div className="rule-type-badge" style={{ color: rule.redemption_type === 'discount' ? '#1976D2' : '#E65100' }}>
                                            {rule.redemption_type === 'discount' ? <FaPercent /> : <FaGift />}
                                            <span>{rule.redemption_type_display}</span>
                                        </div>
                                        <button className="toggle-btn" onClick={() => handleRedemptionToggleActive(rule.id)}>
                                            {rule.is_active ? <FaToggleOn className="active" /> : <FaToggleOff />}
                                        </button>
                                    </div>
                                    <div className="rule-body">
                                        <h3>{rule.name}</h3>
                                        <div className="rule-points"><FaCoins className="points-icon" /><span>{rule.required_points} 點</span></div>
                                        <div className="rule-detail">
                                            兌換：{rule.redemption_type === 'discount'
                                                ? (rule.discount_type === 'percent' ? `${rule.discount_value}% 折扣` : `折抵 $${rule.discount_value}`)
                                                : rule.product_name}
                                        </div>
                                    </div>
                                    <div className="rule-actions">
                                        <button className="btn-icon btn-edit" onClick={() => openRedemptionModal(rule)}><FaEdit /></button>
                                        <button className="btn-icon btn-delete" onClick={() => handleRedemptionDelete(rule.id)}><FaTrash /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ========== 設定規則 Modal ========== */}
            {showRuleModal && (
                <div className="modal-overlay" onClick={closeRuleModal}>
                    <div className="modal-content green-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingRule ? '編輯規則' : '新增規則'}</h2>
                            <button className="close-btn" onClick={closeRuleModal}><FaTimes /></button>
                        </div>
                        <form onSubmit={handleRuleSubmit} className="modal-body">
                            <div className="form-group">
                                <label>環保行為類型 *</label>
                                <div className="action-type-grid">
                                    {ACTION_TYPES.map(type => {
                                        const IconComponent = type.icon;
                                        return (
                                            <button
                                                type="button"
                                                key={type.value}
                                                className={`action-type-btn ${ruleFormData.action_type === type.value ? 'active' : ''}`}
                                                style={{ '--action-color': type.color, borderColor: ruleFormData.action_type === type.value ? type.color : '#e0e0e0' }}
                                                onClick={() => handleActionTypeChange(type.value)}
                                            >
                                                <IconComponent style={{ color: type.color }} />
                                                <span>{type.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>規則名稱 *</label>
                                    <input type="text" name="name" value={ruleFormData.name} onChange={handleRuleInputChange} required />
                                </div>
                                <div className="form-group">
                                    <label>獎勵點數 *</label>
                                    <div className="points-input-wrapper">
                                        <input type="number" name="points_reward" value={ruleFormData.points_reward} onChange={handleRuleInputChange} min="1" required />
                                        <span className="points-suffix">點</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>說明（選填）</label>
                                <textarea name="description" value={ruleFormData.description} onChange={handleRuleInputChange} rows="2" />
                            </div>

                            <div className="form-group checkbox-group">
                                <label><input type="checkbox" name="is_active" checked={ruleFormData.is_active} onChange={handleRuleInputChange} /> 啟用此規則</label>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={closeRuleModal}>取消</button>
                                <button type="submit" className="surplus-btn-primary green-btn" disabled={savingRule}>
                                    <FaSave /> {savingRule ? '儲存中...' : (editingRule ? '更新規則' : '新增規則')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========== 設定回饋 Modal ========== */}
            {showRedemptionModal && (
                <div className="modal-overlay" onClick={closeRedemptionModal}>
                    <div className="modal-content green-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingRedemption ? '編輯兌換規則' : '新增兌換規則'}</h2>
                            <button className="close-btn" onClick={closeRedemptionModal}><FaTimes /></button>
                        </div>
                        <form onSubmit={handleRedemptionSubmit} className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>規則名稱 *</label>
                                    <input type="text" name="name" value={redemptionFormData.name} onChange={handleRedemptionInputChange} placeholder="例如：100點換9折" required />
                                </div>
                                <div className="form-group">
                                    <label>所需點數 *</label>
                                    <div className="points-input-wrapper">
                                        <input type="number" name="required_points" value={redemptionFormData.required_points} onChange={handleRedemptionInputChange} min="1" required />
                                        <span className="points-suffix">點</span>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>兌換類型 *</label>
                                <div className="redemption-type-selector">
                                    <button type="button" className={`type-btn ${redemptionFormData.redemption_type === 'discount' ? 'active' : ''}`}
                                        onClick={() => setRedemptionFormData(prev => ({ ...prev, redemption_type: 'discount' }))}>
                                        <FaPercent /> 折扣兌換
                                    </button>
                                    <button type="button" className={`type-btn ${redemptionFormData.redemption_type === 'product' ? 'active' : ''}`}
                                        onClick={() => setRedemptionFormData(prev => ({ ...prev, redemption_type: 'product' }))}>
                                        <FaGift /> 商品兌換
                                    </button>
                                </div>
                            </div>

                            {redemptionFormData.redemption_type === 'discount' && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>折扣類型</label>
                                        <select name="discount_type" value={redemptionFormData.discount_type} onChange={handleRedemptionInputChange}>
                                            <option value="percent">百分比折扣</option>
                                            <option value="amount">固定金額折扣</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>折扣值 *</label>
                                        <div className="points-input-wrapper">
                                            <input type="number" name="discount_value" value={redemptionFormData.discount_value} onChange={handleRedemptionInputChange} min="1" required />
                                            <span className="points-suffix">{redemptionFormData.discount_type === 'percent' ? '%' : '元'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {redemptionFormData.redemption_type === 'product' && (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>商品名稱 *</label>
                                            <input type="text" name="product_name" value={redemptionFormData.product_name} onChange={handleRedemptionInputChange} placeholder="例如：中杯飲料" required />
                                        </div>
                                        <div className="form-group">
                                            <label>單筆訂單可兌換份數 *</label>
                                            <div className="points-input-wrapper">
                                                <input type="number" name="max_quantity_per_order" value={redemptionFormData.max_quantity_per_order} onChange={handleRedemptionInputChange} min="1" max="10" required />
                                                <span className="points-suffix">份</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>商品描述</label>
                                        <textarea name="product_description" value={redemptionFormData.product_description} onChange={handleRedemptionInputChange} rows="2" />
                                    </div>
                                </>
                            )}

                            <div className="form-group checkbox-group">
                                <label><input type="checkbox" name="is_active" checked={redemptionFormData.is_active} onChange={handleRedemptionInputChange} /> 啟用此規則</label>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={closeRedemptionModal}>取消</button>
                                <button type="submit" className="surplus-btn-primary green-btn" disabled={savingRedemption}>
                                    <FaSave /> {savingRedemption ? '儲存中...' : (editingRedemption ? '更新規則' : '新增規則')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GreenPointRuleList;
