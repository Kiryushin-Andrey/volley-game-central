import React from 'react';

/** Faint indoor-court outline. Decorative. */
export const CourtLines: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 200 120" aria-hidden="true">
    <rect x="6" y="6" width="188" height="108" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <line x1="100" y1="6" x2="100" y2="114" stroke="currentColor" strokeWidth="2" />
    <line x1="6" y1="60" x2="194" y2="60" stroke="currentColor" strokeWidth="3" />
    <line x1="46" y1="6" x2="46" y2="114" stroke="currentColor" strokeWidth="1.5" />
    <line x1="154" y1="6" x2="154" y2="114" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export default CourtLines;
