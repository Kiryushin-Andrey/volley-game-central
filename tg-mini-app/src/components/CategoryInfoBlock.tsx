import React, { memo, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import CategoryInfoIcon from './CategoryInfoIcon';
import './CategoryInfoBlock.scss';

interface CategoryInfoBlockProps {
  category: string;
}

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
        <CategoryInfoIcon
          category={category}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
});

export default CategoryInfoBlock;