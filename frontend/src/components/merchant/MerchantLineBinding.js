import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Avatar,
    CircularProgress,
    Alert,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import { FaLine } from 'react-icons/fa';
import { getMerchantLineStatus, bindMerchantLine, unbindMerchantLine } from '../../api/merchantLineApi';
import { getLineAuthUrl } from '../../api/lineLoginApi';

/**
 * 店家 LINE 綁定元件 - MUI 樣式版本
 * 用於店家個人資料頁面，管理 LINE 綁定
 */
const MerchantLineBinding = () => {
    const [loading, setLoading] = useState(true);
    const [binding, setBinding] = useState(null);
    const [error, setError] = useState(null);
    const [unbindDialogOpen, setUnbindDialogOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadBindingStatus();
        handleCallbackIfNeeded();
    }, []);

    const loadBindingStatus = async () => {
        try {
            setLoading(true);
            const status = await getMerchantLineStatus();
            setBinding(status.is_bound ? status : null);
        } catch (err) {
            console.error('載入店家 LINE 綁定狀態失敗:', err);
            setBinding(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCallbackIfNeeded = async () => {
        const params = new URLSearchParams(window.location.search);
        const lineUserId = params.get('merchant_line_user_id');
        const displayName = params.get('display_name');
        const pictureUrl = params.get('picture_url');

        if (lineUserId) {
            try {
                setProcessing(true);
                await bindMerchantLine({
                    line_user_id: lineUserId,
                    display_name: displayName || '',
                    picture_url: pictureUrl || '',
                });
                window.history.replaceState({}, '', window.location.pathname);
                await loadBindingStatus();
                setError(null);
            } catch (err) {
                setError(err.response?.data?.detail || '綁定失敗');
            } finally {
                setProcessing(false);
            }
        }
    };

    const handleBindClick = async () => {
        try {
            setProcessing(true);
            setError(null);
            const redirectUri = `${window.location.origin}/line-callback?mode=merchant`;
            const result = await getLineAuthUrl(redirectUri);

            if (result.auth_url) {
                window.location.href = result.auth_url;
            }
        } catch (err) {
            setError(err.response?.data?.detail || '取得授權連結失敗');
            setProcessing(false);
        }
    };

    const handleUnbindClick = () => {
        setUnbindDialogOpen(true);
    };

    const handleUnbindConfirm = async () => {
        try {
            setProcessing(true);
            await unbindMerchantLine();
            setBinding(null);
            setUnbindDialogOpen(false);
        } catch (err) {
            setError(err.response?.data?.detail || '解除綁定失敗');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <Card sx={{ mb: 3 }}>
                <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <FaLine style={{ fontSize: '2rem', color: '#00B900' }} />
                        <Typography variant="h6" fontWeight="bold">
                            LINE 帳號綁定
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    {binding ? (
                        <Box>
                            <Box display="flex" alignItems="center" gap={2} mb={2}>
                                <Avatar
                                    src={binding.picture_url}
                                    alt={binding.display_name}
                                    sx={{ width: 56, height: 56 }}
                                />
                                <Box>
                                    <Typography variant="body1" fontWeight="bold">
                                        {binding.display_name || 'LINE 用戶'}
                                    </Typography>
                                    <Chip
                                        label="已綁定"
                                        color="success"
                                        size="small"
                                        sx={{ mt: 0.5 }}
                                    />
                                </Box>
                            </Box>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                綁定時間：{new Date(binding.created_at).toLocaleString('zh-TW')}
                            </Typography>
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={handleUnbindClick}
                                disabled={processing}
                            >
                                解除綁定
                            </Button>
                        </Box>
                    ) : (
                        <Box>
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                綁定 LINE 帳號後，即可享有以下功能：
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                                <li><Typography variant="body2">接收排班相關通知</Typography></li>
                                <li><Typography variant="body2">接收營運分析報告</Typography></li>
                                <li><Typography variant="body2">接收原物料不足提醒</Typography></li>
                                <li><Typography variant="body2">接收訂單異常警報</Typography></li>
                            </Box>
                            <Button
                                variant="contained"
                                startIcon={<FaLine />}
                                onClick={handleBindClick}
                                disabled={processing}
                                sx={{
                                    background: '#00B900',
                                    '&:hover': { background: '#009900' },
                                }}
                            >
                                {processing ? '處理中...' : '綁定 LINE 帳號'}
                            </Button>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* 解除綁定確認 Dialog */}
            <Dialog open={unbindDialogOpen} onClose={() => setUnbindDialogOpen(false)}>
                <DialogTitle>確認解除綁定</DialogTitle>
                <DialogContent>
                    <Typography>
                        解除綁定後，您將無法透過 LINE 接收店家通知。確定要解除綁定嗎？
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUnbindDialogOpen(false)}>取消</Button>
                    <Button
                        onClick={handleUnbindConfirm}
                        color="error"
                        disabled={processing}
                    >
                        {processing ? '處理中...' : '確認解除'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default MerchantLineBinding;
