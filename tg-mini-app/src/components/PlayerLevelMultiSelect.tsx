import React, { useState, useRef, useEffect } from 'react';
import type { PlayerLevelFilterOption } from '../utils/playerLevel';
import { PLAYER_LEVEL_FILTER_OPTIONS } from '../utils/playerLevel';
import './CategoryMultiSelect.scss';

interface PlayerLevelMultiSelectProps {
  selectedLevels: PlayerLevelFilterOption[];
  onToggleLevel: (level: PlayerLevelFilterOption) => void;
}

const PlayerLevelMultiSelect: React.FC<PlayerLevelMultiSelectProps> = ({
  selectedLevels,
  onToggleLevel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const labelFor = (value: PlayerLevelFilterOption) =>
    PLAYER_LEVEL_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value;

  const renderSelectedChips = () => {
    if (selectedLevels.length === 0) {
      return <span className="category-multiselect-placeholder">Select levels</span>;
    }

    return (
      <div className="category-multiselect-chips">
        {selectedLevels.map((level) => (
          <span key={level} className="category-multiselect-chip">
            <span className="category-multiselect-chip-label">{labelFor(level)}</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div
      className="category-multiselect"
      ref={dropdownRef}
      aria-label="Filter by level"
    >
      <div
        className="category-multiselect-trigger"
        onClick={() => setIsOpen(!isOpen)}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="category-multiselect-value">{renderSelectedChips()}</div>
        <span className={`category-multiselect-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="category-multiselect-dropdown" role="listbox">
          {PLAYER_LEVEL_FILTER_OPTIONS.map((option) => {
            const isChecked = selectedLevels.includes(option.value);
            return (
              <label key={option.value} className="category-multiselect-option">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleLevel(option.value)}
                />
                <span className="category-multiselect-checkbox">{isChecked && '✓'}</span>
                <span className="category-multiselect-label">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlayerLevelMultiSelect;
