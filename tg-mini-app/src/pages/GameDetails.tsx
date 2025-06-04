import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Game, GameRegistration, User } from '../types';
import { gamesApi } from '../services/api';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import LoadingSpinner from '../components/LoadingSpinner';
import './GameDetails.scss';

interface GameDetailsProps {
  user: User;
}

const GameDetails: React.FC<GameDetailsProps> = ({ user }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { showMainButton, hideMainButton, showBackButton, hideBackButton } = useTelegramWebApp();
  
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gameId) {
      loadGame(parseInt(gameId));
    }
  }, [gameId]);

  useEffect(() => {
    // Show back button
    showBackButton(() => {
      navigate('/');
    });

    return () => {
      hideBackButton();
      hideMainButton();
    };
  }, [navigate, showBackButton, hideBackButton, hideMainButton]);

  useEffect(() => {
    if (game && user) {
      updateMainButton();
    }
  }, [game, user, isActionLoading]);

  const loadGame = async (id: number) => {
    try {
      setIsLoading(true);
      const fetchedGame = await gamesApi.getGame(id);
      setGame(fetchedGame);
    } catch (err) {
      setError('Failed to load game details');
      console.error('Error loading game:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMainButton = () => {
    if (!game || isActionLoading) {
      hideMainButton();
      return;
    }

    const userRegistration = game.registrations.find(reg => reg.userId === user.id);
    
    if (userRegistration) {
      showMainButton('Unregister', handleUnregister);
    } else {
      showMainButton('Join Game', handleRegister);
    }
  };

  const handleRegister = async () => {
    if (!game || isActionLoading) return;

    try {
      setIsActionLoading(true);
      await gamesApi.registerForGame(game.id, user.id);
      // Reload game data to get updated registrations
      await loadGame(game.id);
    } catch (err) {
      console.error('Error registering for game:', err);
      alert('Failed to register for game. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnregister = async () => {
    if (!game || isActionLoading) return;

    try {
      setIsActionLoading(true);
      await gamesApi.unregisterFromGame(game.id, user.id);
      // Reload game data to get updated registrations
      await loadGame(game.id);
    } catch (err) {
      console.error('Error unregistering from game:', err);
      alert('Failed to unregister from game. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isTomorrow) {
      return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'long', 
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !game) {
    return (
      <div className="game-details-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error || 'Game not found'}</p>
          <button onClick={() => navigate('/')} className="back-button">
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  const activeRegistrations = game.registrations.filter(reg => !reg.isWaitlist);
  const waitlistRegistrations = game.registrations.filter(reg => reg.isWaitlist);
  const userRegistration = game.registrations.find(reg => reg.userId === user.id);
  const isFull = activeRegistrations.length >= game.maxPlayers;

  return (
    <div className="game-details-container">
      <header className="game-header">
        <h1>Game Details</h1>
        <div className="game-date">
          {formatDate(game.dateTime)}
        </div>
        {userRegistration && (
          <div className={`user-status ${userRegistration.isWaitlist ? 'waitlist' : 'registered'}`}>
            {userRegistration.isWaitlist ? 'You are on the waitlist' : 'You are registered'}
          </div>
        )}
      </header>

      <div className="game-stats-card">
        <div className="stats-row">
          <div className="stat">
            <div className="stat-value">{activeRegistrations.length}</div>
            <div className="stat-label">Registered Players</div>
          </div>
          <div className="stat-divider">/</div>
          <div className="stat">
            <div className="stat-value">{game.maxPlayers}</div>
            <div className="stat-label">Maximum Players</div>
          </div>
        </div>
        
        {waitlistRegistrations.length > 0 && (
          <div className="waitlist-stats">
            <div className="stat waitlist">
              <div className="stat-value">{waitlistRegistrations.length}</div>
              <div className="stat-label">On Waitlist</div>
            </div>
          </div>
        )}

        <div className="availability-indicator">
          <div className={`status-badge ${isFull ? 'full' : 'available'}`}>
            {isFull ? 'Game Full' : 'Spots Available'}
          </div>
        </div>
      </div>

      {activeRegistrations.length > 0 && (
        <div className="players-section">
          <h2>Registered Players</h2>
          <div className="players-list">
            {activeRegistrations.map((registration, index) => (
              <div key={registration.id} className="player-item">
                <div className="player-number">{index + 1}</div>
                <div className="player-info">
                  <div className="player-name">Player {registration.userId}</div>
                  {registration.userId === user.id && (
                    <div className="player-badge">You</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {waitlistRegistrations.length > 0 && (
        <div className="players-section waitlist-section">
          <h2>Waiting List</h2>
          <div className="players-list">
            {waitlistRegistrations.map((registration, index) => (
              <div key={registration.id} className="player-item waitlist">
                <div className="player-number">{index + 1}</div>
                <div className="player-info">
                  <div className="player-name">Player {registration.userId}</div>
                  {registration.userId === user.id && (
                    <div className="player-badge waitlist">You</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeRegistrations.length === 0 && waitlistRegistrations.length === 0 && (
        <div className="no-players">
          <h2>No players registered yet</h2>
          <p>Be the first to join this game!</p>
        </div>
      )}

      {isActionLoading && (
        <div className="action-loading">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
};

export default GameDetails;
