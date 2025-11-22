import React, { memo, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import './CategoryInfoBlock.scss';

type GameCategory = 'thursday-5-1' | 'thursday-deti-plova' | 'sunday' | 'other';

interface CategoryInfoBlockProps {
  category: string;
}

const getCategoryDescription = (cat: GameCategory): string => {
  switch (cat) {
    case 'thursday-5-1':
      return `These are competitive games played on Thursday evenings with the 5-1 volleyball system. 
      In this format, there is one setter who rotates through all positions, and five hitters who also rotate. 
      This system requires players to understand rotational rules and be comfortable playing specific positions. 
      These games are more structured and competitive, ideal for experienced players who want to improve their skills 
      and enjoy strategic team play.`;
    
    case 'thursday-deti-plova':
      return `These are recreational games held on Thursday evenings at Deti Plova sports complex. 
      Unlike the 5-1 games, these sessions don't use fixed positions - players rotate freely and the atmosphere 
      is more casual. The focus is on having fun, getting exercise, and enjoying the game without the pressure 
      of competitive play. Perfect for beginners, intermediate players, or anyone who prefers a relaxed volleyball experience.`;
    
    case 'sunday':
      return `Sunday games are casual, recreational volleyball sessions without assigned positions. 
      Players of all skill levels are welcome, and the emphasis is on fun, social interaction, and staying active. 
      There's no strict rotation system, allowing players to move around and try different roles. 
      These games provide a great way to spend Sunday while meeting other volleyball enthusiasts in a friendly environment.`;
    
    case 'other':
      return 'This game does not belong to any specific category.';
    
    default:
      return 'No description available.';
  }
};

const CategoryInfoBlock = memo(({ category }: CategoryInfoBlockProps) => {
  const [showDialog, setShowDialog] = useState(false);
  
  const categoryInfo: Record<string, { short: string; withPositions: boolean }> = {
    'thursday-5-1': {
      short: 'Thursday: Competitive games with assigned positions (5-1 system)',
      withPositions: true
    },
    'thursday-deti-plova': {
      short: 'Thursday: Recreational games without assigned positions',
      withPositions: false
    },
    'sunday': {
      short: 'Sunday: Recreational games without assigned positions',
      withPositions: false
    }
  };
  
  const info = categoryInfo[category];
  if (!info) return null;
  
  const fullDescription = getCategoryDescription(category as GameCategory);
  const blockClassName = `category-info-block ${info.withPositions ? 'with-positions' : 'without-positions'}`;
  
  return (
    <>
      <div className={blockClassName}>
        <span className="category-info-text">{info.short}</span>
        <FaInfoCircle 
          className="category-info-icon" 
          onClick={() => setShowDialog(true)}
        />
      </div>
      {showDialog && (
        <div className="category-info-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="category-info-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="category-info-dialog-header">
              <h3>Game Category Information</h3>
              <button className="close-button" onClick={() => setShowDialog(false)}>×</button>
            </div>
            <div className="category-info-dialog-content">
              <p>{fullDescription}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default CategoryInfoBlock;