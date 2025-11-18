import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoyaltyManagement.css';
import { FaArrowLeft, FaCoins, FaAward, FaGift, FaPlus, FaTrash } from 'react-icons/fa';

const LoyaltyManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

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
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h2>會員制度概況</h2>
            <div className="overview-cards">
              <div className="overview-card">
                <FaCoins className="card-icon" />
                <h3>點數規則</h3>
                <p>管理顧客消費如何獲得點數</p>
              </div>
              <div className="overview-card">
                <FaAward className="card-icon" />
                <h3>會員等級</h3>
                <p>設定不同等級的會員權益與折扣</p>
              </div>
              <div className="overview-card">
                <FaGift className="card-icon" />
                <h3>兌換商品</h3>
                <p>建立可供會員用點數兌換的商品</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'point-rules' && (
          <PointRulesSection />
        )}

        {activeTab === 'membership-levels' && (
          <MembershipLevelsSection />
        )}

        {activeTab === 'redemptions' && (
          <RedemptionsSection />
        )}
      </main>
    </div>
  );
};

const PointRulesSection = () => (
  <section className="loyalty-section">
    <div className="section-header">
      <h2></h2>
      <button className="btn btn-primary">+ 新增規則</button>
    </div>
    <div className="empty-state">
      <FaCoins className="empty-icon" />
      <h3>還沒有點數規則</h3>
      <p>建立第一個點數規則，定義顧客消費多少金額可獲得多少點數</p>
      <button className="btn btn-secondary">建立規則</button>
    </div>
  </section>
);

const MembershipLevelsSection = () => {
  const [levels, setLevels] = useState([]);
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

const RedemptionsSection = () => (
  <section className="loyalty-section">
    <div className="section-header">
      <h2></h2>
      <button className="btn btn-primary">+ 新增商品</button>
    </div>
    <div className="empty-state">
      <FaGift className="empty-icon" />
      <h3>還沒有兌換商品</h3>
      <p>建立兌換商品，讓會員用積累的點數兌換您提供的禮品或優惠</p>
      <button className="btn btn-secondary">建立商品</button>
    </div>
  </section>
);

export default LoyaltyManagement;
