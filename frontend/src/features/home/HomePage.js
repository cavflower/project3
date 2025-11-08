import React from 'react';
import './HomePage.css';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-container">
          <h1>探索美食，輕鬆管理</h1>
          <p>您的一站式智慧餐飲平台，為顧客與店家帶來無縫體驗。</p>
          <div className="button-container">
            <Link to="/customer-home" className="home-button secondary">我是顧客</Link>
            <Link to="/login/merchant" className="home-button secondary">我是店家</Link>
          </div>
        </div>
      </header>

      <section className="features-section">
        <div className="home-container">
          <h2>平台亮點</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>智慧推薦</h3>
              <p>AI 為您推薦最合口味的餐點與餐廳。</p>
            </div>
            <div className="feature-card">
              <h3>線上預訂</h3>
              <p>輕鬆預訂座位與餐點，節省您寶貴的時間。</p>
            </div>
            <div className="feature-card">
              <h3>店家儀表板</h3>
              <p>提供數據分析、智慧排班，優化您的營運。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
