import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getMyStore } from '../api/storeApi';

// 創建 Store Context
const StoreContext = createContext(null);

/**
 * StoreProvider - 提供店家資料給所有需要的子組件
 * 避免多個組件重複呼叫 getMyStore API
 */
export const StoreProvider = ({ children }) => {
    const { user } = useAuth();
    const [store, setStore] = useState(null);
    const [storeSettings, setStoreSettings] = useState({
        enable_reservation: true,
        enable_loyalty: true,
        enable_surplus_food: true,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 使用 ref 追蹤是否已載入和是否正在載入中
    const hasLoadedRef = useRef(false);
    const isLoadingRef = useRef(false);

    // 載入店家資料
    const loadStore = useCallback(async (forceReload = false) => {
        // 只有商家需要載入店家資料
        if (user?.user_type !== 'merchant') {
            setLoading(false);
            return;
        }

        // 避免重複載入 - 如果已載入且不是強制刷新
        if (hasLoadedRef.current && !forceReload) {
            setLoading(false);
            return;
        }

        // 避免並行請求 - 如果正在載入中則跳過
        if (isLoadingRef.current) {
            return;
        }

        try {
            isLoadingRef.current = true;
            setLoading(true);
            const response = await getMyStore();
            const storeData = response.data;

            setStore(storeData);
            setStoreSettings({
                enable_reservation: storeData.enable_reservation !== undefined ? storeData.enable_reservation : true,
                enable_loyalty: storeData.enable_loyalty !== undefined ? storeData.enable_loyalty : true,
                enable_surplus_food: storeData.enable_surplus_food !== undefined ? storeData.enable_surplus_food : true,
            });
            hasLoadedRef.current = true;
            setError(null);
        } catch (err) {
            // 404 錯誤表示商家尚未建立店家資料，這是正常情況
            if (err.response?.status === 404) {
                console.log('[StoreContext] Store not found - merchant needs to create store settings first');
                setStore(null);
                hasLoadedRef.current = true; // 仍然標記為已載入，避免重複嘗試
            } else {
                console.error('[StoreContext] Error loading store:', err);
                setError(err);
            }
        } finally {
            isLoadingRef.current = false;
            setLoading(false);
        }
    }, [user?.user_type]); // 只依賴 user_type，避免 store 變化觸發重新載入

    // 強制重新載入（用於更新後刷新資料）
    const refreshStore = useCallback(async () => {
        hasLoadedRef.current = false;
        await loadStore(true);
    }, [loadStore]);

    // 當用戶改變時載入店家資料
    useEffect(() => {
        if (user?.user_type === 'merchant') {
            loadStore();
        } else {
            // 非商家用戶，重置狀態
            setStore(null);
            setLoading(false);
            hasLoadedRef.current = false;
            isLoadingRef.current = false;
        }
    }, [user?.user_type, loadStore]);

    const value = {
        store,
        storeSettings,
        storeId: store?.id || null,
        loading,
        error,
        refreshStore,
    };

    return (
        <StoreContext.Provider value={value}>
            {children}
        </StoreContext.Provider>
    );
};

// Hook 讓其他組件方便使用
export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};

export default StoreContext;
