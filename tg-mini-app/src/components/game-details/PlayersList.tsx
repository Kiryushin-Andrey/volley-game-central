import React from 'react';
import { GameRegistration, UserPublicInfo } from '../../types';
import { FaCheck, FaTimes, FaUser } from 'react-icons/fa';
import { GiVolleyballBall } from 'react-icons/gi';
import RemovePlayerButton from './RemovePlayerButton';

interface Props {
  registrations: GameRegistration[];
  currentUserId: number;
  isAdmin: boolean;
  isPastGame: boolean;
  isReadonly?: boolean;
  isActionLoading: boolean;
  isPaidUpdating: number | null;
  hasPaymentRequests?: boolean;
  onRemovePlayer: (userId: number, guestName?: string) => void | Promise<void>;
  onTogglePaidStatus: (userId: number, paid: boolean) => void;
  canUnregister: boolean;
  onShowUserInfo?: (user: UserPublicInfo) => void;
}

export const PlayersList: React.FC<Props> = ({
  registrations,
  currentUserId,
  isAdmin,
  isPastGame,
  isReadonly,
  isActionLoading,
  isPaidUpdating,
  hasPaymentRequests,
  onRemovePlayer,
  onTogglePaidStatus,
  canUnregister: canUnregister,
  onShowUserInfo,
}) => {
  return (
    <div className="players-list">
      {registrations.map((registration) => (
        <div key={registration.id} className="player-item">
          <div className="player-info">
            <div
              className={`player-avatar ${
                isAdmin && registration.user ? 'clickable' : ''
              }`}
              onClick={() => {
                if (isAdmin && registration.user && onShowUserInfo) {
                  onShowUserInfo(registration.user);
                }
              }}
            >
              {registration.guestName ? (
                <div className="avatar-placeholder guest-avatar">
                  <FaUser className="guest-icon" />
                </div>
              ) : registration.user?.avatarUrl ? (
                <img
                  src={registration.user.avatarUrl}
                  alt={`${registration.user.displayName}'s avatar`}
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-placeholder">
                  {(registration.user?.displayName || registration.user?.telegramUsername || `Player ${registration.userId}`).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div
              className={`player-details ${
                isAdmin && registration.user ? 'clickable' : ''
              }`}
              onClick={() => {
                if (isAdmin && registration.user && onShowUserInfo) {
                  onShowUserInfo(registration.user);
                }
              }}
            >
              <div className="player-name">
                {registration.guestName || registration.user?.displayName || registration.user?.telegramUsername || `Player ${registration.userId}`}
                {!isPastGame && registration.bringingTheBall && (
                  <GiVolleyballBall 
                    className="volleyball-icon" 
                    title="Bringing the ball" 
                    aria-label="Bringing the ball"
                  />
                )}
              </div>
              {registration.guestName && (
                <div className="invited-by">
                  <div className="inviter-avatar">
                    {registration.user?.avatarUrl ? (
                      <img
                        src={registration.user.avatarUrl}
                        alt={`${registration.user.displayName}'s avatar`}
                        className="inviter-avatar-image"
                      />
                    ) : (
                      <div className="inviter-avatar-placeholder">
                        {(registration.user?.displayName || registration.user?.telegramUsername || `Player ${registration.userId}`).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="invited-by-text">
                    Invited by {registration.user?.displayName || registration.user?.telegramUsername || `Player ${registration.userId}`}
                  </span>
                </div>
              )}
            </div>
            {registration.userId === currentUserId && (() => {
              const isSelf = !registration.guestName;
              const isDisabled = isActionLoading;
              const tooltip = isActionLoading
                ? 'Please wait, action in progress'
                : (isSelf ? 'Leave this game' : 'Unregister this guest');
              const aria = isSelf ? 'Unregister yourself' : `Unregister guest ${registration.guestName}`;
              return (
                <div className="self-actions">
                  {isSelf && <div className="player-badge">You</div>}
                  {!isPastGame && canUnregister && (
                    <div className="admin-player-actions" title={tooltip}>
                      <RemovePlayerButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePlayer(registration.userId, isSelf ? undefined : registration.guestName!);
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

            {isAdmin && (isPastGame || isReadonly) && !registration.isWaitlist && (
              <div className="admin-player-actions">
                {!hasPaymentRequests && (
                  <RemovePlayerButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePlayer(registration.userId, registration.guestName || undefined);
                    }}
                    title="Remove player"
                    disabled={isActionLoading}
                  />
                )}

                {!hasPaymentRequests && (
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
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};


