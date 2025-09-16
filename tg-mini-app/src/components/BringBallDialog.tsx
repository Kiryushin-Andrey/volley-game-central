import React from 'react';
import { GiVolleyballBall } from 'react-icons/gi';
import './BringBallDialog.scss';

interface BringBallDialogProps {
  isOpen: boolean;
  onSubmit: (bringingTheBall: boolean) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

const BringBallDialog: React.FC<BringBallDialogProps> = ({
  isOpen,
  onSubmit,
  onCancel,
  isProcessing = false,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isProcessing) {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isProcessing) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="bring-ball-dialog-overlay" 
      onKeyDown={handleKeyDown}
      onClick={handleOverlayClick}
    >
      <div className="bring-ball-dialog">
        <div className="dialog-header">
          <div className="dialog-icon">
            <GiVolleyballBall />
          </div>
          <h3>Will you bring a volleyball?</h3>
          <button
            type="button"
            className="close-btn"
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="dialog-content">
          <p className="encouragement-text">
            Hey! If you can, please consider bringing a volleyball with you. 
            We need about <strong>one ball per 4-5 people</strong> to make sure 
            everyone can warm up properly before the game and stay active during breaks. 
            Your help would be really appreciated! 🙏
          </p>
          
          <div className="dialog-buttons">
            <button
              className="no-button"
              onClick={() => onSubmit(false)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Registering...' : 'No, I won\'t bring one'}
            </button>
            <button
              className="yes-button"
              onClick={() => onSubmit(true)}
              disabled={isProcessing}
            >
              {isProcessing ? 'Registering...' : 'Yes, I\'ll bring one! 🏐'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BringBallDialog;
