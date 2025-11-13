import React from 'react';
import './FeatureCard.css';

const FeatureCard = ({ icon: IconComponent, name, description, path, onClick }) => {
  return (
    <div className="feature-card" onClick={() => onClick(path)}>
      {IconComponent && (
        <div className="feature-icon">
          <IconComponent />
        </div>
      )}
      <h3 className="feature-name">{name}</h3>
      <p className="feature-description">{description}</p>
    </div>
  );
};

export default FeatureCard;
