import React from 'react';
import styles from './SkeletonLoader.module.css';

const SkeletonLoader = ({
  variant = 'page',
  rows = 6,
  cards = 6,
  title = true,
  sidebar = false,
}) => {
  const rowItems = Array.from({ length: rows });
  const cardItems = Array.from({ length: cards });

  if (variant === 'list') {
    return (
      <div className={styles.skeletonList} aria-label="資料讀取中">
        {rowItems.map((_, index) => (
          <div key={index} className={styles.skeletonListItem}>
            <span className={styles.skeletonAvatar} />
            <div className={styles.skeletonListText}>
              <span className={styles.skeletonLineWide} />
              <span className={styles.skeletonLine} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className={styles.skeletonPage} aria-label="資料讀取中">
        {title && (
          <div className={styles.skeletonHeader}>
            <span className={styles.skeletonTitle} />
            <span className={styles.skeletonSubtitle} />
          </div>
        )}
        <div className={styles.skeletonGrid}>
          {cardItems.map((_, index) => (
            <article key={index} className={styles.skeletonCard}>
              <span className={styles.skeletonImage} />
              <span className={styles.skeletonLineWide} />
              <span className={styles.skeletonLine} />
              <span className={styles.skeletonLineShort} />
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.skeletonPage} aria-label="資料讀取中">
      {title && (
        <div className={styles.skeletonHeader}>
          <span className={styles.skeletonTitle} />
          <span className={styles.skeletonSubtitle} />
        </div>
      )}
      <div className={sidebar ? styles.skeletonLayout : styles.skeletonStack}>
        {sidebar && (
          <aside className={styles.skeletonSidebar}>
            <span className={styles.skeletonLineWide} />
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLineShort} />
            <span className={styles.skeletonBlock} />
          </aside>
        )}
        <main className={styles.skeletonMain}>
          <span className={styles.skeletonHero} />
          {rowItems.map((_, index) => (
            <span
              key={index}
              className={index % 3 === 0 ? styles.skeletonLineWide : styles.skeletonLine}
            />
          ))}
        </main>
      </div>
    </div>
  );
};

export default SkeletonLoader;
