import React from 'react';
import type { GameFormat } from '../types';
import { formatPillLabel, formatTone } from '../utils/courtTheme';

export const FormatPill: React.FC<{ format: GameFormat }> = ({ format }) => (
  <span className={`format-pill format-pill-${formatTone(format)}`}>
    {formatPillLabel(format)}
  </span>
);

export default FormatPill;
