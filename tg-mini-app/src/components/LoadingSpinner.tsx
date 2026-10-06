import React from 'react';
import VolleyballMark from './VolleyballMark';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="loading-spinner" role="status">
      <VolleyballMark className="volleyball-spinner" />
      <div className="loading-text">Loading...</div>
    </div>
  );
};

export default LoadingSpinner;
