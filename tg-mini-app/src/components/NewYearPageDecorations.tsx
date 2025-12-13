import React, { useMemo } from 'react';
import { NewYearDecorations } from './NewYearDecorations';

interface FallingSnowflake {
  emoji: string;
  left: string;
  animationDelay: string;
  animationDuration: string;
  fontSize: string;
  opacity: number;
}

export const NewYearPageDecorations: React.FC = () => {
  // Generate random positions for falling snowflakes
  const fallingSnowflakes = useMemo<FallingSnowflake[]>(() => {
    const snowflakes = ['❄️'];
    const snowflakeCount = 20; // Increased from 8 to 20
    
    return Array.from({ length: snowflakeCount }, () => ({
      emoji: snowflakes[0],
      left: `${5 + Math.random() * 90}%`, // Random position between 5-95%
      animationDelay: `${Math.random() * 5}s`, // Random delay 0-5s
      animationDuration: `${4 + Math.random() * 6}s`, // Varying speed: 4-10s
      fontSize: `${12 + Math.random() * 16}px`, // Varying sizes: 12-28px
      opacity: 0.4 + Math.random() * 0.3, // 0.4-0.7
    }));
  }, []);
  return (
    <>
      <div className="christmas-tree-background">🎄</div>
      <div className="large-gift-boxes">
        <div className="large-gift">🎁</div>
        <div className="large-gift">🎁</div>
      </div>
      <div className="twinkling-stars">
        <div className="star">⭐</div>
        <div className="star">⭐</div>
        <div className="star">⭐</div>
        <div className="star">⭐</div>
        <div className="star">⭐</div>
        <div className="star">⭐</div>
        <div className="star">⭐</div>
        <div className="star">⭐</div>
      </div>
      <NewYearDecorations variant="page" />
      <div className="falling-snowflakes-layer">
        {fallingSnowflakes.map((snowflake, index) => (
          <div
            key={index}
            className="snowflake"
            style={{
              left: snowflake.left,
              animationDelay: snowflake.animationDelay,
              animationDuration: snowflake.animationDuration,
              fontSize: snowflake.fontSize,
              opacity: snowflake.opacity,
            }}
          >
            {snowflake.emoji}
          </div>
        ))}
      </div>
    </>
  );
};

