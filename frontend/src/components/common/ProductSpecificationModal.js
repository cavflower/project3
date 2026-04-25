import React, { useState, useEffect, useCallback } from 'react';
import { getPublicSpecificationGroups } from '../../api/productApi';
import styles from './ProductSpecificationModal.module.css';

/**
 * 顧客端商品規格選擇 Modal
 * 當商品有規格設定時，顧客點擊加入購物車會先顯示此 Modal
 */
const ProductSpecificationModal = ({ product, initialSpecGroups = null, onConfirm, onCancel }) => {
    const [specGroups, setSpecGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selections, setSelections] = useState({});
    const [error, setError] = useState('');

    const loadSpecifications = useCallback(async () => {
        try {
            setLoading(true);
            const nextSpecGroups = Array.isArray(initialSpecGroups)
                ? initialSpecGroups
                : (await getPublicSpecificationGroups(product.id)).data;
            setSpecGroups(nextSpecGroups);

            // 初始化選擇狀態
            const initialSelections = {};
            nextSpecGroups.forEach(group => {
                if (group.selection_type === 'single') {
                    initialSelections[group.id] = null;
                } else {
                    initialSelections[group.id] = [];
                }
            });
            setSelections(initialSelections);
        } catch (err) {
            console.error('載入規格失敗:', err);
            setError('無法載入商品規格');
        } finally {
            setLoading(false);
        }
    }, [initialSpecGroups, product?.id]);

    useEffect(() => {
        if (product?.id) {
            loadSpecifications();
        }
    }, [product?.id, loadSpecifications]);

    const handleSingleSelect = (groupId, option) => {
        setSelections(prev => ({
            ...prev,
            [groupId]: option
        }));
    };

    const handleMultipleSelect = (groupId, option) => {
        setSelections(prev => {
            const current = prev[groupId] || [];
            const isSelected = current.some(o => o.id === option.id);

            if (isSelected) {
                return {
                    ...prev,
                    [groupId]: current.filter(o => o.id !== option.id)
                };
            } else {
                return {
                    ...prev,
                    [groupId]: [...current, option]
                };
            }
        });
    };

    const calculatePriceAdjustment = () => {
        let adjustment = 0;
        specGroups.forEach(group => {
            const selected = selections[group.id];
            if (group.selection_type === 'single' && selected) {
                adjustment += parseFloat(selected.price_adjustment) || 0;
            } else if (group.selection_type === 'multiple' && Array.isArray(selected)) {
                selected.forEach(opt => {
                    adjustment += parseFloat(opt.price_adjustment) || 0;
                });
            }
        });
        return adjustment;
    };

    const validateSelections = () => {
        for (const group of specGroups) {
            if (group.is_required) {
                const selected = selections[group.id];
                if (group.selection_type === 'single' && !selected) {
                    return `請選擇「${group.name}」`;
                }
                if (group.selection_type === 'multiple' && (!Array.isArray(selected) || selected.length === 0)) {
                    return `請選擇至少一個「${group.name}」選項`;
                }
            }
        }
        return null;
    };

    const handleConfirm = () => {
        const validationError = validateSelections();
        if (validationError) {
            setError(validationError);
            return;
        }

        // 整理已選規格資訊
        const selectedSpecs = [];
        specGroups.forEach(group => {
            const selected = selections[group.id];
            if (group.selection_type === 'single' && selected) {
                selectedSpecs.push({
                    groupName: group.name,
                    optionName: selected.name,
                    priceAdjustment: parseFloat(selected.price_adjustment)
                });
            } else if (group.selection_type === 'multiple' && Array.isArray(selected)) {
                selected.forEach(opt => {
                    selectedSpecs.push({
                        groupName: group.name,
                        optionName: opt.name,
                        priceAdjustment: parseFloat(opt.price_adjustment)
                    });
                });
            }
        });

        const priceAdjustment = calculatePriceAdjustment();
        const finalPrice = parseFloat(product.price) + priceAdjustment;

        onConfirm({
            ...product,
            selectedSpecs,
            priceAdjustment,
            finalPrice,
            // 用於購物車區分不同規格的唯一 key
            specKey: selectedSpecs.map(s => `${s.groupName}:${s.optionName}`).join('|')
        });
    };

    const formatPrice = (value) => {
        const num = parseFloat(value);
        if (num > 0) return `+NT$${num}`;
        if (num < 0) return `-NT$${Math.abs(num)}`;
        return '';
    };

    const priceAdjustment = calculatePriceAdjustment();
    const finalPrice = parseFloat(product?.price || 0) + priceAdjustment;

    return (
        <div className={styles['spec-select-overlay']} onClick={onCancel}>
            <div className={styles['spec-select-modal']} onClick={e => e.stopPropagation()}>
                <div className={styles['spec-select-header']}>
                    <h3>{product?.name}</h3>
                    <p className={styles['spec-base-price']}>基本價格：NT$ {Math.round(product?.price || 0)}</p>
                </div>

                <div className={styles['spec-select-body']}>
                    {loading && <div className={styles['spec-loading']}>載入中...</div>}

                    {error && <div className={styles['spec-error']}>{error}</div>}

                    {!loading && specGroups.length === 0 && (
                        <p className={styles['spec-no-options']}>此商品無需選擇規格</p>
                    )}

                    {specGroups.map(group => (
                        <div key={group.id} className={styles['spec-select-group']}>
                            <div className={styles['spec-group-title']}>
                                <span>{group.name}</span>
                                <span className={styles['spec-group-type']}>
                                    {group.selection_type === 'single' ? '單選' : '多選'}
                                    {group.is_required && <span className={styles['spec-required']}>*必選</span>}
                                </span>
                            </div>

                            <div className={styles['spec-options-list']}>
                                {group.options?.map(option => {
                                    const isSelected = group.selection_type === 'single'
                                        ? selections[group.id]?.id === option.id
                                        : (selections[group.id] || []).some(o => o.id === option.id);

                                    return (
                                        <button
                                            key={option.id}
                                            className={isSelected ? `${styles['spec-option-btn']} ${styles.selected}` : styles['spec-option-btn']}
                                            onClick={() => {
                                                if (group.selection_type === 'single') {
                                                    handleSingleSelect(group.id, option);
                                                } else {
                                                    handleMultipleSelect(group.id, option);
                                                }
                                                setError('');
                                            }}
                                        >
                                            <span className={styles['option-name']}>{option.name}</span>
                                            {parseFloat(option.price_adjustment) !== 0 && (
                                                <span className={`${styles['option-price']} ${parseFloat(option.price_adjustment) > 0 ? styles.positive : styles.negative}`}>
                                                    {formatPrice(option.price_adjustment)}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className={styles['spec-select-footer']}>
                    <div className={styles['spec-total-price']}>
                        <span>合計：</span>
                        <span className={styles['total-amount']}>NT$ {Math.round(finalPrice)}</span>
                    </div>
                    <div className={styles['spec-actions']}>
                        <button className={styles['spec-cancel-btn']} onClick={onCancel}>
                            取消
                        </button>
                        <button className={styles['spec-confirm-btn']} onClick={handleConfirm}>
                            加入購物車
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductSpecificationModal;
