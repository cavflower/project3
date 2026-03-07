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
import styles from './SurplusFoodManagement.module.css';

const SurplusFoodManagement = () => {
  const [activeTab, setActiveTab] = useState('foods');

  return (
    <div className={styles.surplusFoodManagement}>
      <header className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <FaLeaf className={styles.headerIcon} />
          <div>
            <h1>惜福食品管理</h1>
            <p>減少食物浪費，創造環保價值</p>
          </div>
        </div>
      </header>

      {/* 標籤頁導航 */}
      <div className={styles.tabs}>
        <button
          className={activeTab === 'foods' ? styles.tabButtonActive : styles.tabButton}
          onClick={() => setActiveTab('foods')}
        >
          <FaLeaf /> 惜福食品
        </button>
        <button
          className={activeTab === 'timeslots' ? styles.tabButtonActive : styles.tabButton}
          onClick={() => setActiveTab('timeslots')}
        >
          <FaClock /> 惜福時段
        </button>
        <button
          className={activeTab === 'orders' ? styles.tabButtonActive : styles.tabButton}
          onClick={() => setActiveTab('orders')}
        >
          <FaCheck /> 訂單管理
        </button>
        <button
          className={activeTab === 'stats' ? styles.tabButtonActive : styles.tabButton}
          onClick={() => setActiveTab('stats')}
        >
          <FaChartBar /> 統計分析
        </button>
        <button
          className={activeTab === 'greenpoints' ? styles.tabButtonGreenPointsActive : styles.tabButtonGreenPoints}
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
