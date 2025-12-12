import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoyaltyManagement.css';
import { FaArrowLeft, FaCoins, FaAward, FaGift, FaPlus, FaTrash } from 'react-icons/fa';
import api from '../../api/api';

const LoyaltyManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('point-rules');
  const [loading, setLoading] = useState(false);
  
  // 從 localStorage 恢復狀態
  const [levels, setLevels] = useState(() => {
    const saved = localStorage.getItem('membershipLevels');
    return saved ? JSON.parse(saved) : [];
  });

  const [pointRules, setPointRules] = useState([]);

  const [redemptions, setRedemptions] = useState(() => {
    const saved = localStorage.getItem('redemptionProducts');
    return saved ? JSON.parse(saved) : [];
  });

  // 當 levels 變化時保存到 localStorage
  useEffect(() => {
    localStorage.setItem('membershipLevels', JSON.stringify(levels));
  }, [levels]);

  // 當 redemptions 變化時保存到 localStorage
  useEffect(() => {
    localStorage.setItem('redemptionProducts', JSON.stringify(redemptions));
  }, [redemptions]);

  // 載入點數規則
  useEffect(() => {
    loadPointRules();
  }, []);

  const loadPointRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/loyalty/merchant/point-rules/');
      setPointRules(response.data);
    } catch (error) {
      console.error('載入點數規則失敗:', error);
      alert('載入點數規則失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loyalty-management">
      <header className="loyalty-header">
        <button className="back-btn" onClick={() => navigate('/dashboard')}>
          <FaArrowLeft /> 返回
        </button>
        <h1>會員制度管理</h1>
        <p>設定您的點數規則、會員等級和兌換商品</p>
      </header>

      <nav className="loyalty-nav">
        <button
          className={`nav-tab ${activeTab === 'point-rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('point-rules')}
        >
          <FaCoins /> 點數規則
        </button>
        <button
          className={`nav-tab ${activeTab === 'membership-levels' ? 'active' : ''}`}
          onClick={() => setActiveTab('membership-levels')}
        >
          <FaAward /> 會員等級
        </button>
        <button
          className={`nav-tab ${activeTab === 'redemptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('redemptions')}
        >
          <FaGift /> 兌換商品
        </button>
      </nav>

      <main className="loyalty-content">
        {activeTab === 'point-rules' && (
          <PointRulesSection 
            pointRules={pointRules}
            setPointRules={setPointRules}
            loading={loading}
            setLoading={setLoading}
            loadPointRules={loadPointRules}
          />
        )}

        {activeTab === 'membership-levels' && (
          <MembershipLevelsSection 
            levels={levels}
            setLevels={setLevels}
          />
        )}

        {activeTab === 'redemptions' && (
          <RedemptionsSection 
            redemptions={redemptions}
            setRedemptions={setRedemptions}
            loading={loading}
            setLoading={setLoading}
          />
        )}
      </main>
    </div>
  );
};

const PointRulesSection = ({ pointRules, setPointRules, loading, setLoading, loadPointRules }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    currency_per_point: 100, // 預設每100元得1點
    min_spend: 0,
  });

  const addRule = async () => {
    if (!formData.name || formData.currency_per_point <= 0) {
      alert('請輸入有效的規則名稱和消費金額');
      return;
    }

    try {
      setLoading(true);
      // 轉換：每X元得1點 -> 每1元得Y點
      const points_per_currency = 1 / parseFloat(formData.currency_per_point);
      
      const ruleData = {
        name: formData.name,
        points_per_currency: points_per_currency,
        min_spend: formData.min_spend ? parseFloat(formData.min_spend) : 0,
        active: true,
      };

      console.log('準備送出的規則資料:', ruleData);
      console.log('檢查 merchant token:', localStorage.getItem('merchant_accessToken') ? '有 token' : '無 token');

      const response = await api.post('/loyalty/merchant/point-rules/', ruleData);
      console.log('API 回應:', response.data);
      
      // 重新載入規則列表
      await loadPointRules();
      
      setFormData({
        name: '',
        currency_per_point: 100,
        min_spend: 0,
      });
      setShowForm(false);
      alert('點數規則新增成功！');
    } catch (error) {
      console.error('新增點數規則失敗:', error);
      console.error('錯誤詳情:', error.response?.data);
      
      let errorMessage = '新增點數規則失敗';
      if (error.response?.data) {
        // 顯示後端返回的錯誤信息
        const errors = error.response.data;
        if (typeof errors === 'object') {
          errorMessage += '：\n' + Object.entries(errors)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join('\n');
        } else {
          errorMessage += '：' + errors;
        }
      } else if (error.message) {
        errorMessage += '：' + error.message;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const removeRule = async (id) => {
    if (!window.confirm('確定要刪除這個點數規則嗎？')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/loyalty/merchant/point-rules/${id}/`);
      await loadPointRules();
      alert('點數規則刪除成功！');
    } catch (error) {
      console.error('刪除點數規則失敗:', error);
      alert('刪除點數規則失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="loyalty-section">
      <div className="section-header">
        <div>
          {pointRules.length > 0 && (
            <p className="section-subtitle">已設定 {pointRules.length} 個規則</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          新增規則
        </button>
      </div>

      {pointRules.length === 0 ? (
        <div className="empty-state">
          <FaCoins className="empty-icon" />
          <h3>還沒有點數規則</h3>
          <p>建立第一個點數規則，定義顧客消費多少金額可獲得多少點數</p>
          <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
            建立規則
          </button>
        </div>
      ) : (
        <div className="rules-table">
          <table>
            <thead>
              <tr>
                <th>規則名稱</th>
                <th>點數累積方式</th>
                <th>最低消費金額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pointRules.map((rule) => {
                // 計算每X元得1點
                const currencyPerPoint = rule.points_per_currency > 0 
                  ? Math.round(1 / rule.points_per_currency) 
                  : 0;
                
                return (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>每消費 <strong>${currencyPerPoint}</strong> 元累積 <strong>1</strong> 點</td>
                    <td>{rule.min_spend > 0 ? `$${rule.min_spend}` : '無限制'}</td>
                    <td>
                      <button
                        className="delete-btn-small"
                        onClick={() => removeRule(rule.id)}
                      >
                        <FaTrash /> 刪除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="form-overlay">
          <div className="form-modal">
            <div className="modal-header">
              <h3>新增點數規則</h3>
              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>規則名稱 *</label>
                <input
                  type="text"
                  placeholder="例如：標準規則、季節特惠"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>每消費多少元可以累積 1 點 *</label>
                <input
                  type="number"
                  placeholder="例如：100（表示每消費100元得1點）"
                  min="1"
                  step="1"
                  value={formData.currency_per_point}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currency_per_point: e.target.value,
                    })
                  }
                />
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  提示：輸入 100 表示每消費100元可得1點；輸入 50 表示每消費50元可得1點
                </small>
              </div>

              <div className="form-group">
                <label>最低消費金額（可選）</label>
                <input
                  type="number"
                  placeholder="例如：100 (不填表示無限制)"
                  min="0"
                  value={formData.min_spend}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_spend: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
              <button className="btn btn-primary" onClick={addRule}>
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const MembershipLevelsSection = ({ levels, setLevels }) => {
  const [useSlider, setUseSlider] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    threshold_points: 0,
    discount_percent: 0,
    benefits: '',
  });

  // 添加新的等級
  const addLevel = () => {
    if (!formData.name || formData.threshold_points < 0) {
      alert('請輸入有效的等級名稱和點數門檻');
      return;
    }

    const newLevel = {
      id: Date.now(),
      ...formData,
      threshold_points: parseInt(formData.threshold_points),
    };

    setLevels([...levels, newLevel].sort((a, b) => a.threshold_points - b.threshold_points));
    setFormData({
      name: '',
      threshold_points: 0,
      discount_percent: 0,
      benefits: '',
    });
    setShowForm(false);
  };

  // 刪除等級
  const removeLevel = (id) => {
    setLevels(levels.filter((level) => level.id !== id));
  };

  // 更新滑條上的等級點數
  const updateLevelPoints = (id, points) => {
    setLevels(
      levels.map((level) =>
        level.id === id ? { ...level, threshold_points: points } : level
      ).sort((a, b) => a.threshold_points - b.threshold_points)
    );
  };

  const maxPoints = Math.max(...levels.map((l) => l.threshold_points), 10000) || 10000;

  return (
    <section className="loyalty-section">
      <div className="section-header">
        <div>
          <h2>會員等級設定</h2>
          <p className="section-subtitle">
            {useSlider
              ? '使用滑條拖動設定各級距'
              : '使用表單輸入設定各級距'}
          </p>
        </div>
        <div className="header-actions">
          <button
            className={`toggle-btn ${useSlider ? 'active' : ''}`}
            onClick={() => setUseSlider(!useSlider)}
          >
            {useSlider ? '切換到表單模式' : '切換到滑條模式'}
          </button>
          {!showForm && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <FaPlus /> 新增等級
            </button>
          )}
        </div>
      </div>

      {/* 滑條模式 */}
      {useSlider && (
        <div className="slider-container">
          <div className="slider-header">
            <h3>拖動滑塊設定會員等級</h3>
            <p>點數軸範圍：0 - {maxPoints.toLocaleString()}</p>
          </div>

          {levels.length === 0 ? (
            <div className="empty-slider-state">
              <FaAward className="empty-icon" />
              <p>還沒有會員等級，請新增第一個等級</p>
            </div>
          ) : (
            <div className="levels-slider-display">
              {/* 點數軸 */}
              <div className="points-axis">
                <div className="axis-track">
                  {levels.map((level) => (
                    <div
                      key={level.id}
                      className="level-marker"
                      style={{
                        left: `${(level.threshold_points / maxPoints) * 100}%`,
                      }}
                    >
                      <div className="marker-dot" />
                      <div className="marker-tooltip">
                        <div className="tooltip-content">
                          <div className="tooltip-name">{level.name}</div>
                          <div className="tooltip-points">
                            {level.threshold_points.toLocaleString()} 點
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="axis-labels">
                  <span className="axis-label">0</span>
                  <span className="axis-label">{(maxPoints / 2).toLocaleString()}</span>
                  <span className="axis-label">{maxPoints.toLocaleString()}</span>
                </div>
              </div>

              {/* 等級列表 */}
              <div className="levels-list">
                {levels.map((level, index) => (
                  <div key={level.id} className="level-item-slider">
                    <div className="level-info">
                      <div className="level-rank">LV.{index + 1}</div>
                      <div className="level-details">
                        <h4>{level.name}</h4>
                        <p className="level-points">
                          {level.threshold_points.toLocaleString()} 點起
                        </p>
                      </div>
                    </div>

                    <div className="level-controls">
                      <div className="slider-wrapper">
                        <input
                          type="range"
                          min="0"
                          max={maxPoints}
                          value={level.threshold_points}
                          onChange={(e) =>
                            updateLevelPoints(level.id, parseInt(e.target.value))
                          }
                          className="level-slider"
                        />
                        <div className="slider-value">
                          {level.threshold_points.toLocaleString()}
                        </div>
                      </div>

                      <button
                        className="delete-btn"
                        onClick={() => removeLevel(level.id)}
                        title="刪除此等級"
                      >
                        <FaTrash />
                      </button>
                    </div>

                    <div className="level-benefits">
                      {level.discount_percent > 0 && (
                        <span className="benefit-badge">
                          折扣 {level.discount_percent}%
                        </span>
                      )}
                      {level.benefits && (
                        <span className="benefit-badge benefits-text">
                          {level.benefits}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {levels.length > 0 && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <FaPlus /> 新增更多等級
            </button>
          )}
        </div>
      )}

      {/* 表單模式 */}
      {useSlider === false && (
        <div className="form-container">
          <div className="form-header">
            <h3>會員等級列表</h3>
            {levels.length > 0 && (
              <p className="form-subtitle">已設定 {levels.length} 個等級</p>
            )}
          </div>

          {levels.length > 0 && (
            <div className="levels-table">
              <table>
                <thead>
                  <tr>
                    <th>等級</th>
                    <th>名稱</th>
                    <th>門檻點數</th>
                    <th>折扣</th>
                    <th>權益說明</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((level, index) => (
                    <tr key={level.id}>
                      <td>LV.{index + 1}</td>
                      <td>{level.name}</td>
                      <td>{level.threshold_points.toLocaleString()}</td>
                      <td>
                        {level.discount_percent > 0
                          ? `${level.discount_percent}%`
                          : '-'}
                      </td>
                      <td className="benefits-cell">
                        {level.benefits || '-'}
                      </td>
                      <td>
                        <button
                          className="delete-btn-small"
                          onClick={() => removeLevel(level.id)}
                        >
                          <FaTrash /> 刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {levels.length === 0 && (
            <div className="empty-state">
              <FaAward className="empty-icon" />
              <h3>還沒有會員等級</h3>
              <p>建立會員等級，為不同消費等級的顧客提供差異化的權益</p>
            </div>
          )}
        </div>
      )}

      {/* 新增表單 */}
      {showForm && (
        <div className="form-overlay">
          <div className="form-modal">
            <div className="modal-header">
              <h3>新增會員等級</h3>
              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>等級名稱 *</label>
                <input
                  type="text"
                  placeholder="例如：銀牌會員、金牌會員"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>門檻點數 *</label>
                <input
                  type="number"
                  placeholder="例如：1000"
                  min="0"
                  value={formData.threshold_points}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      threshold_points: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>折扣百分比 (%)</label>
                <input
                  type="number"
                  placeholder="例如：10"
                  min="0"
                  max="100"
                  value={formData.discount_percent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_percent: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>權益說明</label>
                <textarea
                  placeholder="例如：享受額外折扣、優先預訂、生日禮物等"
                  value={formData.benefits}
                  onChange={(e) =>
                    setFormData({ ...formData, benefits: e.target.value })
                  }
                  rows="3"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
              <button className="btn btn-primary" onClick={addLevel}>
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const RedemptionsSection = ({ redemptions, setRedemptions, loading, setLoading }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    required_points: 0,
    inventory: null,
  });

  // 載入兌換商品列表
  useEffect(() => {
    loadRedemptions();
  }, []);

  const loadRedemptions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/loyalty/merchant/redemptions/');
      setRedemptions(response.data);
    } catch (error) {
      console.error('載入兌換商品失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRedemption = async () => {
    if (!formData.title || formData.required_points <= 0) {
      alert('請輸入有效的商品標題和所需點數');
      return;
    }

    try {
      setLoading(true);
      const redemptionData = {
        title: formData.title,
        description: formData.description,
        required_points: parseInt(formData.required_points),
        inventory: formData.inventory ? parseInt(formData.inventory) : null,
        is_active: true,
      };

      await api.post('/loyalty/merchant/redemptions/', redemptionData);
      
      // 重新載入列表
      await loadRedemptions();
      
      setFormData({
        title: '',
        description: '',
        required_points: 0,
        inventory: null,
      });
      setShowForm(false);
      alert('兌換商品新增成功！');
    } catch (error) {
      console.error('新增兌換商品失敗:', error);
      console.error('錯誤詳情:', error.response?.data);
      const errorMsg = error.response?.data?.detail || 
                       error.response?.data?.error || 
                       JSON.stringify(error.response?.data) || 
                       '新增兌換商品失敗，請重試';
      alert(`新增失敗：${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const removeRedemption = async (id) => {
    if (!window.confirm('確定要刪除這個兌換商品嗎？')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/loyalty/merchant/redemptions/${id}/`);
      await loadRedemptions();
      alert('兌換商品刪除成功！');
    } catch (error) {
      console.error('刪除兌換商品失敗:', error);
      alert('刪除兌換商品失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id) => {
    const item = redemptions.find(r => r.id === id);
    if (!item) return;

    try {
      setLoading(true);
      await api.patch(`/loyalty/merchant/redemptions/${id}/`, {
        is_active: !item.is_active
      });
      await loadRedemptions();
    } catch (error) {
      console.error('更新兌換商品狀態失敗:', error);
      alert('更新狀態失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="loyalty-section">
      <div className="section-header">
        <div>
          <h2>兌換商品</h2>
          {redemptions.length > 0 && (
            <p className="section-subtitle">
              已設定 {redemptions.filter((r) => r.is_active).length} 個活躍商品
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          新增商品
        </button>
      </div>

      {redemptions.length === 0 ? (
        <div className="empty-state">
          <FaGift className="empty-icon" />
          <h3>還沒有兌換商品</h3>
          <p>建立兌換商品，讓會員用積累的點數兌換您提供的禮品或優惠</p>
        </div>
      ) : (
        <div className="redemptions-grid">
          {redemptions.map((item) => (
            <div
              key={item.id}
              className={`redemption-card ${item.is_active ? 'active' : 'inactive'}`}
            >
              <div className="card-header">
                <h3>{item.title}</h3>
                <button
                  className={`status-badge ${item.is_active ? 'active' : ''}`}
                  onClick={() => toggleActive(item.id)}
                >
                  {item.is_active ? '上架' : '下架'}
                </button>
              </div>

              <p className="card-description">{item.description}</p>

              <div className="card-footer">
                <div className="card-stats">
                  <div className="stat">
                    <span className="label">所需點數</span>
                    <span className="value">{item.required_points}</span>
                  </div>
                  <div className="stat">
                    <span className="label">庫存</span>
                    <span className="value">
                      {item.inventory ? item.inventory : '不限量'}
                    </span>
                  </div>
                </div>

                <button
                  className="delete-btn-small"
                  onClick={() => removeRedemption(item.id)}
                >
                  <FaTrash /> 刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="form-overlay">
          <div className="form-modal">
            <div className="modal-header">
              <h3>新增兌換商品</h3>
              <button
                className="modal-close"
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>名稱 *</label>
                <input
                  type="text"
                  placeholder="如：免費飲料"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>所需點數 *</label>
                  <input
                    type="number"
                    placeholder="500"
                    min="1"
                    value={formData.required_points}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        required_points: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>庫存</label>
                  <input
                    type="number"
                    placeholder="不限量"
                    min="0"
                    value={formData.inventory || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inventory: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>描述</label>
                <textarea
                  placeholder="如：價值100元的任意飲料"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows="2"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
              <button className="btn btn-primary" onClick={addRedemption}>
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LoyaltyManagement;
