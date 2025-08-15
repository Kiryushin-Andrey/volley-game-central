import React from 'react';
import { GameRegistration } from '../../types';
import { FaCheck, FaTimes, FaUser } from 'react-icons/fa';
import RemovePlayerButton from './RemovePlayerButton';

interface Props {
  registrations: GameRegistration[];
  currentUserId: number;
  isAdmin: boolean;
  isPastGame: boolean;
  isActionLoading: boolean;
  fullyPaid: boolean;
  isPaidUpdating: number | null;
  onRemovePlayer: (userId: number, guestName?: string) => void | Promise<void>;
  onTogglePaidStatus: (userId: number, paid: boolean) => void;
  canUnregister: () => boolean;
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
  canUnregister: canUnregister,
}) => {
  return (
    <div className="players-list">
      {registrations.map((registration) => (
        <div key={registration.id} className="player-item">
          <div className="player-info">
            <div className="player-avatar">
              {registration.guestName ? (
                <div className="avatar-placeholder guest-avatar">
                  <FaUser className="guest-icon" />
                </div>
              ) : registration.user?.avatarUrl ? (
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
            <div className="player-details">
              <div className="player-name">
                {registration.guestName || registration.user?.username || `Player ${registration.userId}`}
              </div>
              {registration.guestName && (
                <div className="invited-by">
                  <div className="inviter-avatar">
                    {registration.user?.avatarUrl ? (
                      <img
                        src={registration.user.avatarUrl}
                        alt={`${registration.user.username}'s avatar`}
                        className="inviter-avatar-image"
                      />
                    ) : (
                      <div className="inviter-avatar-placeholder">
                        {(registration.user?.username || `Player ${registration.userId}`).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="invited-by-text">
                    Invited by {registration.user?.username || `Player ${registration.userId}`}
                  </span>
                </div>
              )}
            </div>
            {registration.userId === currentUserId && (() => {
              const isSelf = !registration.guestName;
              const allowed = canUnregister();
              const isDisabled = isActionLoading || !allowed;
              const tooltip = isActionLoading
                ? 'Please wait, action in progress'
                : allowed
                  ? (isSelf ? 'Leave this game' : 'Unregister this guest')
                  : 'Unregistration is not allowed after the deadline';
              const aria = isSelf ? 'Unregister yourself' : `Unregister guest ${registration.guestName}`;
              return (
                <div className="self-actions">
                  {isSelf && <div className="player-badge">You</div>}
                  {!isPastGame && (
                    <div className="admin-player-actions" title={tooltip}>
                      <RemovePlayerButton
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allowed) onRemovePlayer(registration.userId, isSelf ? undefined : registration.guestName!);
                        }}
                        disabled={isDisabled}
                        title={tooltip}
                        ariaLabel={aria}
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {isAdmin && isPastGame && !registration.isWaitlist && (
              <div className="admin-player-actions">
                {!fullyPaid && !registration.paid && (
                  <RemovePlayerButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePlayer(registration.userId, registration.guestName || undefined);
                    }}
                    title="Remove player"
                    disabled={isActionLoading}
                  />
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


