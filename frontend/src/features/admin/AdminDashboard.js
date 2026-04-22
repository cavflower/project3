import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getAISettings, updateAISettings, getLineSettings, updateLineSettings, getAvailableStores, getTargetPreview, createPlatformBroadcast, sendPlatformBroadcast, quickFallbackRecommendationPush, runAutoRecommendationPush } from '../../api/adminApi';
import { getStoreBusinessStatus } from '../../utils/storeBusinessStatus';
import styles from './AdminDashboard.module.css';

const AdminDashboard = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' 或 'desc'
  const navigate = useNavigate();

  // AI 設定狀態
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiSettings, setAISettings] = useState(null);
  const [aiForm, setAIForm] = useState({
    ai_provider: 'gemini',
    ai_api_key: '',
    ai_model: 'gemini-2.5-flash',
    ai_temperature: 0.7,
    ai_max_tokens: 500,
    is_ai_enabled: true,
    default_system_prompt: '',
  });
  const [aiSaving, setAISaving] = useState(false);

  // LINE 設定狀態
  const [showLineModal, setShowLineModal] = useState(false);
  const [lineSettings, setLineSettings] = useState(null);
  const [lineForm, setLineForm] = useState({
    line_login_channel_id: '',
    line_login_channel_secret: '',
    line_bot_channel_access_token: '',
    line_bot_channel_secret: '',
    is_line_bot_enabled: false,
    is_personalized_recommendation_enabled: true,
    line_bot_welcome_message: '',
    personalized_recommendation_min_interval_minutes: 4320,
    personalized_recommendation_weekly_limit: 2,
  });
  const [lineSaving, setLineSaving] = useState(false);
  const [linePushRunning, setLinePushRunning] = useState(false);

  // 店家 LINE BOT 設定狀態
  const [showStoreLineModal, setShowStoreLineModal] = useState(false);
  const [selectedStoreForLine, setSelectedStoreForLine] = useState(null);
  const [storeLineForm, setStoreLineForm] = useState({
    line_channel_access_token: '',
    line_channel_secret: '',
    invitation_url: '',
  });
  const [storeLineSaving, setStoreLineSaving] = useState(false);

  // 平台推播狀態
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [availableStoresForBroadcast, setAvailableStoresForBroadcast] = useState([]);
  const [targetUserCount, setTargetUserCount] = useState(0);
  const [broadcastForm, setBroadcastForm] = useState({
    broadcast_type: 'store_recommendation',
    title: '',
    message_content: '',
    recommended_store_ids: [],
  });
  const [broadcastSending, setBroadcastSending] = useState(false);

  useEffect(() => {
    // 檢查是否已登入
    const isLoggedIn = localStorage.getItem('admin_logged_in');
    if (!isLoggedIn) {
      navigate('/login/admin');
      return;
    }

    // 載入商家資料
    loadStores();
    // 載入 AI 設定
    loadAISettings();
    // 載入 LINE 設定
    loadLineSettings();

    // 清理函數：確保離開頁面時恢復滾動
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [navigate]);

  const loadStores = async () => {
    try {
      setLoading(true);
      // 使用 axios 直接調用，不通過 api.js 的 interceptor
      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';
      const response = await axios.get(`${baseURL}/stores/all/`);
      setStores(response.data || []);
    } catch (err) {
      console.error('載入商家資料失敗:', err);
      setError('載入商家資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const loadAISettings = async () => {
    try {
      const data = await getAISettings();
      setAISettings(data);
      setAIForm({
        ai_provider: data.ai_provider || 'gemini',
        ai_api_key: '',
        ai_model: data.ai_model || 'gemini-2.5-flash',
        ai_temperature: data.ai_temperature || 0.7,
        ai_max_tokens: data.ai_max_tokens || 500,
        is_ai_enabled: data.is_ai_enabled !== false,
        default_system_prompt: data.default_system_prompt || '',
      });
    } catch (err) {
      console.error('載入 AI 設定失敗:', err);
    }
  };

  const handleOpenAIModal = () => {
    setShowAIModal(true);
  };

  const handleCloseAIModal = () => {
    setShowAIModal(false);
  };

  const handleSubmitAI = async (e) => {
    e.preventDefault();
    try {
      setAISaving(true);
      const submitData = { ...aiForm };
      if (!submitData.ai_api_key) {
        delete submitData.ai_api_key;
      }
      await updateAISettings(submitData);
      alert('AI 設定已更新！');
      handleCloseAIModal();
      loadAISettings();
    } catch (err) {
      console.error('設定 AI 失敗:', err);
      alert('設定 AI 失敗，請稍後再試');
    } finally {
      setAISaving(false);
    }
  };

  const loadLineSettings = async () => {
    try {
      const data = await getLineSettings();
      setLineSettings(data);
      setLineForm({
        line_login_channel_id: data.line_login_channel_id || '',
        line_login_channel_secret: '',
        line_bot_channel_access_token: '',
        line_bot_channel_secret: '',
        is_line_bot_enabled: data.is_line_bot_enabled || false,
        is_personalized_recommendation_enabled: data.is_personalized_recommendation_enabled !== false,
        line_bot_welcome_message: data.line_bot_welcome_message || '',
        personalized_recommendation_min_interval_minutes: data.personalized_recommendation_min_interval_minutes ?? 4320,
        personalized_recommendation_weekly_limit: data.personalized_recommendation_weekly_limit ?? 2,
      });
    } catch (err) {
      console.error('載入 LINE 設定失敗:', err);
    }
  };

  const handleOpenLineModal = () => {
    setShowLineModal(true);
  };

  const handleCloseLineModal = () => {
    setShowLineModal(false);
  };

  const handleSubmitLine = async (e) => {
    e.preventDefault();
    try {
      setLineSaving(true);
      const submitData = { ...lineForm };
      // 如果沒有填密碼，不傳送
      if (!submitData.line_login_channel_secret) delete submitData.line_login_channel_secret;
      if (!submitData.line_bot_channel_access_token) delete submitData.line_bot_channel_access_token;
      if (!submitData.line_bot_channel_secret) delete submitData.line_bot_channel_secret;

      await updateLineSettings(submitData);
      alert('LINE 設定已更新！');
      handleCloseLineModal();
      loadLineSettings();
    } catch (err) {
      console.error('設定 LINE 失敗:', err);
      alert('設定 LINE 失敗，請稍後再試');
    } finally {
      setLineSaving(false);
    }
  };

  const handleQuickFallbackPush = async () => {
    try {
      setLinePushRunning(true);
      const result = await quickFallbackRecommendationPush({
        intro_message: '以下是本週熱門店家推薦，AI 功能異常時可先使用此備案。',
      });
      alert(`快速備案完成！成功: ${result.success_count}, 失敗: ${result.failure_count}, 略過: ${result.skipped_count}`);
    } catch (err) {
      console.error('快速備案推播失敗:', err);
      alert('快速備案推播失敗：' + (err.response?.data?.detail || err.message));
    } finally {
      setLinePushRunning(false);
    }
  };

  const handleRunFullAutoPush = async () => {
    try {
      setLinePushRunning(true);
      const result = await runAutoRecommendationPush({ force: false });
      alert(`完整版執行完成！成功: ${result.success_count}, 失敗: ${result.failure_count}, 略過: ${result.skipped_count}`);
    } catch (err) {
      console.error('完整版推播執行失敗:', err);
      alert('完整版推播執行失敗：' + (err.response?.data?.detail || err.message));
    } finally {
      setLinePushRunning(false);
    }
  };

  // 店家 LINE BOT 設定
  const handleOpenStoreLineModal = async (store) => {
    setSelectedStoreForLine(store);
    setShowStoreLineModal(true);
    // 載入現有設定
    try {
      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';
      const response = await axios.get(`${baseURL}/line-bot/admin/store/${store.id}/config/`, {
        headers: { 'X-Admin-Auth': 'true' }
      });
      setStoreLineForm({
        line_channel_access_token: '',
        line_channel_secret: '',
        invitation_url: response.data.invitation_url || '',
      });
    } catch (err) {
      // 如果還沒有設定，使用預設值
      setStoreLineForm({
        line_channel_access_token: '',
        line_channel_secret: '',
        invitation_url: '',
      });
    }
  };

  const handleCloseStoreLineModal = () => {
    setShowStoreLineModal(false);
    setSelectedStoreForLine(null);
  };

  const handleSubmitStoreLine = async (e) => {
    e.preventDefault();
    if (!selectedStoreForLine) return;

    try {
      setStoreLineSaving(true);
      const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';
      const submitData = { ...storeLineForm };
      // 如果沒有填密碼，不傳送
      if (!submitData.line_channel_access_token) delete submitData.line_channel_access_token;
      if (!submitData.line_channel_secret) delete submitData.line_channel_secret;

      await axios.post(`${baseURL}/line-bot/admin/store/${selectedStoreForLine.id}/config/`, submitData, {
        headers: { 'X-Admin-Auth': 'true' }
      });
      alert('LINE BOT 設定已更新！');
      handleCloseStoreLineModal();
      loadStores();
    } catch (err) {
      console.error('設定 LINE BOT 失敗:', err);
      alert('設定 LINE BOT 失敗，請稍後再試');
    } finally {
      setStoreLineSaving(false);
    }
  };

  // 平台推播功能
  const handleOpenBroadcastModal = async () => {
    setShowBroadcastModal(true);
    try {
      // 載入可用店家
      const storeData = await getAvailableStores();
      setAvailableStoresForBroadcast(storeData.stores || []);
      // 載入目標用戶數
      const targetData = await getTargetPreview();
      setTargetUserCount(targetData.total_users || 0);
    } catch (err) {
      console.error('載入推播資料失敗:', err);
    }
  };

  const handleCloseBroadcastModal = () => {
    setShowBroadcastModal(false);
    setBroadcastForm({
      broadcast_type: 'store_recommendation',
      title: '',
      message_content: '',
      recommended_store_ids: [],
    });
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.title || !broadcastForm.message_content) {
      alert('請填寫標題和內容');
      return;
    }
    try {
      setBroadcastSending(true);
      const created = await createPlatformBroadcast(broadcastForm);
      const result = await sendPlatformBroadcast(created.id);
      alert(`推播發送成功！成功: ${result.success_count}, 失敗: ${result.failure_count}`);
      handleCloseBroadcastModal();
    } catch (err) {
      console.error('發送推播失敗:', err);
      alert('發送推播失敗：' + (err.response?.data?.error || err.message));
    } finally {
      setBroadcastSending(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    navigate('/login/admin');
  };

  const getPlanName = (plan) => {
    const planNames = {
      'basic': '基本方案',
      'premium': '進階方案',
      'enterprise': '企業方案'
    };
    return planNames[plan] || '未設定';
  };

  const getCuisineType = (type) => {
    const types = {
      'japanese': '日式',
      'korean': '韓式',
      'american': '美式',
      'taiwanese': '台式',
      'western': '西式',
      'beverages': '飲料',
      'desserts': '甜點',
      'other': '其他'
    };
    return types[type] || type || '未分類';
  };

  const formatCurrency = (value) => {
    const amount = Number(value || 0);
    return `NT$ ${amount.toLocaleString('zh-TW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const storesWithBusinessStatus = stores.map((store) => ({
    ...store,
    businessStatus: getStoreBusinessStatus(store),
  }));

  const sortedStores = [...storesWithBusinessStatus].sort((a, b) => {
    return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
  });

  if (loading) {
    return (
      <div className={styles.adminDashboard}>
        <div className={styles.loadingContainer}>
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-3">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminDashboard}>
      <div className={styles.adminHeader}>
        <div className="container">
          <div className={styles.headerContent}>
            <div>
              <h1>平台管理員儀表板</h1>
              <p className={styles.textMuted}>DineVerse 後台管理系統</p>
            </div>
            <button className={styles.btnLogout} onClick={handleLogout}>
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="container py-4">
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <h3>{stores.length}</h3>
            <p>總商家數</p>
          </div>
          <div className={styles.statCard}>
            <h3>{storesWithBusinessStatus.filter((store) => store.businessStatus.isOpenNow).length}</h3>
            <p>營業中</p>
          </div>
          <div className={styles.statCard}>
            <h3>{stores.filter(s => s.enable_reservation).length}</h3>
            <p>啟用訂位</p>
          </div>
          <div className={styles.statCard}>
            <h3>{stores.filter(s => s.enable_surplus_food).length}</h3>
            <p>啟用惜福品</p>
          </div>
          <div className={styles.statCard} onClick={handleOpenAIModal} style={{ cursor: 'pointer' }}>
            <h3>{aiSettings?.has_ai_config ? '✅' : '❌'}</h3>
            <p>平台 AI {aiSettings?.has_ai_config ? '已啟用' : '未設定'}</p>
            <small style={{ color: '#666' }}>點擊設定</small>
          </div>
          <div className={styles.statCard} onClick={handleOpenLineModal} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #00B900, #00C300)' }}>
            <h3 style={{ color: 'white' }}>{lineSettings?.has_line_login_config ? '✅' : '❌'}</h3>
            <p style={{ color: 'white' }}>LINE Login {lineSettings?.has_line_login_config ? '已設定' : '未設定'}</p>
            <small style={{ color: 'rgba(255,255,255,0.8)' }}>點擊設定</small>
          </div>
          <div className={styles.statCard} onClick={handleOpenBroadcastModal} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)' }}>
            <h3 style={{ color: 'white' }}>📢</h3>
            <p style={{ color: 'white' }}>平台推播</p>
            <small style={{ color: 'rgba(255,255,255,0.8)' }}>推薦店家</small>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mt-3">
            {error}
          </div>
        )}

        <div className={styles.storesSection}>
          <h2 className="mb-4">商家列表</h2>
          <div className={styles.tableResponsive}>
            <table className={styles.storesTable}>
              <thead>
                <tr>
                  <th>
                    店家 ID
                    <button
                      className={styles.sortBtn}
                      onClick={toggleSortOrder}
                      title={sortOrder === 'asc' ? '切換為大到小' : '切換為小到大'}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </th>
                  <th>店家名稱</th>
                  <th>類別</th>
                  <th>電話</th>
                  <th>地址</th>
                  <th>方案</th>
                  <th>營業狀態</th>
                  <th>功能啟用</th>
                  <th>捐款量 (60%)</th>
                  <th>店家包材費 (40%)</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedStores.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-5">
                      目前沒有商家資料
                    </td>
                  </tr>
                ) : (
                  sortedStores.map((store) => (
                    <tr key={store.id}>
                      <td>{store.id}</td>
                      <td className="font-weight-bold">{store.name}</td>
                      <td>{getCuisineType(store.cuisine_type)}</td>
                      <td>{store.phone}</td>
                      <td className={styles.addressCell}>{store.address}</td>
                      <td>
                        <span className={styles[`badge${(store.plan || 'none').charAt(0).toUpperCase() + (store.plan || 'none').slice(1)}`] || styles.badgeNone}>
                          {getPlanName(store.plan)}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${store.businessStatus.isOpenNow ? styles.statusOpen : styles.statusClosed}`}>
                          {store.businessStatus.statusText}
                        </span>
                      </td>
                      <td>
                        <div className={styles.featureTags}>
                          {store.enable_reservation && <span className={styles.featureTag}>訂位</span>}
                          {store.enable_loyalty && <span className={styles.featureTag}>會員</span>}
                          {store.enable_surplus_food && <span className={styles.featureTag}>惜福品</span>}
                        </div>
                      </td>
                      <td>
                        <span className={styles.donationBadge}>
                          {formatCurrency(store.surplus_donation_amount)}
                        </span>
                        <small className={styles.revenueMeta}>捐款金額 {formatCurrency(store.surplus_donation_amount)}</small>
                      </td>
                      <td>
                        <span className={styles.packagingBadge}>
                          {formatCurrency(store.surplus_packaging_fee_amount)}
                        </span>
                        <small className={styles.revenueMeta}>總收入 {formatCurrency(store.surplus_packaging_fee_amount)}</small>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className={styles.btnAction}
                            onClick={() => handleOpenStoreLineModal(store)}
                            title="設定 LINE BOT"
                            style={{ background: '#00B900', color: 'white' }}
                          >
                            LINE BOT
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI 設定 Modal */}
      {showAIModal && (
        <div className="modal-overlay">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>平台 AI 設定</h3>
              <button className={styles.modalClose} onClick={handleCloseAIModal}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.storeInfoBox}>
                <h4>🤖 AI 智能回覆服務</h4>
                <p className="text-muted">
                  設定後所有店家的 LINE BOT 將自動使用此 AI 服務
                </p>
              </div>
              <form onSubmit={handleSubmitAI}>
                <div className={styles.formGroup}>
                  <label htmlFor="ai_provider">AI 提供商</label>
                  <select
                    id="ai_provider"
                    className={styles.formControl}
                    value={aiForm.ai_provider}
                    onChange={(e) => setAIForm({ ...aiForm, ai_provider: e.target.value })}
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI GPT</option>
                    <option value="groq">Groq</option>
                  </select>
                </div>
                <div className="form-group mt-3">
                  <label htmlFor="ai_api_key">API Key</label>
                  <input
                    type="password"
                    id="ai_api_key"
                    className={styles.formControl}
                    value={aiForm.ai_api_key}
                    onChange={(e) => setAIForm({ ...aiForm, ai_api_key: e.target.value })}
                    placeholder={aiSettings?.ai_api_key_set ? '已設定（留空則不更改）' : '請輸入 API Key'}
                  />
                  <small className={styles.formText}>
                    {aiForm.ai_provider === 'gemini' && '從 Google AI Studio 取得'}
                    {aiForm.ai_provider === 'openai' && '從 OpenAI 取得'}
                    {aiForm.ai_provider === 'groq' && '從 Groq Console 取得'}
                  </small>
                </div>
                <div className="form-group mt-3">
                  <label htmlFor="ai_model">AI 模型</label>
                  <input
                    type="text"
                    id="ai_model"
                    className={styles.formControl}
                    value={aiForm.ai_model}
                    onChange={(e) => setAIForm({ ...aiForm, ai_model: e.target.value })}
                    placeholder="例如: gemini-2.5-flash"
                  />
                  <small className={styles.formText}>
                    {aiForm.ai_provider === 'gemini' && '例如: gemini-2.5-flash, gemini-2.5-pro'}
                    {aiForm.ai_provider === 'openai' && '例如: gpt-4o-mini, gpt-4o'}
                    {aiForm.ai_provider === 'groq' && '例如: llama-3.1-8b-instant, llama-3.3-70b-versatile'}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="ai_temperature">Temperature</label>
                    <input
                      type="number"
                      id="ai_temperature"
                      className={styles.formControl}
                      value={aiForm.ai_temperature}
                      onChange={(e) => setAIForm({ ...aiForm, ai_temperature: parseFloat(e.target.value) })}
                      min="0"
                      max="2"
                      step="0.1"
                    />
                    <small className={styles.formText}>0-2，數值越高回覆越有創意</small>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="ai_max_tokens">Max Tokens</label>
                    <input
                      type="number"
                      id="ai_max_tokens"
                      className={styles.formControl}
                      value={aiForm.ai_max_tokens}
                      onChange={(e) => setAIForm({ ...aiForm, ai_max_tokens: parseInt(e.target.value) })}
                      min="100"
                      max="4000"
                    />
                    <small className={styles.formText}>回覆的最大字數限制</small>
                  </div>
                </div>
                <div className="form-group mt-3">
                  <label>
                    <input
                      type="checkbox"
                      checked={aiForm.is_ai_enabled}
                      onChange={(e) => setAIForm({ ...aiForm, is_ai_enabled: e.target.checked })}
                    />{' '}
                    啟用 AI 服務
                  </label>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={styles.btnSecondary} onClick={handleCloseAIModal}>
                    取消
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={aiSaving}>
                    {aiSaving ? '儲存中...' : '儲存設定'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* LINE 設定 Modal */}
      {showLineModal && (
        <div className="modal-overlay" onClick={handleCloseLineModal}>
          <div className="modal-content ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #00B900, #00C300)' }}>
              <h2 style={{ color: 'white' }}>📱 LINE 平台設定</h2>
              <button className="close-btn" onClick={handleCloseLineModal}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <form onSubmit={handleSubmitLine}>
                {/* LINE Login 設定 */}
                <div style={{ marginBottom: '24px', padding: '16px', background: '#f0f9f0', borderRadius: '8px' }}>
                  <h3 style={{ marginBottom: '16px', color: '#00B900' }}>🔐 LINE Login（用戶綁定）</h3>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                    讓用戶透過 LINE 帳號登入並綁定，需在 LINE Developers Console 建立 LINE Login Channel。
                  </p>
                  <div className={styles.formGroup}>
                    <label htmlFor="line_login_channel_id">Channel ID</label>
                    <input
                      type="text"
                      id="line_login_channel_id"
                      className={styles.formControl}
                      value={lineForm.line_login_channel_id}
                      onChange={(e) => setLineForm({ ...lineForm, line_login_channel_id: e.target.value })}
                      placeholder="LINE Login Channel ID"
                    />
                  </div>
                  <div className="form-group mt-3">
                    <label htmlFor="line_login_channel_secret">Channel Secret</label>
                    <input
                      type="password"
                      id="line_login_channel_secret"
                      className={styles.formControl}
                      value={lineForm.line_login_channel_secret}
                      onChange={(e) => setLineForm({ ...lineForm, line_login_channel_secret: e.target.value })}
                      placeholder="留空表示不修改"
                    />
                    <small className={styles.formText}>
                      {lineSettings?.has_line_login_config ? '✅ 已設定，留空保持不變' : '尚未設定'}
                    </small>
                  </div>
                </div>

                {/* LINE Messaging API 設定 */}
                <div style={{ marginBottom: '24px', padding: '16px', background: '#f0f9f0', borderRadius: '8px' }}>
                  <h3 style={{ marginBottom: '16px', color: '#00B900' }}>🤖 LINE BOT（推播訊息）</h3>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                    平台 LINE BOT 可主動推送推薦和通知給用戶，需在 LINE Developers Console 建立 Messaging API Channel。
                  </p>
                  <div className={styles.formGroup}>
                    <label htmlFor="line_bot_channel_access_token">Channel Access Token</label>
                    <input
                      type="password"
                      id="line_bot_channel_access_token"
                      className={styles.formControl}
                      value={lineForm.line_bot_channel_access_token}
                      onChange={(e) => setLineForm({ ...lineForm, line_bot_channel_access_token: e.target.value })}
                      placeholder="留空表示不修改"
                    />
                  </div>
                  <div className="form-group mt-3">
                    <label htmlFor="line_bot_channel_secret">Channel Secret</label>
                    <input
                      type="password"
                      id="line_bot_channel_secret"
                      className={styles.formControl}
                      value={lineForm.line_bot_channel_secret}
                      onChange={(e) => setLineForm({ ...lineForm, line_bot_channel_secret: e.target.value })}
                      placeholder="留空表示不修改"
                    />
                    <small className={styles.formText}>
                      {lineSettings?.has_line_bot_config ? '✅ 已設定，留空保持不變' : '尚未設定'}
                    </small>
                  </div>
                  <div className="form-group mt-3">
                    <label htmlFor="line_bot_welcome_message">歡迎訊息</label>
                    <textarea
                      id="line_bot_welcome_message"
                      className={styles.formControl}
                      rows="2"
                      value={lineForm.line_bot_welcome_message}
                      onChange={(e) => setLineForm({ ...lineForm, line_bot_welcome_message: e.target.value })}
                      placeholder="用戶加入好友時自動發送的歡迎訊息"
                    />
                  </div>
                  <div className="form-group mt-3">
                    <label>
                      <input
                        type="checkbox"
                        checked={lineForm.is_line_bot_enabled}
                        onChange={(e) => setLineForm({ ...lineForm, is_line_bot_enabled: e.target.checked })}
                      />{' '}
                      啟用平台 LINE BOT
                    </label>
                  </div>

                  <div className="form-group mt-3">
                    <label>
                      <input
                        type="checkbox"
                        checked={lineForm.is_personalized_recommendation_enabled}
                        onChange={(e) => setLineForm({ ...lineForm, is_personalized_recommendation_enabled: e.target.checked })}
                      />{' '}
                      啟用個人化推薦（測試開關）
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label htmlFor="personalized_recommendation_min_interval_minutes">個人化推薦最小間隔（分鐘）</label>
                      <input
                        type="number"
                        id="personalized_recommendation_min_interval_minutes"
                        className={styles.formControl}
                        min="1"
                        value={lineForm.personalized_recommendation_min_interval_minutes}
                        onChange={(e) => setLineForm({
                          ...lineForm,
                          personalized_recommendation_min_interval_minutes: parseInt(e.target.value || '1', 10),
                        })}
                      />
                      <small className={styles.formText}>正式建議 4320（72 小時），開發測試可暫設 1</small>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label htmlFor="personalized_recommendation_weekly_limit">每週上限（每人）</label>
                      <input
                        type="number"
                        id="personalized_recommendation_weekly_limit"
                        className={styles.formControl}
                        min="0"
                        value={lineForm.personalized_recommendation_weekly_limit}
                        onChange={(e) => setLineForm({
                          ...lineForm,
                          personalized_recommendation_weekly_limit: parseInt(e.target.value || '0', 10),
                        })}
                      />
                      <small className={styles.formText}>正式建議 2；設 0 表示暫停個人化推薦</small>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px', background: '#fff8e1', borderRadius: '8px' }}>
                    <p style={{ marginBottom: '8px', fontWeight: 600 }}>推薦推播執行工具</p>
                    <p style={{ marginBottom: '10px', fontSize: '13px', color: '#666' }}>
                      快速版：AI 壞掉時僅發熱門店家。完整版：套用最小間隔與每週上限，發個人化+熱門推薦。
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={handleQuickFallbackPush}
                        disabled={linePushRunning}
                      >
                        {linePushRunning ? '執行中...' : '手動推播熱門店家'}
                      </button>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={handleRunFullAutoPush}
                        disabled={linePushRunning}
                        style={{ background: '#ff9800' }}
                      >
                        {linePushRunning ? '執行中...' : '執行完整推播'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.btnSecondary} onClick={handleCloseLineModal}>
                    取消
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={lineSaving} style={{ background: '#00B900' }}>
                    {lineSaving ? '儲存中...' : '儲存設定'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 店家 LINE BOT 設定 Modal */}
      {showStoreLineModal && selectedStoreForLine && (
        <div className="modal-overlay">
          <div className="modal-content ai-modal">
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #00B900, #00C300)' }}>
              <h2 style={{ color: 'white' }}>🤖 {selectedStoreForLine.name} - LINE BOT 設定</h2>
              <button className="close-btn" onClick={handleCloseStoreLineModal}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <form onSubmit={handleSubmitStoreLine}>
                <div style={{ marginBottom: '16px', padding: '12px', background: '#fff3cd', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    <strong>Webhook URL：</strong>
                    <code style={{ background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>
                      {`${process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api'}/line-bot/webhook/${selectedStoreForLine.id}/`}
                    </code>
                  </p>
                  <small style={{ color: '#666' }}>請在 LINE Developers Console 設定此 Webhook URL</small>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="store_line_channel_access_token">Channel Access Token</label>
                  <input
                    type="password"
                    id="store_line_channel_access_token"
                    className={styles.formControl}
                    value={storeLineForm.line_channel_access_token}
                    onChange={(e) => setStoreLineForm({ ...storeLineForm, line_channel_access_token: e.target.value })}
                    placeholder="留空表示不修改"
                  />
                </div>

                <div className="form-group mt-3">
                  <label htmlFor="store_line_channel_secret">Channel Secret</label>
                  <input
                    type="password"
                    id="store_line_channel_secret"
                    className={styles.formControl}
                    value={storeLineForm.line_channel_secret}
                    onChange={(e) => setStoreLineForm({ ...storeLineForm, line_channel_secret: e.target.value })}
                    placeholder="留空表示不修改"
                  />
                </div>

                <div className="form-group mt-3">
                  <label htmlFor="store_invitation_url">操作權限邀請網址</label>
                  <input
                    type="text"
                    id="store_invitation_url"
                    className={styles.formControl}
                    value={storeLineForm.invitation_url}
                    onChange={(e) => setStoreLineForm({ ...storeLineForm, invitation_url: e.target.value })}
                    placeholder="https://manager.line.biz/invitation/..."
                  />
                  <small style={{ color: '#666' }}>從 LINE Official Account Manager 取得的操作權限邀請網址</small>
                </div>

                <div style={{ marginTop: '16px', padding: '12px', background: '#e7f5ff', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: '#0066cc' }}>
                    💡 歡迎訊息和啟用設定由店家在「LINE BOT 設定」頁面自行管理
                  </p>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.btnSecondary} onClick={handleCloseStoreLineModal}>
                    取消
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={storeLineSaving} style={{ background: '#00B900' }}>
                    {storeLineSaving ? '儲存中...' : '儲存設定'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 平台推播 Modal */}
      {showBroadcastModal && (
        <div className="modal-overlay" onClick={handleCloseBroadcastModal}>
          <div className="modal-content ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)' }}>
              <h2 style={{ color: 'white' }}>📢 平台推播 - 店家推薦</h2>
              <button className="close-btn" onClick={handleCloseBroadcastModal}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px', padding: '12px', background: '#fff3cd', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  <strong>目標用戶：</strong>{targetUserCount} 位已綁定 LINE 的用戶
                </p>
              </div>

              <form onSubmit={handleSendBroadcast}>
                <div className={styles.formGroup}>
                  <label htmlFor="broadcast_type">推播類型</label>
                  <select
                    id="broadcast_type"
                    className={styles.formControl}
                    value={broadcastForm.broadcast_type}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, broadcast_type: e.target.value })}
                  >
                    <option value="store_recommendation">店家推薦</option>
                    <option value="new_store">新店上架</option>
                    <option value="platform_announcement">平台公告</option>
                  </select>
                </div>

                <div className="form-group mt-3">
                  <label htmlFor="broadcast_title">推播標題</label>
                  <input
                    type="text"
                    id="broadcast_title"
                    className={styles.formControl}
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                    placeholder="例如：本週推薦店家"
                    required
                  />
                </div>

                <div className="form-group mt-3">
                  <label htmlFor="broadcast_content">訊息內容</label>
                  <textarea
                    id="broadcast_content"
                    className={styles.formControl}
                    rows="3"
                    value={broadcastForm.message_content}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message_content: e.target.value })}
                    placeholder="請輸入推播訊息內容..."
                    required
                  />
                </div>

                <div className="form-group mt-3">
                  <label>選擇推薦店家</label>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '8px' }}>
                    {availableStoresForBroadcast.map((store) => (
                      <label key={store.id} style={{ display: 'block', marginBottom: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={broadcastForm.recommended_store_ids.includes(store.id)}
                          onChange={(e) => {
                            const ids = broadcastForm.recommended_store_ids;
                            if (e.target.checked) {
                              setBroadcastForm({ ...broadcastForm, recommended_store_ids: [...ids, store.id] });
                            } else {
                              setBroadcastForm({ ...broadcastForm, recommended_store_ids: ids.filter(id => id !== store.id) });
                            }
                          }}
                        />{' '}
                        {store.name} ({store.cuisine_type})
                      </label>
                    ))}
                  </div>
                  <small className={styles.formText}>已選擇 {broadcastForm.recommended_store_ids.length} 間店家</small>
                </div>

                <div className={styles.modalFooter}>
                  <button type="button" className={styles.btnSecondary} onClick={handleCloseBroadcastModal}>
                    取消
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={broadcastSending} style={{ background: '#FF6B6B' }}>
                    {broadcastSending ? '發送中...' : `發送推播 (${targetUserCount} 人)`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
