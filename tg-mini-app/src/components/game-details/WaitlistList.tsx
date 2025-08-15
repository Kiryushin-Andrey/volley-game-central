import React from 'react';
import { GameRegistration } from '../../types';
import RemovePlayerButton from './RemovePlayerButton';

interface Props {
  registrations: GameRegistration[];
  currentUserId: number;
  onRemovePlayer?: (userId: number, guestName?: string) => void | Promise<void>;
}

export const WaitlistList: React.FC<Props> = ({ registrations, currentUserId, onRemovePlayer }) => {
  return (
    <div className="players-list">
      {registrations.map((registration) => (
        <div key={registration.id} className="player-item waitlist">
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
            <div className="player-name">
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


