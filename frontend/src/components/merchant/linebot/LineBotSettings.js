import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  Chip,
  Autocomplete,
  Snackbar,
  Card,
  CardContent,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../store/AuthContext';
import { getMyStore } from '../../../api/storeApi';
import {
  getLineBotConfig,
  createLineBotConfig,
  updateLineBotConfig,
  getAvailableFoodTags,
  getPersonalizedTargets,
  createBroadcastMessage,
  sendBroadcastMessage,
} from '../../../api/lineBotApi';

const LineBotSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    store: null,
    line_channel_access_token: '',
    line_channel_secret: '',
    custom_system_prompt: '',
    welcome_message: '',
    enable_ai_reply: true,
    enable_conversation_history: true,
    is_active: true,
    // 個人化推播預設設定
    broadcast_default_tags: [],
    broadcast_default_days_inactive: 0,
    broadcast_default_message: '',
    use_platform_recommendation_frequency: true,
    popular_recommendation_min_interval_minutes: '',
    popular_recommendation_weekly_limit: '',
    enable_popular_recommendation_push: true,
    enable_new_product_recommendation_push: true,
  });

  // 個人化推播相關 state
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [daysInactive, setDaysInactive] = useState(0);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetCount, setTargetCount] = useState(0);
  const [targetUsers, setTargetUsers] = useState([]);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // 先獲取店家 ID
  useEffect(() => {
    const fetchStore = async () => {
      try {
        if (!user) {
          setError('請先登入');
          setLoading(false);
          return;
        }

        const response = await getMyStore();
        if (response && response.data && response.data.id) {
          setStoreId(response.data.id);
          setFormData(prev => ({ ...prev, store: response.data.id }));
        } else {
          setError('找不到店家資料，請先完成店家設定');
          setLoading(false);
        }
      } catch (err) {
        console.error('[LineBot] Error fetching store:', err);
        if (err.response?.status === 404) {
          setError('找不到店家資料，請先到「餐廳設定」建立你的店家資訊。');
        } else {
          setError('獲取店家資料失敗，請稍後再試。');
        }
        setLoading(false);
      }
    };

    fetchStore();
  }, [user]);

  // 獲取店家 ID 後載入設定
  useEffect(() => {
    if (storeId) {
      loadConfig();
    }
  }, [storeId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLineBotConfig(storeId);
      if (data) {
        setConfig(data);
        setFormData((prev) => ({
          ...prev,
          ...data,
          popular_recommendation_min_interval_minutes:
            data.popular_recommendation_min_interval_minutes ?? '',
          popular_recommendation_weekly_limit:
            data.popular_recommendation_weekly_limit ?? '',
          // 不顯示敏感資料，但保留欄位
          line_channel_access_token: '',
          line_channel_secret: '',
          ai_api_key: '',
        }));
        // 載入推播預設設定到推播 UI state
        if (data.broadcast_default_tags) {
          setSelectedTags(data.broadcast_default_tags);
        }
        if (data.broadcast_default_days_inactive) {
          setDaysInactive(data.broadcast_default_days_inactive);
        }
        if (data.broadcast_default_message) {
          setBroadcastMessage(data.broadcast_default_message);
        }
      }
    } catch (err) {
      console.error('載入設定失敗:', err);
      setError('載入設定失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // 過濾掉空的敏感欄位（避免清空已設定的值）
      const submitData = {
        ...formData,
        // 同步推播 UI 的設定作為預設值
        broadcast_default_tags: selectedTags,
        broadcast_default_days_inactive: daysInactive,
        broadcast_default_message: broadcastMessage,
      };
      if (submitData.popular_recommendation_min_interval_minutes === '') {
        submitData.popular_recommendation_min_interval_minutes = null;
      }
      if (submitData.popular_recommendation_weekly_limit === '') {
        submitData.popular_recommendation_weekly_limit = null;
      }
      if (!submitData.line_channel_access_token) {
        delete submitData.line_channel_access_token;
      }
      if (!submitData.line_channel_secret) {
        delete submitData.line_channel_secret;
      }
      if (!submitData.ai_api_key) {
        delete submitData.ai_api_key;
      }

      if (config) {
        // 更新現有設定
        await updateLineBotConfig(config.id, submitData);
        setSuccess('設定已更新');
      } else {
        // 建立新設定
        const newConfig = await createLineBotConfig(submitData);
        setConfig(newConfig);
        setSuccess('設定已建立');
      }

      // 重新載入設定
      await loadConfig();
    } catch (err) {
      console.error('儲存設定失敗:', err);
      setError(err.response?.data?.detail || '儲存設定失敗');
    } finally {
      setSaving(false);
    }
  };

  // 載入可用的食物標籤
  useEffect(() => {
    const loadFoodTags = async () => {
      if (storeId) {
        try {
          const data = await getAvailableFoodTags();
          setAvailableTags(data.tags || []);
        } catch (err) {
          console.error('載入食物標籤失敗:', err);
        }
      }
    };
    loadFoodTags();
  }, [storeId]);

  // 當篩選條件變更時，更新目標用戶數量
  useEffect(() => {
    const fetchTargets = async () => {
      if (storeId) {
        try {
          const data = await getPersonalizedTargets({
            food_tags: selectedTags,
            days_inactive: daysInactive,
          });
          setTargetCount(data.target_count);
          setTargetUsers(data.target_users);
        } catch (err) {
          console.error('取得目標用戶失敗:', err);
        }
      }
    };
    fetchTargets();
  }, [storeId, selectedTags, daysInactive]);

  // 發送個人化推播
  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      setError('請填寫推播標題和訊息內容');
      return;
    }
    if (targetUsers.length === 0) {
      setError('沒有符合條件的目標用戶');
      return;
    }

    try {
      setSendingBroadcast(true);
      setError(null);
      setBroadcastResult(null);

      // 建立推播訊息
      const broadcastData = {
        broadcast_type: 'personalized',
        title: broadcastTitle,
        message_content: broadcastMessage,
        target_users: targetUsers,
      };

      const created = await createBroadcastMessage(broadcastData);

      // 發送推播
      const result = await sendBroadcastMessage(created.id);

      setBroadcastResult({
        success: true,
        message: `推播發送成功！成功: ${result.success_count}, 失敗: ${result.failure_count}`,
      });

      // 清空表單
      setBroadcastTitle('');
      setBroadcastMessage('');
      setSelectedTags([]);
      setDaysInactive(0);
    } catch (err) {
      console.error('發送推播失敗:', err);
      setBroadcastResult({
        success: false,
        message: err.response?.data?.error || '發送推播失敗',
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            LINE BOT 設定
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate('/merchant/line-bot/faq')}
          >
            📝 管理 FAQ
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          {/* LINE 設定區塊 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            LINE Messaging API 設定
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Alert severity="info" sx={{ mb: 2 }}>
            LINE Channel 憑證由平台管理員統一設定。如需修改，請聯繫平台管理員。
          </Alert>

          {config?.invitation_url && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <strong>操作權限邀請網址：</strong>
              <br />
              <a
                href={config.invitation_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ wordBreak: 'break-all' }}
              >
                {config.invitation_url}
              </a>
              <br />
              <small>點擊上方連結加入 LINE 官方帳號的操作人員</small>
            </Alert>
          )}

          {/* AI 設定提示 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            AI 智能回覆
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Alert severity="info" sx={{ mb: 2 }}>
            AI 服務由平台統一提供，已自動配置完成。您可以在下方「功能設定」中選擇是否啟用 AI 回覆。
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="自訂系統提示詞（選填）"
                name="custom_system_prompt"
                value={formData.custom_system_prompt}
                onChange={handleChange}
                placeholder="例如：你是一位專機的餐廳客服，請以親切、專業的態度回答顧客問題..."
                helperText="自訂您店家 AI 回覆的語氣和風格"
              />
            </Grid>
          </Grid>

          {/* 歡迎訊息設定 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            歡迎訊息設定
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="加入好友歡迎訊息"
                name="welcome_message"
                value={formData.welcome_message}
                onChange={handleChange}
                placeholder="歡迎加入我們！👋\n\n感謝您成為我們的好友！我們提供美味餐點和優質服務。\n有任何問題隨時詢問我！"
                helperText="用戶加入好友時自動發送的歡迎訊息（留空則使用預設訊息）"
              />
            </Grid>
          </Grid>

          {/* 功能開關區塊 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            功能設定
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enable_ai_reply}
                    onChange={handleChange}
                    name="enable_ai_reply"
                  />
                }
                label="啟用 AI 智能回覆"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enable_conversation_history}
                    onChange={handleChange}
                    name="enable_conversation_history"
                  />
                }
                label="啟用對話歷史記錄"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={handleChange}
                    name="is_active"
                  />
                }
                label="啟用 LINE BOT"
              />
            </Grid>
          </Grid>

          {/* 個人化推播區塊 */}
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            📢 個人化推播
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Alert severity="info" sx={{ mb: 2 }}>
            根據顧客的消費偏好，精準推送符合其喜好的訊息。
          </Alert>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                篩選目標用戶
              </Typography>

              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.use_platform_recommendation_frequency}
                      onChange={handleChange}
                      name="use_platform_recommendation_frequency"
                    />
                  }
                  label="沿用平台推播頻率（建議）"
                />
                <Typography variant="body2" color="text.secondary">
                  開啟後將使用平台後台的推播最小間隔與每週上限。關閉後可自訂店家熱門推薦頻率。
                </Typography>
              </Box>

              {!formData.use_platform_recommendation_frequency && (
                <Grid container spacing={2} sx={{ mb: 1 }}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="店家熱門推薦最小間隔（分鐘）"
                      name="popular_recommendation_min_interval_minutes"
                      value={formData.popular_recommendation_min_interval_minutes}
                      onChange={handleChange}
                      inputProps={{ min: 1 }}
                      helperText="留空則使用平台設定"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="店家熱門推薦每週上限"
                      name="popular_recommendation_weekly_limit"
                      value={formData.popular_recommendation_weekly_limit}
                      onChange={handleChange}
                      inputProps={{ min: 0 }}
                      helperText="留空則使用平台設定；0 代表停用熱門推薦"
                    />
                  </Grid>
                </Grid>
              )}

              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.enable_popular_recommendation_push}
                        onChange={handleChange}
                        name="enable_popular_recommendation_push"
                      />
                    }
                    label="啟用店家熱門推薦推播"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.enable_new_product_recommendation_push}
                        onChange={handleChange}
                        name="enable_new_product_recommendation_push"
                      />
                    }
                    label="啟用新品相似推薦推播"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Autocomplete
                    multiple
                    options={availableTags}
                    value={selectedTags}
                    onChange={(event, newValue) => setSelectedTags(newValue)}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option}
                          {...getTagProps({ index })}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="食物標籤偏好"
                        placeholder="選擇標籤..."
                        helperText="篩選曾購買含這些標籤商品的顧客"
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="閒置天數"
                    value={daysInactive}
                    onChange={(e) => setDaysInactive(parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0 }}
                    helperText="超過此天數未下單（0=不限）"
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  符合條件的顧客：<strong>{targetCount}</strong> 人
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                推播內容
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="推播標題"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="例如：專屬優惠來囉！"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="訊息內容"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="親愛的顧客您好！我們為您準備了專屬優惠..."
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleSendBroadcast}
                  disabled={sendingBroadcast || targetCount === 0}
                  sx={{ minWidth: 150 }}
                >
                  {sendingBroadcast ? <CircularProgress size={24} /> : `發送推播 (${targetCount} 人)`}
                </Button>
              </Box>

              {broadcastResult && (
                <Alert
                  severity={broadcastResult.success ? 'success' : 'error'}
                  sx={{ mt: 2 }}
                  onClose={() => setBroadcastResult(null)}
                >
                  {broadcastResult.message}
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* 儲存按鈕 */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={saving}
              fullWidth
            >
              {saving ? <CircularProgress size={24} /> : config ? '更新設定' : '建立設定'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default LineBotSettings;
