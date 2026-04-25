import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../store/AuthContext';
import { getMyStore } from '../../../api/storeApi';
import {
  createMerchantMembershipLevel,
  getMerchantMembershipLevels,
} from '../../../api/loyaltyApi';
import {
  createBroadcastMessage,
  createLineBotConfig,
  getLineBotConfig,
  getMembershipBroadcastLevels,
  getMembershipBroadcastTargets,
  sendBroadcastMessage,
  updateLineBotConfig,
} from '../../../api/lineBotApi';

const initialFormData = {
  store: null,
  line_channel_access_token: '',
  line_channel_secret: '',
  custom_system_prompt: '',
  welcome_message: '',
  enable_ai_reply: true,
  enable_conversation_history: true,
  is_active: true,
  use_platform_recommendation_frequency: true,
  popular_recommendation_min_interval_minutes: '',
  popular_recommendation_weekly_limit: '',
  enable_popular_recommendation_push: true,
  enable_new_product_recommendation_push: true,
};

const LineBotSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState(initialFormData);

  const [membershipLevels, setMembershipLevels] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [targetCount, setTargetCount] = useState(0);
  const [targetUsers, setTargetUsers] = useState([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [createCoupon, setCreateCoupon] = useState(false);
  const [couponTitle, setCouponTitle] = useState('');
  const [couponDescription, setCouponDescription] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscountType, setCouponDiscountType] = useState('fixed');
  const [couponDiscountValue, setCouponDiscountValue] = useState('');
  const [couponMinOrderAmount, setCouponMinOrderAmount] = useState('');
  const [couponMaxDiscountAmount, setCouponMaxDiscountAmount] = useState('');
  const [couponExpiresAt, setCouponExpiresAt] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  const storeId = store?.id ?? null;
  const loyaltyEnabled = Boolean(store?.enable_loyalty);
  const selectedLevelIds = useMemo(
    () => selectedLevels.map((level) => level.id),
    [selectedLevels]
  );

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoading(true);
        if (!user) {
          setError('請先登入商家帳號。');
          setLoading(false);
          return;
        }

        const response = await getMyStore();
        const storeData = response?.data;
        if (!storeData?.id) {
          setError('找不到商家店鋪資料。');
          setLoading(false);
          return;
        }

        setStore(storeData);
        setFormData((prev) => ({ ...prev, store: storeData.id }));
      } catch (err) {
        console.error('載入店鋪資料失敗:', err);
        setError('載入店鋪資料失敗，請稍後再試。');
        setLoading(false);
      }
    };

    fetchStore();
  }, [user]);

  useEffect(() => {
    if (!storeId) {
      return;
    }

    const loadConfig = async () => {
      try {
        setLoading(true);
        const data = await getLineBotConfig(storeId);
        if (!data) {
          setConfig(null);
          setFormData((prev) => ({
            ...initialFormData,
            store: prev.store,
          }));
          return;
        }

        setConfig(data);
        setFormData({
          store: data.store ?? storeId,
          line_channel_access_token: '',
          line_channel_secret: '',
          custom_system_prompt: data.custom_system_prompt || '',
          welcome_message: data.welcome_message || '',
          enable_ai_reply: data.enable_ai_reply !== false,
          enable_conversation_history: data.enable_conversation_history !== false,
          is_active: data.is_active !== false,
          use_platform_recommendation_frequency: data.use_platform_recommendation_frequency !== false,
          popular_recommendation_min_interval_minutes: data.popular_recommendation_min_interval_minutes ?? '',
          popular_recommendation_weekly_limit: data.popular_recommendation_weekly_limit ?? '',
          enable_popular_recommendation_push: data.enable_popular_recommendation_push !== false,
          enable_new_product_recommendation_push: data.enable_new_product_recommendation_push !== false,
        });
      } catch (err) {
        console.error('載入 LINE BOT 設定失敗:', err);
        setError('載入 LINE BOT 設定失敗。');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !loyaltyEnabled) {
      setMembershipLevels([]);
      setSelectedLevels([]);
      return;
    }

    const loadLevels = async () => {
      try {
        let data = await getMembershipBroadcastLevels();
        let levels = data.levels || [];

        if (levels.length === 0) {
          const merchantLevelsResponse = await getMerchantMembershipLevels();
          const merchantLevels = merchantLevelsResponse?.data ?? merchantLevelsResponse ?? [];

          if (merchantLevels.length > 0) {
            levels = merchantLevels;
          } else {
            const savedLevels = JSON.parse(localStorage.getItem('membershipLevels') || '[]');
            if (savedLevels.length > 0) {
              const sortedSavedLevels = [...savedLevels].sort(
                (a, b) => Number(a.threshold_points || 0) - Number(b.threshold_points || 0)
              );

              for (const [index, level] of sortedSavedLevels.entries()) {
                await createMerchantMembershipLevel({
                  name: level.name,
                  threshold_points: Number(level.threshold_points || 0),
                  discount_percent: Number(level.discount_percent || 0),
                  benefits: level.benefits || '',
                  rank: index + 1,
                  active: true,
                });
              }

              data = await getMembershipBroadcastLevels();
              levels = data.levels || [];
              if (levels.length > 0) {
                localStorage.removeItem('membershipLevels');
              }
            }
          }
        }

        setMembershipLevels(levels);
      } catch (err) {
        console.error('載入會員等級失敗:', err);
      }
    };

    loadLevels();
  }, [storeId, loyaltyEnabled]);

  useEffect(() => {
    if (!storeId || !loyaltyEnabled) {
      setTargetCount(0);
      setTargetUsers([]);
      return;
    }

    const loadTargets = async () => {
      try {
        const data = await getMembershipBroadcastTargets(selectedLevelIds);
        setTargetCount(data.target_count || 0);
        setTargetUsers(data.target_users || []);
      } catch (err) {
        console.error('載入會員優惠目標失敗:', err);
        setTargetCount(0);
        setTargetUsers([]);
      }
    };

    loadTargets();
  }, [storeId, loyaltyEnabled, selectedLevelIds]);

  const handleChange = (event) => {
    const { name, value, checked, type } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const submitData = {
        store: storeId,
        custom_system_prompt: formData.custom_system_prompt,
        welcome_message: formData.welcome_message,
        enable_ai_reply: formData.enable_ai_reply,
        enable_conversation_history: formData.enable_conversation_history,
        is_active: formData.is_active,
        use_platform_recommendation_frequency: formData.use_platform_recommendation_frequency,
        popular_recommendation_min_interval_minutes:
          formData.popular_recommendation_min_interval_minutes === ''
            ? null
            : Number(formData.popular_recommendation_min_interval_minutes),
        popular_recommendation_weekly_limit:
          formData.popular_recommendation_weekly_limit === ''
            ? null
            : Number(formData.popular_recommendation_weekly_limit),
        enable_popular_recommendation_push: formData.enable_popular_recommendation_push,
        enable_new_product_recommendation_push: formData.enable_new_product_recommendation_push,
      };

      if (formData.line_channel_access_token.trim()) {
        submitData.line_channel_access_token = formData.line_channel_access_token.trim();
      }
      if (formData.line_channel_secret.trim()) {
        submitData.line_channel_secret = formData.line_channel_secret.trim();
      }

      if (config?.id) {
        await updateLineBotConfig(config.id, submitData);
        setSuccess('LINE BOT 設定已更新。');
      } else {
        const createdConfig = await createLineBotConfig(submitData);
        setConfig(createdConfig);
        setSuccess('LINE BOT 設定已建立。');
      }

      const refreshedConfig = await getLineBotConfig(storeId);
      if (refreshedConfig) {
        setConfig(refreshedConfig);
      }
      setFormData((prev) => ({
        ...prev,
        line_channel_access_token: '',
        line_channel_secret: '',
      }));
    } catch (err) {
      console.error('儲存 LINE BOT 設定失敗:', err);
      setError(err.response?.data?.detail || '儲存 LINE BOT 設定失敗。');
    } finally {
      setSaving(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      setBroadcastResult({
        success: false,
        message: '請先填寫優惠標題與訊息內容。',
      });
      return;
    }

    if (targetUsers.length === 0) {
      setBroadcastResult({
        success: false,
        message: '目前沒有可發送會員優惠的 LINE 會員。',
      });
      return;
    }

    if (createCoupon && (!couponDiscountValue || !couponExpiresAt)) {
      setBroadcastResult({
        success: false,
        message: '附優惠券時，請填寫折抵數值與到期時間。',
      });
      return;
    }

    setSendingBroadcast(true);
    setBroadcastResult(null);
    setError(null);

    try {
      const created = await createBroadcastMessage({
        broadcast_type: 'loyalty',
        title: broadcastTitle.trim(),
        message_content: broadcastMessage.trim(),
        target_users: targetUsers,
        create_coupon: createCoupon,
        coupon_title: couponTitle.trim(),
        coupon_description: couponDescription.trim(),
        coupon_code: couponCode.trim(),
        coupon_discount_type: couponDiscountType,
        coupon_discount_value: createCoupon ? Number(couponDiscountValue) : undefined,
        coupon_min_order_amount: createCoupon ? Number(couponMinOrderAmount || 0) : undefined,
        coupon_max_discount_amount:
          createCoupon && couponMaxDiscountAmount !== ''
            ? Number(couponMaxDiscountAmount)
            : null,
        coupon_expires_at: createCoupon ? new Date(couponExpiresAt).toISOString() : undefined,
      });

      const result = await sendBroadcastMessage(created.id);
      setBroadcastResult({
        success: true,
        message: `會員優惠已送出，成功 ${result.success_count} 人，失敗 ${result.failure_count} 人。`,
      });
      setBroadcastTitle('');
      setBroadcastMessage('');
      setCreateCoupon(false);
      setCouponTitle('');
      setCouponDescription('');
      setCouponCode('');
      setCouponDiscountType('fixed');
      setCouponDiscountValue('');
      setCouponMinOrderAmount('');
      setCouponMaxDiscountAmount('');
      setCouponExpiresAt('');
    } catch (err) {
      console.error('發送會員優惠失敗:', err);
      setBroadcastResult({
        success: false,
        message:
          err.response?.data?.error ||
          err.response?.data?.coupon_discount_value?.[0] ||
          err.response?.data?.coupon_expires_at?.[0] ||
          '發送會員優惠失敗。',
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              LINE BOT 與會員優惠
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              管理店家 LINE 回覆設定，並向會員發送優惠訊息。
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => navigate('/merchant/line-bot/faq')}>
            FAQ 管理
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="h6" gutterBottom>
            LINE Messaging API
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Alert severity="info" sx={{ mb: 2 }}>
            若要讓店家 LINE BOT 正常收發訊息，請填入店家的 Messaging API Channel 資訊。
          </Alert>

          {config?.invitation_url && (
            <Alert severity="success" sx={{ mb: 2 }}>
              官方帳號邀請連結：
              <br />
              <a href={config.invitation_url} target="_blank" rel="noopener noreferrer">
                {config.invitation_url}
              </a>
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="password"
                label="Channel Access Token"
                name="line_channel_access_token"
                value={formData.line_channel_access_token}
                onChange={handleChange}
                placeholder={config ? '留空表示不變更' : '請輸入 Token'}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="password"
                label="Channel Secret"
                name="line_channel_secret"
                value={formData.line_channel_secret}
                onChange={handleChange}
                placeholder={config ? '留空表示不變更' : '請輸入 Secret'}
              />
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            回覆內容
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="自訂系統提示詞"
                name="custom_system_prompt"
                value={formData.custom_system_prompt}
                onChange={handleChange}
                placeholder="可補充店家風格、回覆限制或服務口吻。"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="歡迎訊息"
                name="welcome_message"
                value={formData.welcome_message}
                onChange={handleChange}
                placeholder="用戶加入或首次互動時顯示的訊息。"
              />
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            功能開關
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={1}>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={formData.enable_ai_reply} onChange={handleChange} name="enable_ai_reply" />}
                label="啟用 AI 自動回覆"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={formData.enable_conversation_history} onChange={handleChange} name="enable_conversation_history" />}
                label="啟用對話歷史"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={formData.is_active} onChange={handleChange} name="is_active" />}
                label="啟用 LINE BOT"
              />
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            推薦推播
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Alert severity="info" sx={{ mb: 2 }}>
            可設定店家 LINE 的熱門推薦與新品推薦是否啟用，以及熱門推薦推播的頻率限制。
          </Alert>

          <Grid container spacing={1}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enable_popular_recommendation_push}
                    onChange={handleChange}
                    name="enable_popular_recommendation_push"
                  />
                }
                label="啟用熱門推薦推播"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enable_new_product_recommendation_push}
                    onChange={handleChange}
                    name="enable_new_product_recommendation_push"
                  />
                }
                label="啟用新品推薦推播"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.use_platform_recommendation_frequency}
                    onChange={handleChange}
                    name="use_platform_recommendation_frequency"
                  />
                }
                label="沿用平台推播頻率"
              />
            </Grid>

            {!formData.use_platform_recommendation_frequency && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="熱門推薦最小間隔（分鐘）"
                    name="popular_recommendation_min_interval_minutes"
                    value={formData.popular_recommendation_min_interval_minutes}
                    onChange={handleChange}
                    inputProps={{ min: 1 }}
                    placeholder="例如 1440"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="熱門推薦每週上限"
                    name="popular_recommendation_weekly_limit"
                    value={formData.popular_recommendation_weekly_limit}
                    onChange={handleChange}
                    inputProps={{ min: 0 }}
                    placeholder="例如 2"
                  />
                </Grid>
              </>
            )}
          </Grid>

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} /> : '儲存 LINE BOT 設定'}
            </Button>
          </Box>
        </Box>

        <Typography variant="h6" gutterBottom sx={{ mt: 6 }}>
          會員優惠發送
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {!loyaltyEnabled ? (
          <Alert severity="warning">
            目前店家尚未啟用會員制度，因此無法發送會員優惠。
          </Alert>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              可依會員等級篩選推播對象；若未選擇等級，會發送給所有已綁定 LINE 的店家會員。
            </Alert>

            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Autocomplete
                      multiple
                      options={membershipLevels}
                      value={selectedLevels}
                      onChange={(event, newValue) => setSelectedLevels(newValue)}
                      getOptionLabel={(option) => option.name}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      noOptionsText="尚未設定會員等級"
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={`${option.name} (${option.threshold_points} 點)`}
                            {...getTagProps({ index })}
                            key={option.id}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="目標會員等級"
                          placeholder="未選擇時為全部會員"
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', height: '100%' }}>
                      <Typography variant="body2" color="text.secondary">
                        符合條件的 LINE 會員
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
                        {targetCount} 人
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="優惠標題"
                      value={broadcastTitle}
                      onChange={(event) => setBroadcastTitle(event.target.value)}
                      placeholder="例如：本週會員限定 85 折"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      label="優惠內容"
                      value={broadcastMessage}
                      onChange={(event) => setBroadcastMessage(event.target.value)}
                      placeholder="請輸入要發送給會員的優惠內容。"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={createCoupon}
                          onChange={(event) => setCreateCoupon(event.target.checked)}
                        />
                      }
                      label="附優惠券給會員領取"
                    />
                  </Grid>
                  {createCoupon && (
                    <>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="優惠券名稱"
                          value={couponTitle}
                          onChange={(event) => setCouponTitle(event.target.value)}
                          placeholder="未填時會沿用優惠標題"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="優惠券代碼"
                          value={couponCode}
                          onChange={(event) => setCouponCode(event.target.value)}
                          placeholder="可留空自動產生"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="優惠券說明"
                          value={couponDescription}
                          onChange={(event) => setCouponDescription(event.target.value)}
                          placeholder="可補充使用限制或活動說明"
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          select
                          label="折抵方式"
                          value={couponDiscountType}
                          onChange={(event) => setCouponDiscountType(event.target.value)}
                        >
                          <MenuItem value="fixed">固定金額</MenuItem>
                          <MenuItem value="percent">百分比</MenuItem>
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          type="number"
                          label="折抵數值"
                          value={couponDiscountValue}
                          onChange={(event) => setCouponDiscountValue(event.target.value)}
                          inputProps={{ min: 0, step: '0.01' }}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          type="datetime-local"
                          label="到期時間"
                          value={couponExpiresAt}
                          onChange={(event) => setCouponExpiresAt(event.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="最低消費"
                          value={couponMinOrderAmount}
                          onChange={(event) => setCouponMinOrderAmount(event.target.value)}
                          inputProps={{ min: 0, step: '0.01' }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="最高折抵"
                          value={couponMaxDiscountAmount}
                          onChange={(event) => setCouponMaxDiscountAmount(event.target.value)}
                          inputProps={{ min: 0, step: '0.01' }}
                          placeholder="固定金額可留空"
                        />
                      </Grid>
                    </>
                  )}
                </Grid>

                <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    disabled={sendingBroadcast || targetCount === 0}
                    onClick={handleSendBroadcast}
                  >
                    {sendingBroadcast ? <CircularProgress size={22} /> : `發送會員優惠 (${targetCount} 人)`}
                  </Button>
                </Box>

                {broadcastResult && (
                  <Alert severity={broadcastResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                    {broadcastResult.message}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default LineBotSettings;
