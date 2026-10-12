import React from 'react';
import { Spinner } from '@telegram-apps/telegram-ui';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="loading-spinner">
      <Spinner size="l" />
      <div className="loading-text">Loading...</div>
    </div>
  );
};

export default LoadingSpinner;
