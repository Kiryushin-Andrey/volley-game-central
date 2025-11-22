import React, { useState, useRef, useEffect } from 'react';
import { GameCategory, getCategoryDisplayName } from '../utils/gameDateUtils';
import CategoryInfoIcon from './CategoryInfoIcon';
import './CategoryMultiSelect.scss';

interface CategoryMultiSelectProps {
  selectedCategories: GameCategory[];
  availableCategories: GameCategory[];
  onToggleCategory: (category: GameCategory) => void;
}

const CategoryMultiSelect: React.FC<CategoryMultiSelectProps> = ({
  selectedCategories,
  availableCategories,
  onToggleCategory,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getDisplayText = () => {
    if (selectedCategories.length === 0) {
      return 'Select categories';
    }
    if (selectedCategories.length === 1) {
      return getCategoryDisplayName(selectedCategories[0]);
    }
    return `${selectedCategories.length} categories selected`;
  };

  const handleToggle = (category: GameCategory) => {
    onToggleCategory(category);
  };

  return (
    <div className="category-multiselect" ref={dropdownRef}>
      <div className="category-multiselect-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="category-multiselect-value">
          {selectedCategories.length === 1 && selectedCategories[0] !== 'other' && (
            <CategoryInfoIcon category={selectedCategories[0]} />
          )}
          <span>{getDisplayText()}</span>
        </div>
        <span className={`category-multiselect-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="category-multiselect-dropdown">
          {availableCategories.map((category) => {
            const isChecked = selectedCategories.includes(category);
            return (
              <label key={category} className="category-multiselect-option">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(category)}
                />
                <span className="category-multiselect-checkbox">
                  {isChecked && '✓'}
                </span>
                {category !== 'other' && <CategoryInfoIcon category={category} />}
                <span className="category-multiselect-label">
                  {getCategoryDisplayName(category)}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryMultiSelect;