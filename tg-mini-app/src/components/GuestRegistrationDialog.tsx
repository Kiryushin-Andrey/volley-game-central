import React, { useState, useEffect } from 'react';
import { FiChevronRight, FiChevronDown } from 'react-icons/fi';
import './GuestRegistrationDialog.scss';

interface GuestRegistrationDialogProps {
  isOpen: boolean;
  defaultGuestName?: string;
  onSubmit: (guestName: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
  error?: string;
}

const GuestRegistrationDialog: React.FC<GuestRegistrationDialogProps> = ({
  isOpen,
  defaultGuestName = '',
  onSubmit,
  onCancel,
  isProcessing,
  error
}) => {
  const [guestName, setGuestName] = useState('');
  const [isDisclaimerExpanded, setIsDisclaimerExpanded] = useState(false);

  // Update guest name when dialog opens with new default
  useEffect(() => {
    if (isOpen) {
      setGuestName(defaultGuestName);
    }
  }, [isOpen, defaultGuestName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim() && !isProcessing) {
      onSubmit(guestName.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isProcessing) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="guest-dialog-overlay" onKeyDown={handleKeyDown}>
      <div className="guest-dialog">
        <form onSubmit={handleSubmit} className="guest-form">
          <div className="form-group">
            <label htmlFor="guestName">Guest Name:</label>
            <input
              id="guestName"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter guest name"
              disabled={isProcessing}
              autoFocus
              maxLength={255}
            />
          </div>

          <div
            className="guest-disclaimer"
            onClick={() => setIsDisclaimerExpanded(!isDisclaimerExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsDisclaimerExpanded((prev) => !prev);
              }
            }}
          >
            <div
              className={`disclaimer-header ${isDisclaimerExpanded ? 'expanded' : ''}`}
              role="button"
              aria-expanded={isDisclaimerExpanded}
              tabIndex={0}
            >
              Guest invitation rules
              <span className={`expand-icon ${isDisclaimerExpanded ? 'expanded' : ''}`} aria-hidden="true">
                {isDisclaimerExpanded ? <FiChevronDown /> : <FiChevronRight />}
              </span>
            </div>
            {isDisclaimerExpanded && (
              <ul>
                <li><strong>Payment:</strong> You'll get one payment request covering you and all your guests.</li>
                <li><strong>Keep them informed:</strong> Make sure to tell your guests about the game details, time, location, and whether they're confirmed or waitlisted.</li>
                <li><strong>Separate spots:</strong> Each guest gets their own spot in the players list. Your guest might end up on the waitlist if the game is already full. If the game fills up, you might get in while your guest doesn't (or vice versa).</li>
              </ul>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="dialog-buttons">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing || !guestName.trim()}
              className="submit-button"
            >
              {isProcessing ? 'Registering...' : 'Register Guest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GuestRegistrationDialog;
