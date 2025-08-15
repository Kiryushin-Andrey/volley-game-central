import React from 'react';

export const ActionLoadingOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div className="action-loading">
      <div className="spinner"></div>
      <span>Processing...</span>
    </div>
  );
};


