import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { FaLine, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

/**
 * LINE Login 回調處理頁面
 * 用於處理 LINE 授權後的回調
 */
const LineCallbackPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
    const [message, setMessage] = useState('正在處理 LINE 授權...');
    const [lineData, setLineData] = useState(null);

    useEffect(() => {
        handleCallback();
    }, []);

    const handleCallback = async () => {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
            setStatus('error');
            setMessage(errorDescription || `LINE 授權失敗: ${error}`);
            return;
        }

        if (!code) {
            setStatus('error');
            setMessage('缺少授權碼，請重新嘗試綁定');
            return;
        }

        try {
            // 取得當前 callback 頁面的 URL 作為 redirect_uri（必須與授權時相同）
            // 包含 mode 參數以確保完全匹配
            const mode = searchParams.get('mode');
            let callbackUrl = `${window.location.origin}/line-callback`;
            if (mode) {
                callbackUrl += `?mode=${mode}`;
            }
            const redirectUri = encodeURIComponent(callbackUrl);

            // 呼叫後端處理回調
            const response = await fetch(
                `${process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api'}/intelligence/line-login/callback/?code=${code}&state=${state || ''}&redirect_uri=${redirectUri}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            const data = await response.json();

            if (data.success && data.line_user_id) {
                setLineData(data);
                setStatus('success');
                setMessage('LINE 授權成功！正在完成綁定...');

                // 檢查是否為店家綁定模式
                const mode = searchParams.get('mode');

                let redirectUrl;
                if (mode === 'merchant') {
                    // 店家綁定：跳轉到個人資料頁面
                    redirectUrl = `/profile?merchant_line_user_id=${encodeURIComponent(data.line_user_id)}&display_name=${encodeURIComponent(data.display_name || '')}&picture_url=${encodeURIComponent(data.picture_url || '')}`;
                } else {
                    // 一般用戶綁定：跳轉到個人資料頁面
                    redirectUrl = `/profile?line_user_id=${encodeURIComponent(data.line_user_id)}&display_name=${encodeURIComponent(data.display_name || '')}&picture_url=${encodeURIComponent(data.picture_url || '')}`;
                }

                setTimeout(() => {
                    navigate(redirectUrl, { replace: true });
                }, 1500);
            } else {
                setStatus('error');
                setMessage(data.detail || 'LINE 授權失敗');
            }
        } catch (err) {
            console.error('LINE callback error:', err);
            setStatus('error');
            setMessage('處理 LINE 授權時發生錯誤');
        }
    };

    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    py: 4,
                }}
            >
                <FaLine style={{ fontSize: '4rem', color: '#00B900', marginBottom: '24px' }} />

                {status === 'processing' && (
                    <>
                        <CircularProgress sx={{ mb: 3 }} />
                        <Typography variant="h5" gutterBottom>
                            {message}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            請稍候，我們正在處理您的 LINE 授權請求...
                        </Typography>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <FaCheckCircle style={{ fontSize: '3rem', color: '#4caf50', marginBottom: '16px' }} />
                        <Typography variant="h5" gutterBottom color="success.main">
                            {message}
                        </Typography>
                        {lineData && (
                            <Box sx={{ mt: 2, mb: 3 }}>
                                <Typography variant="body1">
                                    歡迎，{lineData.display_name || 'LINE 用戶'}！
                                </Typography>
                            </Box>
                        )}
                        <CircularProgress size={24} sx={{ mt: 2 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            正在跳轉...
                        </Typography>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <FaTimesCircle style={{ fontSize: '3rem', color: '#f44336', marginBottom: '16px' }} />
                        <Alert severity="error" sx={{ mb: 3, width: '100%' }}>
                            {message}
                        </Alert>
                        <Button
                            variant="contained"
                            onClick={() => navigate('/profile')}
                            sx={{ mt: 2 }}
                        >
                            返回個人資料
                        </Button>
                    </>
                )}
            </Box>
        </Container>
    );
};

export default LineCallbackPage;
