import React from 'react';
import { GameRegistration } from '../../types';
import { FaCheck, FaTimes } from 'react-icons/fa';

interface Props {
  registrations: GameRegistration[];
  currentUserId: number;
  isAdmin: boolean;
  isPastGame: boolean;
  isActionLoading: boolean;
  fullyPaid: boolean;
  isPaidUpdating: number | null;
  onRemovePlayer: (userId: number) => void;
  onTogglePaidStatus: (userId: number, paid: boolean) => void;
}

export const PlayersList: React.FC<Props> = ({
  registrations,
  currentUserId,
  isAdmin,
  isPastGame,
  isActionLoading,
  fullyPaid,
  isPaidUpdating,
  onRemovePlayer,
  onTogglePaidStatus,
}) => {
  return (
    <div className="players-list">
      {registrations.map((registration) => (
        <div key={registration.id} className="player-item">
          <div className="player-info">
            <div className="player-avatar">
              {registration.user?.avatarUrl ? (
                <img
                  src={registration.user.avatarUrl}
                  alt={`${registration.user.username}'s avatar`}
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-placeholder">
                  {(registration.user?.username || `Player ${registration.userId}`).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="player-name">{registration.user?.username || `Player ${registration.userId}`}</div>
            {registration.userId === currentUserId && <div className="player-badge">You</div>}

            {isAdmin && isPastGame && !registration.isWaitlist && (
              <div className="admin-player-actions">
                {!fullyPaid && !registration.paid && (
                  <button
                    className="remove-player-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePlayer(registration.userId);
                    }}
                    title="Remove player"
                    disabled={isActionLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                )}

                <div
                  className={`paid-status ${registration.paid ? 'paid' : 'unpaid'}`}
                  onClick={() => onTogglePaidStatus(registration.userId, registration.paid)}
                  aria-label={registration.paid ? 'Paid' : 'Not paid'}
                >
                  {isPaidUpdating === registration.userId ? (
                    <div className="mini-spinner"></div>
                  ) : registration.paid ? (
                    <FaCheck className="paid-icon" />
                  ) : (
                    <FaTimes className="unpaid-icon" />
                  )}
                  <span>{registration.paid ? 'Paid' : 'Unpaid'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};


