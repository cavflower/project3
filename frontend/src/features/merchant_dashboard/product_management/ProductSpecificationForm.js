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
import styles from './ProductSpecificationForm.module.css';

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
        <div className={styles.specModalOverlay}>
            <div className={styles.specModalContent}>
                <div className={styles.specModalHeader}>
                    <div>
                        <h2>規格設定</h2>
                        <p className={styles.specProductName}>{product?.name}</p>
                    </div>
                    <button className={styles.specModalCloseBtn} onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                <div className={styles.specModalBody}>
                    {error && <div className={styles.specErrorMessage}>{error}</div>}

                    {/* 新增類別按鈕 */}
                    <div className={styles.specListHeader}>
                        <h3>規格類別</h3>
                        {!isAddingGroup && !editingGroupId && (
                            <button className={styles.specAddBtn} onClick={handleAddGroupClick}>
                                <FaPlus /> 新增類別
                            </button>
                        )}
                    </div>

                    {loading && <div className={styles.specLoading}>載入中...</div>}

                    {/* 新增類別表單 */}
                    {isAddingGroup && (
                        <div className={styles.specGroupFormCard}>
                            <form onSubmit={handleGroupSubmit}>
                                <div className={styles.specGroupFormRow}>
                                    <input
                                        type="text"
                                        value={groupFormData.name}
                                        onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                                        placeholder="類別名稱（如：大小、配料）"
                                        className={styles.specInput}
                                        autoFocus
                                    />
                                    <select
                                        value={groupFormData.selection_type}
                                        onChange={(e) => setGroupFormData({ ...groupFormData, selection_type: e.target.value })}
                                        className={styles.specSelect}
                                    >
                                        <option value="single">單選</option>
                                        <option value="multiple">多選</option>
                                    </select>
                                    <label className={styles.specCheckboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={groupFormData.is_required}
                                            onChange={(e) => setGroupFormData({ ...groupFormData, is_required: e.target.checked })}
                                        />
                                        必選
                                    </label>
                                </div>
                                <div className={styles.specFormActions}>
                                    <button type="submit" className={styles.specSaveBtn} disabled={loading}>
                                        <FaPlus /> 新增
                                    </button>
                                    <button type="button" className={styles.specCancelBtn} onClick={resetGroupForm}>
                                        取消
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* 類別列表 */}
                    {groups.length === 0 && !isAddingGroup && !loading && (
                        <div className={styles.specEmpty}>
                            <p>尚未設定任何規格類別</p>
                            <p className={styles.specEmptyHint}>點擊「新增類別」來建立規格分組</p>
                        </div>
                    )}

                    {groups.map((group) => (
                        <div key={group.id} className={styles.specGroupCard}>
                            {editingGroupId === group.id ? (
                                <div className={styles.specGroupFormCard}>
                                    <form onSubmit={handleGroupSubmit}>
                                        <div className={styles.specGroupFormRow}>
                                            <input
                                                type="text"
                                                value={groupFormData.name}
                                                onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                                                className={styles.specInput}
                                                autoFocus
                                            />
                                            <select
                                                value={groupFormData.selection_type}
                                                onChange={(e) => setGroupFormData({ ...groupFormData, selection_type: e.target.value })}
                                                className={styles.specSelect}
                                            >
                                                <option value="single">單選</option>
                                                <option value="multiple">多選</option>
                                            </select>
                                            <label className={styles.specCheckboxLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={groupFormData.is_required}
                                                    onChange={(e) => setGroupFormData({ ...groupFormData, is_required: e.target.checked })}
                                                />
                                                必選
                                            </label>
                                        </div>
                                        <div className={styles.specFormActions}>
                                            <button type="submit" className={styles.specSaveBtn} disabled={loading}>
                                                <FaSave /> 儲存
                                            </button>
                                            <button type="button" className={styles.specCancelBtn} onClick={resetGroupForm}>
                                                取消
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.specGroupHeader} onClick={() => toggleGroup(group.id)}>
                                        <div className={styles.specGroupToggle}>
                                            {expandedGroups[group.id] ? <FaChevronDown /> : <FaChevronRight />}
                                        </div>
                                        <div className={styles.specGroupInfo}>
                                            <span className={styles.specGroupName}>{group.name}</span>
                                            <span className={group.selection_type === 'single' ? styles.specTypeBadgeSingle : styles.specTypeBadgeMultiple}>
                                                {group.selection_type === 'single' ? '單選' : '多選'}
                                            </span>
                                            {group.is_required && <span className={styles.specRequiredBadge}>必選</span>}
                                            <span className={styles.specCount}>({group.options?.length || 0} 個選項)</span>
                                        </div>
                                        <div className={styles.specGroupActions} onClick={(e) => e.stopPropagation()}>
                                            <button className={`${styles.specIconBtn} ${styles.specIconBtnEdit}`} onClick={() => handleEditGroupClick(group)} title="編輯">
                                                <FaEdit />
                                            </button>
                                            <button className={`${styles.specIconBtn} ${styles.specIconBtnDelete}`} onClick={() => handleDeleteGroup(group.id)} title="刪除">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </div>

                                    {expandedGroups[group.id] && (
                                        <div className={styles.specOptionsContainer}>
                                            {/* 選項列表 */}
                                            {group.options?.map((option) => (
                                                <div key={option.id} className={styles.specOptionItem}>
                                                    {editingOptionId === option.id ? (
                                                        <form onSubmit={(e) => handleOptionSubmit(e, group.id)} className={styles.specOptionForm}>
                                                            <input
                                                                type="text"
                                                                value={optionFormData.name}
                                                                onChange={(e) => setOptionFormData({ ...optionFormData, name: e.target.value })}
                                                                className={styles.specInput}
                                                                autoFocus
                                                            />
                                                            <div className={styles.specPriceInputGroup}>
                                                                <span className={styles.specPricePrefix}>NT$</span>
                                                                <input
                                                                    type="number"
                                                                    value={optionFormData.price_adjustment}
                                                                    onChange={(e) => setOptionFormData({ ...optionFormData, price_adjustment: e.target.value })}
                                                                    className={styles.specPriceInput}
                                                                    step="1"
                                                                />
                                                            </div>
                                                            <button type="submit" className={`${styles.specSaveBtn} ${styles.specIconBtnSmall}`} disabled={loading}>
                                                                <FaSave />
                                                            </button>
                                                            <button type="button" className={`${styles.specCancelBtn} ${styles.specIconBtnSmall}`} onClick={resetOptionForm}>
                                                                取消
                                                            </button>
                                                        </form>
                                                    ) : (
                                                        <>
                                                            <span className={styles.specOptionName}>{option.name}</span>
                                                            <span className={parseFloat(option.price_adjustment) > 0 ? styles.specPricePositive : parseFloat(option.price_adjustment) < 0 ? styles.specPriceNegative : styles.specPrice}>
                                                                {formatPriceAdjustment(option.price_adjustment)}
                                                            </span>
                                                            <div className={styles.specOptionActions}>
                                                                <button className={`${styles.specIconBtn} ${styles.specIconBtnEdit} ${styles.specIconBtnSmall}`} onClick={() => handleEditOptionClick(option)}>
                                                                    <FaEdit />
                                                                </button>
                                                                <button className={`${styles.specIconBtn} ${styles.specIconBtnDelete} ${styles.specIconBtnSmall}`} onClick={() => handleDeleteOption(option.id)}>
                                                                    <FaTrash />
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}

                                            {/* 新增選項表單 */}
                                            {addingOptionGroupId === group.id ? (
                                                <form onSubmit={(e) => handleOptionSubmit(e, group.id)} className={styles.specOptionFormNew}>
                                                    <input
                                                        type="text"
                                                        value={optionFormData.name}
                                                        onChange={(e) => setOptionFormData({ ...optionFormData, name: e.target.value })}
                                                        placeholder="選項名稱（如：大份）"
                                                        className={styles.specInput}
                                                        autoFocus
                                                    />
                                                    <div className={styles.specPriceInputGroup}>
                                                        <span className={styles.specPricePrefix}>NT$</span>
                                                        <input
                                                            type="number"
                                                            value={optionFormData.price_adjustment}
                                                            onChange={(e) => setOptionFormData({ ...optionFormData, price_adjustment: e.target.value })}
                                                            placeholder="0"
                                                            className={styles.specPriceInput}
                                                            step="1"
                                                        />
                                                    </div>
                                                    <button type="submit" className={`${styles.specSaveBtn} ${styles.specIconBtnSmall}`} disabled={loading}>
                                                        <FaPlus />
                                                    </button>
                                                    <button type="button" className={`${styles.specCancelBtn} ${styles.specIconBtnSmall}`} onClick={resetOptionForm}>
                                                        取消
                                                    </button>
                                                </form>
                                            ) : (
                                                <button className={styles.specAddOptionBtn} onClick={() => handleAddOptionClick(group.id)}>
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
                    <div className={styles.specHelpSection}>
                        <h4>使用說明</h4>
                        <ul>
                            <li><strong>規格類別</strong>：如「大小」、「配料」、「辣度」</li>
                            <li><strong>單選/多選</strong>：單選只能選一個選項，多選可選多個</li>
                            <li><strong>規格選項</strong>：類別下的具體選項，可設定價格調整</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.specModalFooter}>
                    <button className={styles.specCloseBtn} onClick={onClose}>關閉</button>
                </div>
            </div>
        </div>
    );
};

export default ProductSpecificationForm;
