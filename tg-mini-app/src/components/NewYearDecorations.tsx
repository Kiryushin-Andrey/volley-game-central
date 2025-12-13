import React, { useMemo } from 'react';
import './NewYearDecorations.scss';

interface NewYearDecorationsProps {
  variant?: 'card' | 'page';
}

interface Position {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

// Generate random position that doesn't overlap with existing positions
const generateRandomPosition = (
  existingPositions: Position[],
  minDistance: number = 15 // minimum distance in percentage
): Position => {
  const maxAttempts = 50;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Randomly choose if we use top or bottom, left or right
    const useTop = Math.random() > 0.5;
    const useLeft = Math.random() > 0.5;

    const verticalPos = Math.floor(Math.random() * 80) + 10; // 10-90%
    const horizontalPos = Math.floor(Math.random() * 80) + 10; // 10-90%

    const newPos: Position = {
      [useTop ? 'top' : 'bottom']: `${verticalPos}%`,
      [useLeft ? 'left' : 'right']: `${horizontalPos}%`,
    };

    // Check if this position is far enough from existing positions
    const isFarEnough = existingPositions.every((existingPos) => {
      // Convert positions to comparable values
      const newVertical = useTop ? verticalPos : 100 - verticalPos;
      const newHorizontal = useLeft ? horizontalPos : 100 - horizontalPos;

      const existingVertical = existingPos.top
        ? parseInt(existingPos.top)
        : 100 - parseInt(existingPos.bottom || '0');
      const existingHorizontal = existingPos.left
        ? parseInt(existingPos.left)
        : 100 - parseInt(existingPos.right || '0');

      const verticalDistance = Math.abs(newVertical - existingVertical);
      const horizontalDistance = Math.abs(newHorizontal - existingHorizontal);

      return verticalDistance > minDistance || horizontalDistance > minDistance;
    });

    if (isFarEnough) {
      return newPos;
    }

    attempts++;
  }

  // Fallback: return a position even if it might overlap slightly
  return {
    top: `${Math.floor(Math.random() * 80) + 10}%`,
    left: `${Math.floor(Math.random() * 80) + 10}%`,
  };
};

const generatePositions = (count: number, minDistance: number = 15, useTopLeftOnly: boolean = false): Position[] => {
  const positions: Position[] = [];
  for (let i = 0; i < count; i++) {
    const pos = generateRandomPosition(positions, minDistance);
    // For card variant, always use top/left to avoid positioning issues
    if (useTopLeftOnly) {
      const top = pos.top ? parseInt(pos.top) : (pos.bottom ? 100 - parseInt(pos.bottom) : Math.floor(Math.random() * 80) + 10);
      const left = pos.left ? parseInt(pos.left) : (pos.right ? 100 - parseInt(pos.right) : Math.floor(Math.random() * 80) + 10);
      positions.push({
        top: `${top}%`,
        left: `${left}%`,
      });
    } else {
      positions.push(pos);
    }
  }
  return positions;
};

export const NewYearDecorations: React.FC<NewYearDecorationsProps> = ({ variant = 'card' }) => {
  const decorations = useMemo(() => {
    const config = variant === 'card'
      ? { snowflake: 6, tree: 2, snowman: 2, ski: 2, iceskate: 1, gift: 3 }
      : { snowflake: 12, tree: 3, snowman: 4, ski: 3, iceskate: 4, gift: 8 };

    const decorationTypes = [
      { type: 'snowflake', emoji: '❄️', animation: 'fall-snow', count: config.snowflake },
      { type: 'tree', emoji: '🎄', animation: 'swing-subtle', count: config.tree },
      { type: 'snowman', emoji: '☃️', animation: 'bounce-subtle', count: config.snowman },
      { type: 'ski', emoji: '⛷️', animation: 'slide-subtle', count: config.ski },
      { type: 'iceskate', emoji: '⛸️', animation: 'slide-subtle', count: config.iceskate },
      { type: 'gift', emoji: '🎁', animation: 'bounce-subtle', count: config.gift },
    ];

    return decorationTypes.flatMap(({ type, emoji, animation, count }) =>
      Array.from({ length: count }, () => ({
        type,
        emoji,
        animation,
        size: type === 'snowflake' ? (12 + Math.random() * 12) : undefined, // Random size between 12-24px for snowflakes
        speed: type === 'snowflake' ? (3 + Math.random() * 4) : undefined, // Random speed between 3-7s for snowflakes
      }))
    );
  }, [variant]);

  // Generate positions only for non-snowflake decorations
  const positions = useMemo(() => {
    const nonSnowflakeCount = decorations.filter(d => d.type !== 'snowflake').length;
    const minDistance = variant === 'card' ? 20 : 15;
    // For card variant, always use top/left to ensure proper positioning
    return generatePositions(nonSnowflakeCount, minDistance, variant === 'card');
  }, [decorations, variant]);

  return (
    <div className={`newyear-decorations-container ${variant === 'page' ? 'page-variant' : ''}`}>
      {decorations.map((decoration, index) => {
        // Track position index separately for non-snowflake decorations
        const nonSnowflakeIndex = decorations.slice(0, index).filter(d => d.type !== 'snowflake').length;
        
        // For snowflakes, position them at the top with random horizontal position
        const position = decoration.type === 'snowflake'
          ? {
              top: '-50px',
              left: `${Math.random() * 100}%`,
            }
          : (positions[nonSnowflakeIndex] || {
              // Fallback position if somehow undefined
              top: `${10 + Math.random() * 80}%`,
              left: `${10 + Math.random() * 80}%`,
            });
        
        const animationDelay = decoration.type === 'snowflake'
          ? `${Math.random() * 3}s`
          : `${(index * 0.3).toFixed(1)}s`;
        
        // For snowflakes, use falling animation with varying speeds
        const animationDuration = decoration.type === 'snowflake' && decoration.speed
          ? `${decoration.speed}s`
          : `${3 + index * 0.3}s`;
        
        const fontSize = decoration.type === 'snowflake' && decoration.size
          ? `${decoration.size}px`
          : undefined;
        
        return (
          <div
            key={`${decoration.type}-${index}`}
            className={`newyear-decoration ${decoration.type} ${decoration.type === 'snowflake' ? 'falling' : ''}`}
            style={{
              ...position,
              animation: `${decoration.animation} ${animationDuration} linear infinite`,
              animationDelay,
              fontSize: fontSize,
            }}
          >
            {decoration.emoji}
          </div>
        );
      })}
    </div>
  );
};

