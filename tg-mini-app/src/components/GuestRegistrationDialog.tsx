import React, { useState, useEffect } from 'react';
import { UserSearchInput } from './UserSearchInput';
import { FiChevronRight, FiChevronDown } from 'react-icons/fi';
import './GuestRegistrationDialog.scss';

interface GuestRegistrationDialogProps {
  isOpen: boolean;
  defaultGuestName?: string;
  onSubmit: (guestName: string, inviterUserId?: number) => void;
  onCancel: () => void;
  isProcessing: boolean;
  error?: string;
  /** Show inviter user selector (admin-only, past games) */
  allowInviterSelection?: boolean;
}

const GuestRegistrationDialog: React.FC<GuestRegistrationDialogProps> = ({
  isOpen,
  defaultGuestName = '',
  onSubmit,
  onCancel,
  isProcessing,
  error,
  allowInviterSelection = false,
}) => {
  const [guestName, setGuestName] = useState('');
  const [isDisclaimerExpanded, setIsDisclaimerExpanded] = useState(false);
  const [inviterUserId, setInviterUserId] = useState<number | null>(null);

  // Update guest name when dialog opens with new default
  useEffect(() => {
    if (isOpen) {
      setGuestName(defaultGuestName);
      setInviterUserId(null);
    }
  }, [isOpen, defaultGuestName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim() && !isProcessing) {
      // If inviter selection is required, ensure it's provided
      if (allowInviterSelection && inviterUserId == null) return;
      onSubmit(guestName.trim(), inviterUserId ?? undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isProcessing) {
      // Prevent Esc from bubbling to global handlers (e.g., Back navigation)
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="guest-dialog-overlay" onKeyDown={handleKeyDown}>
      <div className="guest-dialog">
        <form onSubmit={handleSubmit} className="guest-form">
          {allowInviterSelection && (
            <div className="form-group">
              <label>Invited by:</label>
              <UserSearchInput
                onSelectUser={(id) => setInviterUserId(id)}
                onCancel={() => setInviterUserId(null)}
                disabled={isProcessing}
                placeholder="Search user (inviter)..."
              />
            </div>
          )}
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

          {!allowInviterSelection && (
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
          )}

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
              disabled={
                isProcessing ||
                !guestName.trim() ||
                (allowInviterSelection && inviterUserId == null)
              }
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
