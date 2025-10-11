import React, { useMemo } from 'react';
import './HalloweenDecorations.scss';

interface HalloweenDecorationsProps {
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

const generatePositions = (count: number, minDistance: number = 15): Position[] => {
  const positions: Position[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(generateRandomPosition(positions, minDistance));
  }
  return positions;
};

export const HalloweenDecorations: React.FC<HalloweenDecorationsProps> = ({ variant = 'card' }) => {
  // Generate random positions once when component mounts
  const positions = useMemo(() => {
    const minDistance = variant === 'card' ? 20 : 15;
    const count = variant === 'card' ? 9 : 18;
    return generatePositions(count, minDistance);
  }, [variant]);

  const decorations = useMemo(() => {
    const config = variant === 'card'
      ? { pumpkin: 3, spider: 3, ghost: 3, bat: 0 }
      : { pumpkin: 5, spider: 4, ghost: 5, bat: 4 };

    const decorationTypes = [
      { type: 'pumpkin', emoji: '🎃', animation: 'bounce-subtle', count: config.pumpkin },
      { type: 'spider', emoji: '🕷️', animation: 'swing-subtle', count: config.spider },
      { type: 'ghost', emoji: '👻', animation: 'float-subtle', count: config.ghost },
      { type: 'bat', emoji: '🦇', animation: 'fly-subtle', count: config.bat },
    ];

    return decorationTypes.flatMap(({ type, emoji, animation, count }) =>
      Array.from({ length: count }, () => ({ type, emoji, animation }))
    );
  }, [variant]);

  return (
    <div className={`halloween-decorations-container ${variant === 'page' ? 'page-variant' : ''}`}>
      {decorations.map((decoration, index) => {
        const position = positions[index];
        const animationDelay = `${(index * 0.5).toFixed(1)}s`;
        
        return (
          <div
            key={`${decoration.type}-${index}`}
            className={`halloween-decoration ${decoration.type}`}
            style={{
              ...position,
              animation: `${decoration.animation} ${3 + index * 0.3}s ease-in-out infinite`,
              animationDelay,
            }}
          >
            {decoration.emoji}
          </div>
        );
      })}
    </div>
  );
};
