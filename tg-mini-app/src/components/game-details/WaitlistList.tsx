import React from 'react';
import { GameRegistration } from '../../types';

interface Props {
  registrations: GameRegistration[];
  currentUserId: number;
}

export const WaitlistList: React.FC<Props> = ({ registrations, currentUserId }) => {
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
            <div className="player-name">{registration.user?.username || `Player ${registration.userId}`}</div>
            {registration.userId === currentUserId && (
              <div className="player-badge waitlist">You</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};


