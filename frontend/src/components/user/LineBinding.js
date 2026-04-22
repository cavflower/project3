import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import { FaLine } from 'react-icons/fa';
import { bindLine, getLineAuthUrl, getLineBindingStatus, unbindLine, updateLinePreferences } from '../../api/lineLoginApi';

const LineBinding = ({ compact = false }) => {
  const [loading, setLoading] = useState(true);
  const [binding, setBinding] = useState(null);
  const [error, setError] = useState(null);
  const [unbindDialogOpen, setUnbindDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preferenceUpdating, setPreferenceUpdating] = useState('');

  useEffect(() => {
    loadBindingStatus();
    handleCallbackIfNeeded();
  }, []);

  const loadBindingStatus = async () => {
    try {
      setLoading(true);
      const status = await getLineBindingStatus();
      setBinding(status.is_bound ? status : null);
    } catch (err) {
      console.error('載入 LINE 綁定狀態失敗:', err);
      setBinding(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCallbackIfNeeded = async () => {
    const params = new URLSearchParams(window.location.search);
    const lineUserId = params.get('line_user_id');
    const displayName = params.get('display_name');
    const pictureUrl = params.get('picture_url');

    if (!lineUserId) return;

    try {
      setProcessing(true);
      await bindLine({
        line_user_id: lineUserId,
        display_name: displayName || '',
        picture_url: pictureUrl || '',
      });
      window.history.replaceState({}, '', window.location.pathname);
      await loadBindingStatus();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'LINE 綁定失敗。');
    } finally {
      setProcessing(false);
    }
  };

  const handleBindClick = async () => {
    try {
      setProcessing(true);
      setError(null);
      const redirectUri = `${window.location.origin}/line-callback`;
      const result = await getLineAuthUrl(redirectUri);
      if (result.auth_url) {
        window.location.href = result.auth_url;
      }
    } catch (err) {
      setError(err.response?.data?.detail || '取得 LINE 授權連結失敗。');
      setProcessing(false);
    }
  };

  const handleUnbindConfirm = async () => {
    try {
      setProcessing(true);
      await unbindLine();
      setBinding(null);
      setUnbindDialogOpen(false);
    } catch (err) {
      setError(err.response?.data?.detail || '解除 LINE 綁定失敗。');
    } finally {
      setProcessing(false);
    }
  };

  const handleTogglePreference = async (field, checked) => {
    if (!binding) return;

    const previous = binding[field];
    setPreferenceUpdating(field);
    setBinding((prev) => ({ ...prev, [field]: checked }));

    try {
      const updated = await updateLinePreferences({ [field]: checked });
      setBinding((prev) => ({
        ...prev,
        notify_personalized_recommendation: updated.notify_personalized_recommendation,
        notify_transactional_notifications: updated.notify_transactional_notifications,
      }));
      setError(null);
    } catch (err) {
      setBinding((prev) => ({ ...prev, [field]: previous }));
      setError(err.response?.data?.detail || '更新通知偏好失敗。');
    } finally {
      setPreferenceUpdating('');
    }
  };

  const Wrapper = ({ children }) => {
    if (compact) return <>{children}</>;
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>{children}</CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Wrapper>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: compact ? 1 : 3 }}>
          <CircularProgress size={compact ? 20 : 36} />
        </Box>
      </Wrapper>
    );
  }

  return (
    <>
      <Wrapper>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: compact ? 1 : 2 }}>
          <FaLine style={{ fontSize: compact ? '1.2rem' : '1.8rem', color: '#00B900' }} />
          <Typography variant={compact ? 'subtitle1' : 'h6'} fontWeight="bold">
            LINE 帳號綁定
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 1.2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {binding ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Avatar src={binding.picture_url} alt={binding.display_name} sx={{ width: compact ? 34 : 50, height: compact ? 34 : 50 }} />
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  {binding.display_name || 'LINE 使用者'}
                </Typography>
                <Chip label="已綁定" color="success" size="small" sx={{ mt: 0.5 }} />
              </Box>
            </Box>

            {!compact && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.2 }}>
                綁定時間：{new Date(binding.bound_at).toLocaleString('zh-TW')}
              </Typography>
            )}

            <Button variant="outlined" color="error" size={compact ? 'small' : 'medium'} onClick={() => setUnbindDialogOpen(true)} disabled={processing}>
              解除綁定
            </Button>

            <Box sx={{ mt: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                LINE 通知偏好
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    color="success"
                    checked={binding.notify_personalized_recommendation !== false}
                    disabled={preferenceUpdating === 'notify_personalized_recommendation' || processing}
                    onChange={(e) => handleTogglePreference('notify_personalized_recommendation', e.target.checked)}
                  />
                }
                label="個人化推薦"
              />
              <FormControlLabel
                control={
                  <Switch
                    color="success"
                    checked={binding.notify_transactional_notifications !== false}
                    disabled={preferenceUpdating === 'notify_transactional_notifications' || processing}
                    onChange={(e) => handleTogglePreference('notify_transactional_notifications', e.target.checked)}
                  />
                }
                label="交易通知"
              />
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.1 }}>
              綁定後可透過 LINE 接收通知並查詢訂單。
            </Typography>
            {compact && (
              <Box component="ul" sx={{ m: 0, mb: 1.1, pl: 2.2, color: '#475569' }}>
                <li><Typography variant="caption">接收店家通知</Typography></li>
                <li><Typography variant="caption">查詢訂單進度</Typography></li>
              </Box>
            )}
            <Button
              variant="contained"
              size={compact ? 'small' : 'medium'}
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
      </Wrapper>

      <Dialog open={unbindDialogOpen} onClose={() => setUnbindDialogOpen(false)}>
        <DialogTitle>確認解除 LINE 綁定</DialogTitle>
        <DialogContent>
          <Typography>解除後將無法透過 LINE 收到通知與查詢訂單，是否確定解除？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnbindDialogOpen(false)}>取消</Button>
          <Button onClick={handleUnbindConfirm} color="error" disabled={processing}>
            {processing ? '處理中...' : '確認解除'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LineBinding;