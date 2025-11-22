import React, { memo, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import './CategoryInfoBlock.scss';

interface CategoryInfoBlockProps {
  category: string;
}

const CategoryInfoBlock = memo(({ category }: CategoryInfoBlockProps) => {
  const [showDialog, setShowDialog] = useState(false);
  
  const categoryInfo: Record<string, { short: string; full: string; withPositions: boolean }> = {
    'thursday-5-1': {
      short: 'Thursday: Competitive games with assigned positions (5-1 system)',
      full: 'Thursday games use the 5-1 volleyball system where players rotate through specific positions. This format is more competitive and requires understanding of positional play. Players should be comfortable with rotation rules and position-specific responsibilities.',
      withPositions: true
    },
    'thursday-deti-plova': {
      short: 'Thursday: Recreational games without assigned positions',
      full: 'Thursday Deti Plova games are casual, recreational volleyball sessions without fixed positions. Players can move freely and the focus is on fun and exercise rather than competitive play. Perfect for beginners and those who prefer a more relaxed atmosphere.',
      withPositions: false
    },
    'sunday': {
      short: 'Sunday: Recreational games without assigned positions',
      full: 'Sunday games are casual, recreational volleyball sessions without fixed positions. Players can move freely and the focus is on fun and exercise rather than competitive play. Perfect for beginners and those who prefer a more relaxed atmosphere.',
      withPositions: false
    }
  };
  
  const info = categoryInfo[category];
  if (!info) return null;
  
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
              <p>{info.full}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default CategoryInfoBlock;