import React from 'react';
import type { PlayerLevel } from '../types';
import './LevelPill.scss';

interface LevelPillProps {
  level: PlayerLevel;
}

const LevelPill: React.FC<LevelPillProps> = ({ level }) => {
  const label =
    level === 'advanced'
      ? 'Advanced'
      : level === 'intermediate'
        ? 'Intermediate'
        : 'Beginner';

  return (
    <span className={`level-pill level-pill--${level}`} aria-label={label}>
      {label}
    </span>
  );
};

export default LevelPill;
