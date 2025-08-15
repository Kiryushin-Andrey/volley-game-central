import React from 'react';
import { GameRegistration, UserPublicInfo } from '../../types';
import RemovePlayerButton from './RemovePlayerButton';

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
            <div
              className={`player-name ${isAdmin && !registration.guestName && registration.user ? 'clickable' : ''}`}
              onClick={() => {
                if (isAdmin && !registration.guestName && registration.user && onShowUserInfo) {
                  onShowUserInfo(registration.user);
                }
              }}
            >
              {registration.guestName || registration.user?.username || `Player ${registration.userId}`}
            </div>
            {registration.userId === currentUserId && !registration.guestName && (
              <>
                <div className="player-badge waitlist">You</div>
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
              </>
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


