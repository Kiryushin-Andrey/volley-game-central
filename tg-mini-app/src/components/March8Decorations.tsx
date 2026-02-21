import React, { useMemo } from 'react';
import './March8Decorations.scss';

interface March8DecorationsProps {
  variant?: 'card' | 'page';
  showFallingPetals?: boolean;
}

interface Position {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

const generateRandomPosition = (
  existingPositions: Position[],
  minDistance: number = 15
): Position => {
  const maxAttempts = 50;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const useTop = Math.random() > 0.5;
    const useLeft = Math.random() > 0.5;
    const verticalPos = Math.floor(Math.random() * 80) + 10;
    const horizontalPos = Math.floor(Math.random() * 80) + 10;

    const newPos: Position = {
      [useTop ? 'top' : 'bottom']: `${verticalPos}%`,
      [useLeft ? 'left' : 'right']: `${horizontalPos}%`,
    };

    const isFarEnough = existingPositions.every((existingPos) => {
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

    if (isFarEnough) return newPos;
    attempts++;
  }

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

export const March8Decorations: React.FC<March8DecorationsProps> = ({
  variant = 'card',
  showFallingPetals = false,
}) => {
  const positions = useMemo(() => {
    const minDistance = variant === 'card' ? 20 : 15;
    const count = variant === 'card' ? 10 : 18;
    return generatePositions(count, minDistance);
  }, [variant]);

  const decorations = useMemo(() => {
    const config =
      variant === 'card'
        ? { flower: 2, tulip: 2, bouquet: 2, sun: 2, butterfly: 2, sparkle: 2, heart: 2 }
        : { flower: 3, tulip: 3, bouquet: 3, sun: 3, butterfly: 4, sparkle: 4, heart: 3 };

    const decorationTypes = [
      { type: 'flower', emoji: '🌸', animation: 'bounce-subtle', count: config.flower },
      { type: 'tulip', emoji: '🌷', animation: 'swing-subtle', count: config.tulip },
      { type: 'bouquet', emoji: '💐', animation: 'float-subtle', count: config.bouquet },
      { type: 'sun', emoji: '☀️', animation: 'twinkle-subtle', count: config.sun },
      { type: 'butterfly', emoji: '🦋', animation: 'flutter-subtle', count: config.butterfly },
      { type: 'sparkle', emoji: '✨', animation: 'twinkle-subtle', count: config.sparkle },
      { type: 'heart', emoji: '💖', animation: 'float-subtle', count: config.heart },
    ];

    return decorationTypes.flatMap(({ type, emoji, animation, count }) =>
      Array.from({ length: count }, () => ({ type, emoji, animation }))
    );
  }, [variant]);

  const fallingPetals = useMemo(() => {
    if (!showFallingPetals) return [];

    const petals = ['🌸', '🌷', '💐', '🦋', '✨'];
    const petalCount = 10;

    return Array.from({ length: petalCount }, (_, i) => ({
      emoji: petals[i % petals.length],
      left: `${10 + Math.random() * 80}%`,
      animationDelay: `${i * 1.5}s`,
      animationDuration: `${8 + Math.random() * 3}s`,
      fontSize: `${18 + Math.random() * 8}px`,
      opacity: 0.35 + Math.random() * 0.15,
    }));
  }, [showFallingPetals]);

  return (
    <>
      <div
        className={`march8-decorations-container ${variant === 'page' ? 'page-variant' : ''}`}
      >
        {decorations.map((decoration, index) => {
          const position = positions[index];
          const animationDelay = `${(index * 0.5).toFixed(1)}s`;
          return (
            <div
              key={`${decoration.type}-${index}`}
              className={`march8-decoration ${decoration.type}`}
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
      {showFallingPetals && (
        <div className="falling-petals-layer">
          {fallingPetals.map((petal, index) => (
            <div
              key={index}
              className="petal"
              style={{
                left: petal.left,
                animationDelay: petal.animationDelay,
                animationDuration: petal.animationDuration,
                fontSize: petal.fontSize,
                opacity: petal.opacity,
              }}
            >
              {petal.emoji}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
