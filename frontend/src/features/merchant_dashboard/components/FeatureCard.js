import React from 'react';
import './FeatureCard.css';

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
      className={`feature-card ${isDisabled ? 'feature-card-disabled' : ''}`}
      onClick={handleClick}
      title={isDisabled ? disabledMessage : ''}
    >
      {IconComponent && (
        <div className="feature-icon">
          <IconComponent />
        </div>
      )}
      <h3 className="feature-name">{name}</h3>
      <p className="feature-description">{description}</p>
      {isDisabled && (
        <div className="disabled-overlay">
          <span className="disabled-badge">已關閉</span>
        </div>
      )}
    </div>
  );
};

export default FeatureCard;
