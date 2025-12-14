import React from 'react';
import { FaTag } from 'react-icons/fa';
import './FoodTags.css';

const FoodTags = ({ tags, maxDisplay = 5 }) => {
  if (!tags || tags.length === 0) return null;

  const displayTags = tags.slice(0, maxDisplay);
  const remainingCount = tags.length - maxDisplay;

  return (
    <div className="food-tags-display">
      {displayTags.map((tag, index) => (
        <span
          key={index}
          className="food-tag"
          title={tag}
        >
          <FaTag className="tag-icon" />
          {tag}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="food-tag-more">
          +{remainingCount}
        </span>
      )}
    </div>
  );
};

export default FoodTags;
