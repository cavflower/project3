import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { updateMerchantPlan } from '../../api/authApi';
import './PlanSelectionPage.css';

const PlanSelectionPage = () => {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const plans = [
    { id: 'basic', name: '基本方案', price: 'NT$ 499/月', features: ['平台基礎功能(販賣、排班...)', '基本訂單管理+惜福品', '營運報表'] },
    { id: 'premium', name: '進階方案', price: 'NT$ 999/月', features: ['包含基本方案所有功能', '開放特殊功能(訂位、會員)', '中優先級別'] },
    { id: 'enterprise', name: '企業方案', price: 'NT$ 2,499/月', features: ['包含進階方案所有功能', 'LINE BOT個人化推播','高優先級別'] },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlan) {
      setError('請選擇一個方案');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // 更新後端的使用者資料
      const updatedUser = await updateMerchantPlan(user.firebase_uid, selectedPlan);
      
      // 更新 AuthContext 中的使用者狀態
      login(updatedUser, localStorage.getItem('accessToken'));

      // 導向到儀表板
      navigate('/dashboard');

    } catch (err) {
      setError('更新方案失敗，請稍後再試。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="plan-selection-page">
      <div className="plan-container">
        <h1>選擇您的商業方案</h1>
        <p>選擇一個最適合您業務需求的方案，隨時可以升級。</p>
        
        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="plans-grid">
            {plans.map((plan) => (
              <div 
                key={plan.id} 
                className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <h2>{plan.name}</h2>
                <p className="price">{plan.price}</p>
                <ul>
                  {plan.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
                <div className="radio-button">
                  {selectedPlan === plan.id ? '✓ 已選擇' : '選擇此方案'}
                </div>
              </div>
            ))}
          </div>
          
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '儲存中...' : '確認方案'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PlanSelectionPage;
