import React from 'react';

interface VolleyballMarkProps {
  className?: string;
  title?: string;
}

/** Simple panel ball. Decorative unless a title is provided. */
export const VolleyballMark: React.FC<VolleyballMarkProps> = ({ className, title }) => (
  <svg
    className={className}
    viewBox="0 0 64 64"
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    <circle cx="32" cy="32" r="28" fill="var(--ball-yellow)" stroke="var(--court-navy)" strokeWidth="2.5" />
    <path d="M32 4c6 9 10 18 10 28s-4 19-10 28c-6-9-10-18-10-28S26 13 32 4z" fill="var(--ball-blue)" opacity="0.9" />
    <path d="M10 22c8 4 16 6 22 6 6 0 14-2 22-6" fill="none" stroke="var(--court-navy)" strokeWidth="2" />
    <path d="M12 42c8-4 14-6 20-6s12 2 20 6" fill="none" stroke="var(--court-navy)" strokeWidth="2" />
  </svg>
);

export default VolleyballMark;
