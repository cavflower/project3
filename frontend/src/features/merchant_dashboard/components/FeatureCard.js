import React from 'react';
import styles from './FeatureCard.module.css';

const FeatureCard = ({
  icon: IconComponent,
  name,
  description,
  path,
  onClick,
  isDisabled = false,
  disabledMessage = ''
}) => {
  const handleClick = () => {
    if (!isDisabled) {
      onClick(path, isDisabled);
    }
  };

  return (
    <div
      className={isDisabled ? styles.featureCardDisabled : styles.featureCard}
      onClick={handleClick}
      title={isDisabled ? disabledMessage : ''}
    >
      {IconComponent && (
        <div className={styles.featureIcon}>
          <IconComponent />
        </div>
      )}
      <h3 className={styles.featureName}>{name}</h3>
      <p className={styles.featureDescription}>{description}</p>
      {isDisabled && (
        <div className={styles.disabledOverlay}>
          <span className={styles.disabledBadge}>已關閉</span>
        </div>
      )}
    </div>
  );
};

export default FeatureCard;
