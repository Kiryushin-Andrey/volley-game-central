import React from 'react';

export const InfoText: React.FC<{ text: string | null }> = ({ text }) => {
  if (!text) return null;
  return <div className="info-text">{text}</div>;
};


