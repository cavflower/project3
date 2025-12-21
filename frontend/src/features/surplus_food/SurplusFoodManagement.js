import React, { useState } from 'react';
import {
  FaLeaf,
  FaClock,
  FaChartBar,
  FaCheck,
  FaCoins
} from 'react-icons/fa';
import SurplusFoodList from './SurplusFoodList';
import SurplusTimeSlotList from './SurplusTimeSlotList';
import SurplusOrderList from './SurplusOrderList';
import SurplusStatistics from './SurplusStatistics';
import GreenPointRuleList from './GreenPointRuleList';
import './SurplusFoodManagement.css';

const SurplusFoodManagement = () => {
  const [activeTab, setActiveTab] = useState('foods');

  return (
    <div className="surplus-food-management">
      <header className="page-header">
        <div className="header-content">
          <FaLeaf className="header-icon" />
          <div>
            <h1>惜福食品管理</h1>
            <p>減少食物浪費，創造環保價值</p>
          </div>
        </div>
      </header>

      {/* 標籤頁導航 */}
      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'foods' ? 'active' : ''}`}
          onClick={() => setActiveTab('foods')}
        >
          <FaLeaf /> 惜福食品
        </button>
        <button
          className={`tab-button ${activeTab === 'timeslots' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeslots')}
        >
          <FaClock /> 惜福時段
        </button>
        <button
          className={`tab-button ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <FaCheck /> 訂單管理
        </button>
        <button
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <FaChartBar /> 統計分析
        </button>
        <button
          className={`tab-button green-points ${activeTab === 'greenpoints' ? 'active' : ''}`}
          onClick={() => setActiveTab('greenpoints')}
        >
          <FaCoins /> 綠色點數
        </button>
      </div>

      {/* 根據選擇的標籤頁顯示對應組件 */}
      {activeTab === 'foods' && <SurplusFoodList />}
      {activeTab === 'timeslots' && <SurplusTimeSlotList />}
      {activeTab === 'orders' && <SurplusOrderList />}
      {activeTab === 'stats' && <SurplusStatistics />}
      {activeTab === 'greenpoints' && <GreenPointRuleList />}
    </div>
  );
};

export default SurplusFoodManagement;

