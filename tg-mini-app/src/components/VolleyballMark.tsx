import React, { useId } from 'react';

interface VolleyballMarkProps {
  className?: string;
  title?: string;
}

/**
 * Volleyball with curved panels. The seams arc across the sphere
 * instead of wrapping it like a striped planet.
 */
export const VolleyballMark: React.FC<VolleyballMarkProps> = ({ className, title }) => {
  const id = useId().replace(/:/g, '');

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <radialGradient id={`${id}-shade`} cx="30%" cy="28%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="var(--ball-base)" />
          <stop offset="100%" stopColor="#c4baac" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="32" cy="32" r="27.2" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <circle cx="32" cy="32" r="28" fill={`url(#${id}-shade)`} />
        <path
          fill="var(--ball-blue)"
          d="M31 5C16 9 7 20 6 33c8-2 14-6 18-12 3-5 5-11 7-16z"
        />
        <path
          fill="var(--ball-blue)"
          d="M8 40c2 10 10 18 20 22 1-8 0-14-4-19-4-5-10-8-16-3z"
        />
        <path
          fill="var(--ball-gold)"
          d="M36 8c10 2 18 10 22 20-8 1-14-1-19-6-4-4-6-10-3-14z"
        />
        <path
          fill="var(--ball-gold)"
          d="M40 36c8 2 14 8 17 16-8 4-16 2-22-2-5-4-7-10-5-14 2 0 6 0 10 0z"
        />
        <path
          fill="none"
          stroke="var(--court-blue-deep)"
          strokeWidth="1.5"
          strokeLinecap="round"
          d="M31 5c-2 10-6 18-14 26-6 6-8 12-7 18M36 8c-2 8 0 14 6 20 6 6 10 10 15 12M14 28c10 2 18 8 24 16 4 6 8 12 14 16"
        />
        <ellipse cx="22" cy="16" rx="7" ry="3.6" fill="#ffffff" opacity="0.75" />
      </g>
      <circle cx="32" cy="32" r="27.2" fill="none" stroke="var(--court-blue-deep)" strokeWidth="1.6" />
    </svg>
  );
};

export default VolleyballMark;
