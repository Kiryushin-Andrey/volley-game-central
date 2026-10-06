import React from 'react';
import VolleyballMark from '../VolleyballMark';

export const ActionLoadingOverlay: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <div className="action-loading">
      <VolleyballMark className="volleyball-spinner volleyball-spinner-sm" />
      <span>Processing...</span>
    </div>
  );
};


