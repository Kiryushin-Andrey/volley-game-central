import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackButton } from '@twa-dev/sdk/react';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { isGlobalAdmin, isTcOnly } from '../utils/userRoles';
import { isTelegramApp } from '../utils/telegram';
import './PlayersHub.scss';

const PlayersHub: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  useEffect(() => {
    if (user && !isGlobalAdmin(user)) {
      navigate(isTcOnly(user) ? '/player-levels' : '/');
    }
  }, [user, navigate]);

  if (user && !isGlobalAdmin(user)) {
    return null;
  }

  return (
    <div className="players-hub">
      <div className="players-hub-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <h1>Players</h1>
      </div>
      <nav className="players-hub-links" aria-label="Players administration">
        <Link to="/game-administrators" className="players-hub-link">
          Game administrators
        </Link>
        <Link to="/player-levels" className="players-hub-link">
          Player levels
        </Link>
      </nav>
    </div>
  );
};

export default PlayersHub;
