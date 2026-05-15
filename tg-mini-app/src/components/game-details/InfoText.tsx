import React from 'react';

export const InfoText: React.FC<{ text: string | null; 'data-testid'?: string }> = ({
  text,
  'data-testid': dataTestId = 'game-details-info-text',
}) => {
  if (!text) return null;
  return (
    <div className="info-text" data-testid={dataTestId}>
      {text}
    </div>
  );
};


