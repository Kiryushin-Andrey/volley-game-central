import React from 'react';
import { GameRegistration, UserPublicInfo } from '../../types';
import RemovePlayerButton from './RemovePlayerButton';
import { FaUser } from 'react-icons/fa';

interface Props {
  registrations: GameRegistration[];
  currentUserId: number;
  isAdmin?: boolean;
  onRemovePlayer?: (userId: number, guestName?: string) => void | Promise<void>;
  onShowUserInfo?: (user: UserPublicInfo) => void;
}

export const WaitlistList: React.FC<Props> = ({ registrations, currentUserId, isAdmin, onRemovePlayer, onShowUserInfo }) => {
  return (
    <div className="players-list">
      {registrations.map((registration) => (
        <div key={registration.id} className="player-item waitlist">
          <div className="player-info">
            <div
              className={`player-avatar ${isAdmin && registration.user ? 'clickable' : ''}`}
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
              className={`player-details ${isAdmin && registration.user ? 'clickable' : ''}`}
              onClick={() => {
                if (isAdmin && registration.user && onShowUserInfo) {
                  onShowUserInfo(registration.user);
                }
              }}
            >
              <div className="player-name">
                {registration.guestName || registration.user?.displayName || registration.user?.telegramUsername || `Player ${registration.userId}`}
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

            {registration.userId === currentUserId && !registration.guestName && (
              <div className="self-actions">
                <div className="player-badge">You</div>
                {(() => {
                  const tooltip = 'Leave waitlist';
                  return (
                    <div className="admin-player-actions" title={tooltip}>
                      <RemovePlayerButton
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRemovePlayer) onRemovePlayer(registration.userId);
                        }}
                        title={tooltip}
                        disabled={false}
                        ariaLabel={`Unregister yourself from waitlist`}
                      />
                    </div>
                  );
                })()}
              </div>
            )}

            {registration.guestName && registration.userId === currentUserId && onRemovePlayer && (
              (() => {
                const tooltip = 'Unregister this guest';
                return (
                  <div className="admin-player-actions" title={tooltip}>
                    <RemovePlayerButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePlayer(registration.userId, registration.guestName!);
                      }}
                      title={tooltip}
                      disabled={false}
                      ariaLabel={`Unregister guest ${registration.guestName}`}
                    />
                  </div>
                );
              })()
            )}
          </div>
        </div>
      ))}
    </div>
  );
};


