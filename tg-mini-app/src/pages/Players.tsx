import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackButton } from '@twa-dev/sdk/react';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { isTelegramApp } from '../utils/telegram';
import './Players.scss';

const Players: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  if (user && !user.isAdmin) {
    return null;
  }

  return (
    <div className="players-hub">
      <div className="players-hub-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <h1>Players</h1>
      </div>
      <nav className="players-hub-links">
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

export default Players;
