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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../store/AuthContext';
import { getMyStore } from '../../../api/storeApi';
import {
  getLineBotConfig,
  createLineBotConfig,
  updateLineBotConfig,
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
  });

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
        setFormData({
          ...formData,
          ...data,
          // 不顯示敏感資料，但保留欄位
          line_channel_access_token: '',
          line_channel_secret: '',
          ai_api_key: '',
        });
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
      const submitData = { ...formData };
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
