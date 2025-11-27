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
    { id: 'basic', name: '基本方案', price: 'NT$ 999/月', features: ['商品上架無限制', '基本訂單管理', '數據分析報表'] },
    { id: 'premium', name: '進階方案', price: 'NT$ 1,999/月', features: ['包含基本方案所有功能', '顧客忠誠度系統 (點數/優惠券)', '進階行銷工具'] },
    { id: 'enterprise', name: '企業方案', price: '聯繫我們', features: ['包含進階方案所有功能', '客製化功能開發', '專屬客戶經理'] },
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
            {loading ? '儲存中...' : '確認方案並開始'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PlanSelectionPage;
