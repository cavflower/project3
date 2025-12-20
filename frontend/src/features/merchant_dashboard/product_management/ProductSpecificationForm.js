import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaEdit, FaTrash, FaSave, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import {
    getSpecificationGroups,
    createSpecificationGroup,
    updateSpecificationGroup,
    deleteSpecificationGroup,
    createProductSpecification,
    updateProductSpecification,
    deleteProductSpecification
} from '../../../api/productApi';
import './ProductSpecificationForm.css';

const ProductSpecificationForm = ({ product, onClose }) => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // 展開/收合狀態
    const [expandedGroups, setExpandedGroups] = useState({});

    // 新增/編輯類別表單
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState(null);
    const [groupFormData, setGroupFormData] = useState({
        name: '',
        selection_type: 'single',
        is_required: false,
    });

    // 新增/編輯選項表單
    const [addingOptionGroupId, setAddingOptionGroupId] = useState(null);
    const [editingOptionId, setEditingOptionId] = useState(null);
    const [optionFormData, setOptionFormData] = useState({
        name: '',
        price_adjustment: 0,
    });

    useEffect(() => {
        if (product?.id) {
            fetchGroups();
        }
    }, [product?.id]);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await getSpecificationGroups(product.id);
            setGroups(response.data);
            // 預設展開所有類別
            const expanded = {};
            response.data.forEach(g => { expanded[g.id] = true; });
            setExpandedGroups(expanded);
            setError('');
        } catch (err) {
            console.error('載入規格類別失敗:', err);
            setError('無法載入規格類別');
        } finally {
            setLoading(false);
        }
    };

    // === 規格類別操作 ===
    const resetGroupForm = () => {
        setGroupFormData({ name: '', selection_type: 'single', is_required: false });
        setIsAddingGroup(false);
        setEditingGroupId(null);
    };

    const handleAddGroupClick = () => {
        resetGroupForm();
        setIsAddingGroup(true);
    };

    const handleEditGroupClick = (group) => {
        setGroupFormData({
            name: group.name,
            selection_type: group.selection_type,
            is_required: group.is_required,
        });
        setEditingGroupId(group.id);
        setIsAddingGroup(false);
    };

    const handleGroupSubmit = async (e) => {
        e.preventDefault();
        if (!groupFormData.name.trim()) {
            setError('請輸入類別名稱');
            return;
        }
        try {
            setLoading(true);
            const submitData = {
                product: product.id,
                name: groupFormData.name.trim(),
                selection_type: groupFormData.selection_type,
                is_required: groupFormData.is_required,
            };
            if (editingGroupId) {
                await updateSpecificationGroup(editingGroupId, submitData);
            } else {
                await createSpecificationGroup(submitData);
            }
            await fetchGroups();
            resetGroupForm();
            setError('');
        } catch (err) {
            console.error('儲存類別失敗:', err);
            setError(err.response?.data?.name?.[0] || '儲存失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm('確定要刪除此規格類別及其所有選項嗎？')) return;
        try {
            setLoading(true);
            await deleteSpecificationGroup(groupId);
            await fetchGroups();
        } catch (err) {
            console.error('刪除類別失敗:', err);
            setError('刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    // === 規格選項操作 ===
    const resetOptionForm = () => {
        setOptionFormData({ name: '', price_adjustment: 0 });
        setAddingOptionGroupId(null);
        setEditingOptionId(null);
    };

    const handleAddOptionClick = (groupId) => {
        resetOptionForm();
        setAddingOptionGroupId(groupId);
    };

    const handleEditOptionClick = (option) => {
        setOptionFormData({
            name: option.name,
            price_adjustment: parseFloat(option.price_adjustment),
        });
        setEditingOptionId(option.id);
        setAddingOptionGroupId(null);
    };

    const handleOptionSubmit = async (e, groupId) => {
        e.preventDefault();
        if (!optionFormData.name.trim()) {
            setError('請輸入選項名稱');
            return;
        }
        try {
            setLoading(true);
            const submitData = {
                group: groupId,
                name: optionFormData.name.trim(),
                price_adjustment: parseFloat(optionFormData.price_adjustment) || 0,
            };
            if (editingOptionId) {
                await updateProductSpecification(editingOptionId, submitData);
            } else {
                await createProductSpecification(submitData);
            }
            await fetchGroups();
            resetOptionForm();
            setError('');
        } catch (err) {
            console.error('儲存選項失敗:', err);
            setError(err.response?.data?.name?.[0] || '儲存失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOption = async (optionId) => {
        if (!window.confirm('確定要刪除此選項嗎？')) return;
        try {
            setLoading(true);
            await deleteProductSpecification(optionId);
            await fetchGroups();
        } catch (err) {
            console.error('刪除選項失敗:', err);
            setError('刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const formatPriceAdjustment = (value) => {
        const num = parseFloat(value);
        if (num > 0) return `+NT$${num}`;
        if (num < 0) return `-NT$${Math.abs(num)}`;
        return 'NT$0';
    };

    return (
        <div className="spec-modal-overlay">
            <div className="spec-modal-content">
                <div className="spec-modal-header">
                    <div>
                        <h2>規格設定</h2>
                        <p className="spec-product-name">{product?.name}</p>
                    </div>
                    <button className="spec-modal-close-btn" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                <div className="spec-modal-body">
                    {error && <div className="spec-error-message">{error}</div>}

                    {/* 新增類別按鈕 */}
                    <div className="spec-list-header">
                        <h3>規格類別</h3>
                        {!isAddingGroup && !editingGroupId && (
                            <button className="spec-add-btn" onClick={handleAddGroupClick}>
                                <FaPlus /> 新增類別
                            </button>
                        )}
                    </div>

                    {loading && <div className="spec-loading">載入中...</div>}

                    {/* 新增類別表單 */}
                    {isAddingGroup && (
                        <div className="spec-group-form-card">
                            <form onSubmit={handleGroupSubmit}>
                                <div className="spec-group-form-row">
                                    <input
                                        type="text"
                                        value={groupFormData.name}
                                        onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                                        placeholder="類別名稱（如：大小、配料）"
                                        className="spec-input"
                                        autoFocus
                                    />
                                    <select
                                        value={groupFormData.selection_type}
                                        onChange={(e) => setGroupFormData({ ...groupFormData, selection_type: e.target.value })}
                                        className="spec-select"
                                    >
                                        <option value="single">單選</option>
                                        <option value="multiple">多選</option>
                                    </select>
                                    <label className="spec-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={groupFormData.is_required}
                                            onChange={(e) => setGroupFormData({ ...groupFormData, is_required: e.target.checked })}
                                        />
                                        必選
                                    </label>
                                </div>
                                <div className="spec-form-actions">
                                    <button type="submit" className="spec-save-btn" disabled={loading}>
                                        <FaPlus /> 新增
                                    </button>
                                    <button type="button" className="spec-cancel-btn" onClick={resetGroupForm}>
                                        取消
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* 類別列表 */}
                    {groups.length === 0 && !isAddingGroup && !loading && (
                        <div className="spec-empty">
                            <p>尚未設定任何規格類別</p>
                            <p className="spec-empty-hint">點擊「新增類別」來建立規格分組</p>
                        </div>
                    )}

                    {groups.map((group) => (
                        <div key={group.id} className="spec-group-card">
                            {editingGroupId === group.id ? (
                                <div className="spec-group-form-card">
                                    <form onSubmit={handleGroupSubmit}>
                                        <div className="spec-group-form-row">
                                            <input
                                                type="text"
                                                value={groupFormData.name}
                                                onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                                                className="spec-input"
                                                autoFocus
                                            />
                                            <select
                                                value={groupFormData.selection_type}
                                                onChange={(e) => setGroupFormData({ ...groupFormData, selection_type: e.target.value })}
                                                className="spec-select"
                                            >
                                                <option value="single">單選</option>
                                                <option value="multiple">多選</option>
                                            </select>
                                            <label className="spec-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={groupFormData.is_required}
                                                    onChange={(e) => setGroupFormData({ ...groupFormData, is_required: e.target.checked })}
                                                />
                                                必選
                                            </label>
                                        </div>
                                        <div className="spec-form-actions">
                                            <button type="submit" className="spec-save-btn" disabled={loading}>
                                                <FaSave /> 儲存
                                            </button>
                                            <button type="button" className="spec-cancel-btn" onClick={resetGroupForm}>
                                                取消
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                <>
                                    <div className="spec-group-header" onClick={() => toggleGroup(group.id)}>
                                        <div className="spec-group-toggle">
                                            {expandedGroups[group.id] ? <FaChevronDown /> : <FaChevronRight />}
                                        </div>
                                        <div className="spec-group-info">
                                            <span className="spec-group-name">{group.name}</span>
                                            <span className={`spec-type-badge ${group.selection_type}`}>
                                                {group.selection_type === 'single' ? '單選' : '多選'}
                                            </span>
                                            {group.is_required && <span className="spec-required-badge">必選</span>}
                                            <span className="spec-count">({group.options?.length || 0} 個選項)</span>
                                        </div>
                                        <div className="spec-group-actions" onClick={(e) => e.stopPropagation()}>
                                            <button className="spec-icon-btn edit" onClick={() => handleEditGroupClick(group)} title="編輯">
                                                <FaEdit />
                                            </button>
                                            <button className="spec-icon-btn delete" onClick={() => handleDeleteGroup(group.id)} title="刪除">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </div>

                                    {expandedGroups[group.id] && (
                                        <div className="spec-options-container">
                                            {/* 選項列表 */}
                                            {group.options?.map((option) => (
                                                <div key={option.id} className="spec-option-item">
                                                    {editingOptionId === option.id ? (
                                                        <form onSubmit={(e) => handleOptionSubmit(e, group.id)} className="spec-option-form">
                                                            <input
                                                                type="text"
                                                                value={optionFormData.name}
                                                                onChange={(e) => setOptionFormData({ ...optionFormData, name: e.target.value })}
                                                                className="spec-input"
                                                                autoFocus
                                                            />
                                                            <div className="spec-price-input-group">
                                                                <span className="spec-price-prefix">NT$</span>
                                                                <input
                                                                    type="number"
                                                                    value={optionFormData.price_adjustment}
                                                                    onChange={(e) => setOptionFormData({ ...optionFormData, price_adjustment: e.target.value })}
                                                                    className="spec-price-input"
                                                                    step="1"
                                                                />
                                                            </div>
                                                            <button type="submit" className="spec-save-btn small" disabled={loading}>
                                                                <FaSave />
                                                            </button>
                                                            <button type="button" className="spec-cancel-btn small" onClick={resetOptionForm}>
                                                                取消
                                                            </button>
                                                        </form>
                                                    ) : (
                                                        <>
                                                            <span className="spec-option-name">{option.name}</span>
                                                            <span className={`spec-price ${parseFloat(option.price_adjustment) > 0 ? 'positive' : parseFloat(option.price_adjustment) < 0 ? 'negative' : ''}`}>
                                                                {formatPriceAdjustment(option.price_adjustment)}
                                                            </span>
                                                            <div className="spec-option-actions">
                                                                <button className="spec-icon-btn edit small" onClick={() => handleEditOptionClick(option)}>
                                                                    <FaEdit />
                                                                </button>
                                                                <button className="spec-icon-btn delete small" onClick={() => handleDeleteOption(option.id)}>
                                                                    <FaTrash />
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}

                                            {/* 新增選項表單 */}
                                            {addingOptionGroupId === group.id ? (
                                                <form onSubmit={(e) => handleOptionSubmit(e, group.id)} className="spec-option-form new">
                                                    <input
                                                        type="text"
                                                        value={optionFormData.name}
                                                        onChange={(e) => setOptionFormData({ ...optionFormData, name: e.target.value })}
                                                        placeholder="選項名稱（如：大份）"
                                                        className="spec-input"
                                                        autoFocus
                                                    />
                                                    <div className="spec-price-input-group">
                                                        <span className="spec-price-prefix">NT$</span>
                                                        <input
                                                            type="number"
                                                            value={optionFormData.price_adjustment}
                                                            onChange={(e) => setOptionFormData({ ...optionFormData, price_adjustment: e.target.value })}
                                                            placeholder="0"
                                                            className="spec-price-input"
                                                            step="1"
                                                        />
                                                    </div>
                                                    <button type="submit" className="spec-save-btn small" disabled={loading}>
                                                        <FaPlus />
                                                    </button>
                                                    <button type="button" className="spec-cancel-btn small" onClick={resetOptionForm}>
                                                        取消
                                                    </button>
                                                </form>
                                            ) : (
                                                <button className="spec-add-option-btn" onClick={() => handleAddOptionClick(group.id)}>
                                                    <FaPlus /> 新增選項
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    {/* 說明 */}
                    <div className="spec-help-section">
                        <h4>使用說明</h4>
                        <ul>
                            <li><strong>規格類別</strong>：如「大小」、「配料」、「辣度」</li>
                            <li><strong>單選/多選</strong>：單選只能選一個選項，多選可選多個</li>
                            <li><strong>規格選項</strong>：類別下的具體選項，可設定價格調整</li>
                        </ul>
                    </div>
                </div>

                <div className="spec-modal-footer">
                    <button className="spec-close-btn" onClick={onClose}>關閉</button>
                </div>
            </div>
        </div>
    );
};

export default ProductSpecificationForm;
