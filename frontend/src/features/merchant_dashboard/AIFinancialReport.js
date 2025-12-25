import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Paper,
    Typography,
    Box,
    Grid,
    Card,
    CardContent,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    CircularProgress,
    Alert,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import {
    TrendingUp,
    Receipt,
    AttachMoney,
    Restaurant,
    LocalCafe,
    SmartToy,
    Refresh,
    ArrowBack,
} from '@mui/icons-material';
import { getSalesSummary, getAIReport } from '../../api/financialApi';
import { useAuth } from '../../store/AuthContext';

const AIFinancialReport = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [period, setPeriod] = useState('week');
    const [loading, setLoading] = useState(true);
    const [aiLoading, setAILoading] = useState(false);
    const [error, setError] = useState(null);
    const [salesData, setSalesData] = useState(null);
    const [aiReport, setAIReport] = useState(null);

    useEffect(() => {
        if (user) {
            loadSalesData();
        }
    }, [user, period]);

    const loadSalesData = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getSalesSummary({ period });
            setSalesData(data);
        } catch (err) {
            console.error('載入銷售數據失敗:', err);
            setError('載入銷售數據失敗，請稍後再試');
        } finally {
            setLoading(false);
        }
    };

    const loadAIReport = async () => {
        try {
            setAILoading(true);
            setError(null);
            const data = await getAIReport({ period });
            setAIReport(data.ai_analysis);
        } catch (err) {
            console.error('載入 AI 報告失敗:', err);
            setError('載入 AI 報告失敗，請稍後再試');
        } finally {
            setAILoading(false);
        }
    };

    const handlePeriodChange = (event, newPeriod) => {
        if (newPeriod) {
            setPeriod(newPeriod);
            setAIReport(null);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('zh-TW', {
            style: 'currency',
            currency: 'TWD',
            minimumFractionDigits: 0,
        }).format(value || 0);
    };

    const getPeriodLabel = () => {
        switch (period) {
            case 'day': return '今日';
            case 'week': return '本週';
            case 'month': return '本月';
            default: return '';
        }
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* 頁面標題 */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box display="flex" alignItems="center" gap={2}>
                    <Button
                        startIcon={<ArrowBack />}
                        onClick={() => navigate('/merchant/dashboard')}
                        sx={{ color: 'text.secondary' }}
                    >
                        返回
                    </Button>
                    <Typography variant="h4" fontWeight="bold">
                        📊 AI 財務報表分析
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={loadSalesData}
                >
                    重新整理
                </Button>
            </Box>

            {/* 錯誤提示 */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* 時間區間選擇 */}
            <Box display="flex" justifyContent="center" mb={4}>
                <ToggleButtonGroup
                    value={period}
                    exclusive
                    onChange={handlePeriodChange}
                    aria-label="統計週期"
                >
                    <ToggleButton value="day">今日</ToggleButton>
                    <ToggleButton value="week">本週</ToggleButton>
                    <ToggleButton value="month">本月</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {/* 摘要卡片 */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <AttachMoney />
                                <Typography variant="subtitle2">總營收</Typography>
                            </Box>
                            <Typography variant="h4" fontWeight="bold">
                                {formatCurrency(salesData?.summary?.total_revenue)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <Receipt />
                                <Typography variant="subtitle2">總訂單數</Typography>
                            </Box>
                            <Typography variant="h4" fontWeight="bold">
                                {salesData?.summary?.total_orders || 0} 筆
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <TrendingUp />
                                <Typography variant="subtitle2">平均客單價</Typography>
                            </Box>
                            <Typography variant="h4" fontWeight="bold">
                                {formatCurrency(salesData?.summary?.avg_order_value)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
                        <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <Restaurant />
                                <Typography variant="subtitle2">外帶 / 內用</Typography>
                            </Box>
                            <Typography variant="h4" fontWeight="bold">
                                {salesData?.summary?.takeout_orders || 0} / {salesData?.summary?.dinein_orders || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* 熱銷商品 */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight="bold" mb={2}>
                            🏆 熱銷商品排行
                        </Typography>
                        {salesData?.top_products?.length > 0 ? (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>排名</TableCell>
                                            <TableCell>商品名稱</TableCell>
                                            <TableCell align="right">銷售數量</TableCell>
                                            <TableCell align="right">營收</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {salesData.top_products.slice(0, 5).map((product, index) => (
                                            <TableRow key={product.product_id}>
                                                <TableCell>
                                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                                                </TableCell>
                                                <TableCell>{product.product_name}</TableCell>
                                                <TableCell align="right">{product.quantity_sold}</TableCell>
                                                <TableCell align="right">{formatCurrency(product.revenue)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography color="text.secondary">暫無銷售數據</Typography>
                        )}
                    </Paper>
                </Grid>

                {/* 時段分析 */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight="bold" mb={2}>
                            ⏰ 尖峰時段
                        </Typography>
                        {salesData?.hourly_sales ? (
                            <Box>
                                {salesData.hourly_sales
                                    .filter(h => h.orders > 0)
                                    .sort((a, b) => b.orders - a.orders)
                                    .slice(0, 5)
                                    .map((hour) => (
                                        <Box key={hour.hour} display="flex" alignItems="center" mb={1}>
                                            <Typography sx={{ width: 80 }}>
                                                {`${hour.hour.toString().padStart(2, '0')}:00`}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    height: 20,
                                                    bgcolor: 'primary.light',
                                                    borderRadius: 1,
                                                    width: `${(hour.orders / Math.max(...salesData.hourly_sales.map(h => h.orders))) * 100}%`,
                                                    minWidth: 20,
                                                }}
                                            />
                                            <Typography sx={{ width: 60, textAlign: 'right' }}>
                                                {hour.orders} 筆
                                            </Typography>
                                        </Box>
                                    ))}
                                {salesData.hourly_sales.filter(h => h.orders > 0).length === 0 && (
                                    <Typography color="text.secondary">暫無訂單數據</Typography>
                                )}
                            </Box>
                        ) : (
                            <Typography color="text.secondary">暫無時段數據</Typography>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* AI 分析報告 */}
            <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <SmartToy color="primary" />
                        <Typography variant="h6" fontWeight="bold">
                            🤖 AI 智能分析
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={aiLoading ? <CircularProgress size={20} color="inherit" /> : <SmartToy />}
                        onClick={loadAIReport}
                        disabled={aiLoading}
                    >
                        {aiLoading ? '分析中...' : aiReport ? '重新分析' : '生成分析報告'}
                    </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />
                {aiReport ? (
                    <Box sx={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.8,
                        '& p': { mb: 1 }
                    }}>
                        <Typography component="div">
                            {aiReport}
                        </Typography>
                    </Box>
                ) : (
                    <Box textAlign="center" py={4} color="text.secondary">
                        <SmartToy sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                        <Typography>
                            點擊「生成分析報告」讓 AI 為您分析{getPeriodLabel()}的營業數據
                        </Typography>
                    </Box>
                )}
            </Paper>
        </Container>
    );
};

export default AIFinancialReport;
