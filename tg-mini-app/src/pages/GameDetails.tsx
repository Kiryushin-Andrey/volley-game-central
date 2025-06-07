import React, { useCallback, useEffect, useState, useRef } from 'react';
import { logDebug } from '../debug';
import { useParams, useNavigate } from 'react-router-dom';
import { Game, User } from '../types';
import { gamesApi } from '../services/api';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import LoadingSpinner from '../components/LoadingSpinner';
import './GameDetails.scss';
import WebApp from '@twa-dev/sdk';

interface GameDetailsProps {
  user: User;
}

const GameDetails: React.FC<GameDetailsProps> = ({ user }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { showMainButton, hideMainButton, showBackButton, hideBackButton, isTelegramWebApp } = useTelegramWebApp();
    
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
  }, [game, user, isLoading, isActionLoading, error, showMainButton, hideMainButton]);

  // Track last action time to prevent duplicate clicks
  const lastActionTimeRef = useRef<number>(0);
  const ACTION_DEBOUNCE_MS = 1000; // 1 second debounce
  
  // Debounce function to prevent multiple rapid calls
  const isActionAllowed = () => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < ACTION_DEBOUNCE_MS) {
      logDebug('Action debounced - ignoring duplicate click');
      return false;
    }
    lastActionTimeRef.current = now;
    return true;
  };

  // Make sure updateMainButton has access to all dependencies
  // This is safer than relying on closure scope
  const updateMainButton = useCallback(() => {
    // Always hide button during loading states
    if (!game || isLoading || isActionLoading) {
      hideMainButton();
      return;
    }

    // Don't show action buttons if there's an error
    if (error) {
      hideMainButton();
      return;
    }

    // Find user's registration if any
    const userRegistration = game.registrations.find(reg => reg.userId === user.id);
    
    if (userRegistration) {
      // Check if user can leave the game (up to 6 hours before or anytime if waitlisted)
      if (canLeaveGame(game.dateTime, userRegistration.isWaitlist)) {
        // Set button to Leave mode with debounced handler
        showMainButton('Leave Game', () => {
          if (isActionAllowed()) {
            handleUnregister();
          }
        });
      } else {
        hideMainButton();
      }
    } else {
      // Check if user can join the game (starting 5 days before)
      if (canJoinGame(game.dateTime)) {
        // Set button to Join mode with debounced handler
        showMainButton('Join Game', () => {
          if (isActionAllowed()) {
            handleRegister();
          }
        });
      } else {
        hideMainButton();
      }
    }
  }, [game, user, isLoading, isActionLoading, error, hideMainButton, showMainButton]);

  const loadGame = async (id: number) => {
    try {
      setIsLoading(true);
      const fetchedGame = await gamesApi.getGame(id);
      setGame(fetchedGame);
    } catch (err) {
      setError('Failed to load game details');
      logDebug('Error loading game:');
      logDebug(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Match timing restrictions with the server
  const canJoinGame = (gameDate: string): boolean => {
    const gameDateTime = new Date(gameDate);
    const now = new Date();
    
    // Can join starting 6 days before the game (same as server)
    const sixDaysBeforeGame = new Date(gameDateTime.getTime());
    sixDaysBeforeGame.setDate(sixDaysBeforeGame.getDate() - 6);
    
    return now >= sixDaysBeforeGame;
  };
  
  const canLeaveGame = (gameDate: string, isWaitlist: boolean): boolean => {
    // Waitlist players can leave at any time
    if (isWaitlist) {
      return true;
    }
    
    const gameDateTime = new Date(gameDate);
    const now = new Date();
    
    // Active players can leave up to 6 hours before the game (same as server)
    const sixHoursBeforeGame = new Date(gameDateTime.getTime());
    sixHoursBeforeGame.setHours(sixHoursBeforeGame.getHours() - 6);
    
    return now <= sixHoursBeforeGame;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if the date is today or tomorrow
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
    } else {
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const handleRegister = async () => {
    if (!game || isActionLoading) return;

    try {
      setIsActionLoading(true);
      // Hide the button to prevent multiple clicks
      hideMainButton();
      
      await gamesApi.registerForGame(game.id);
      // Reload game data to get updated registrations
      await loadGame(game.id);
    } catch (err: any) {
      logDebug('Error registering for game:');
      logDebug(err);
      
      // Handle specific timing restriction errors from server
      if (err.response?.status === 403) {
        const errData = err.response?.data;
        if (errData?.registrationOpensAt) {
          const openDate = new Date(errData.registrationOpensAt);
          alert(`Registration is only possible starting ${openDate.toLocaleDateString()} (6 days before the game).`);
        } else {
          alert('You cannot register for this game yet due to timing restrictions.');
        }
      } else {
        alert('Failed to register for game. Please try again.');
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnregister = () => {
    if (!game || isActionLoading) return;
  
    WebApp.showPopup({
      title: 'Leave Game',
      message: 'Are you sure you want to leave this game?',
      buttons: [
        {
          id: 'cancel',
          type: 'cancel'
        },
        {
          id: 'leave',
          type: 'destructive',
          text: 'Leave Game'
        }
      ]
    }, (buttonId) => {
      if (buttonId === 'leave') {
        // User confirmed leaving the game
        performUnregistration();
      } else {
        // User cancelled, restore the main button
        updateMainButton();
      }
    });
  };
  
  const performUnregistration = async () => {
    if (!game) return;
    
    try {
      setIsActionLoading(true);
      // Hide the button to prevent multiple clicks
      hideMainButton();
      
      await gamesApi.unregisterFromGame(game.id);
      // Reload game data to get updated registrations
      await loadGame(game.id);
    } catch (err: any) {
      logDebug('Error unregistering from game:');
      logDebug(err);
      
      // Handle specific timing restriction errors from server
      if (err.response?.status === 403) {
        const errData = err.response?.data;
        if (errData?.error?.includes('time restriction')) {
          const gameTime = new Date(game.dateTime);
          const deadline = new Date(gameTime.getTime() - 6 * 60 * 60 * 1000);
          
          WebApp.showPopup({
            title: 'Cannot Leave Game',
            message: `You can only unregister up to ${deadline.toLocaleTimeString()} (6 hours before the game starts).`,
            buttons: [
              { type: 'ok' }
            ]
          });
        } else {
          WebApp.showPopup({
            title: 'Error',
            message: typeof err === 'string' ? err : err.message || 'Failed to leave the game',
            buttons: [
              { type: 'ok' }
            ]
          });
        }
      } else {
        WebApp.showPopup({
          title: 'Error',
          message: typeof err === 'string' ? err : err.message || 'Failed to leave the game',
          buttons: [
            { type: 'ok' }
          ]
        });
      }
      updateMainButton();
    } finally {
      setIsActionLoading(false);
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

  return (
    <div className="game-details-container">
      <header className="game-header">
        <div className="game-date">
          {formatDate(game.dateTime)}
        </div>
        {userRegistration && (
          <div className={`user-status ${userRegistration.isWaitlist ? 'waitlist' : 'registered'}`}>
            {userRegistration.isWaitlist ? 'You are on the waitlist' : 'You are registered'}
          </div>
        )}
      </header>

      <div className="players-container">
        <div className="players-stats-header">
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
        </div>

        {activeRegistrations.length > 0 ? (
          <div className="players-section">
            <h2>Registered Players</h2>
            <div className="players-list">
              {activeRegistrations.map((registration) => (
                <div key={registration.id} className="player-item">
                  <div className="player-info">
                    <div className="player-name">{registration.user?.username || `Player ${registration.userId}`}</div>
                    {registration.userId === user.id && (
                      <div className="player-badge">You</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {waitlistRegistrations.length > 0 && (
          <div className="players-section waitlist-section">
            <h2>Waiting List</h2>
            <div className="players-list">
              {waitlistRegistrations.map((registration) => (
                <div key={registration.id} className="player-item waitlist">
                  <div className="player-info">
                    <div className="player-name">{registration.user?.username || `Player ${registration.userId}`}</div>
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
      </div>

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
