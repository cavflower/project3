import React from 'react';
import styles from './HomePage.module.css';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className={styles['home-page']}>
      <header className={styles['home-header']}>
        <div className={styles['home-container']}>
          <h1>探索美食，輕鬆管理</h1>
          <p>您的一站式智慧餐飲平台，為顧客與店家帶來無縫體驗。</p>
          <div className={styles['button-container']}>
            <Link to="/customer-home" className={`${styles['home-button']} ${styles.secondary}`}>我是顧客</Link>
            <Link to="/login/merchant" className={`${styles['home-button']} ${styles.secondary}`}>我是店家</Link>
          </div>
        </div>
      </header>

      <section className={styles['features-section']}>
        <div className={styles['home-container']}>
          <h2>平台亮點</h2>
          <div className={styles['features-grid']}>
            <div className={styles['feature-card']}>
              <h3>智慧推薦</h3>
              <p>AI 為您推薦最合口味的餐點與餐廳。</p>
            </div>
            <div className={styles['feature-card']}>
              <h3>線上預訂</h3>
              <p>輕鬆預訂座位與餐點，節省您寶貴的時間。</p>
            </div>
            <div className={styles['feature-card']}>
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
