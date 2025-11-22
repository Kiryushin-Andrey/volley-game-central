import React, { memo, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import './CategoryInfoBlock.scss';

type GameCategory = 'thursday-5-1' | 'thursday-deti-plova' | 'sunday' | 'other';

interface CategoryInfoBlockProps {
  category: string;
}

const getCategoryDescription = (cat: GameCategory): string => {
  const registrationRules = `

Priority registration is given to players who consistently attend and have a good track record. Registration opens 10 days before the game for priority players, and 3 days before for everyone else.

Payment is required via Bunq within 24 hours of registration to confirm your spot.`;

  switch (cat) {
    case 'thursday-5-1':
      return 'Thursday games with a 5-1 system (one designated setter). More competitive format with assigned positions and rotations. Recommended for experienced players familiar with volleyball positions and rotation rules.' + 
        registrationRules;
    case 'thursday-deti-plova':
      return 'The second hall on Thursdays is used 2 times per month. The first and third Thursday of the month. First and foremost, we use it for training (with a coach), and if there\'s time left, we play 1-2 games to practice the material we learned during training. Priority registration is given to the Deti Plova team (registration opens 10 days before the game). Open registration for everyone else for the remaining spots opens 3 days before the game.' + 
        registrationRules;
    case 'sunday':
      return 'Sunday games are casual and open to players of all levels. No fixed positions - players rotate freely. Great for beginners and those who prefer a more relaxed atmosphere. Focus is on fun and exercise rather than competitive play.' + 
        registrationRules;
    case 'other':
      return 'This game doesn\'t belong to a specific recurring series. Check the game details for more information.' + 
        registrationRules;
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