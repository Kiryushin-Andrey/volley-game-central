import React, { useCallback, useEffect, useState, useRef } from 'react';
import { logDebug } from '../debug';
import { useParams, useNavigate } from 'react-router-dom';
import { Game, User } from '../types';
import { gamesApi, bunqApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import PasswordDialog from '../components/PasswordDialog';
import './GameDetails.scss';
import WebApp from '@twa-dev/sdk';
import { MainButton, BackButton } from '@twa-dev/sdk/react';
import { FaCog, FaCheck, FaTimes } from 'react-icons/fa';
import { formatEuros } from '../utils/currencyUtils';
import { AxiosError } from 'axios';

interface GameDetailsProps {
  user: User;
}

const GameDetails: React.FC<GameDetailsProps> = ({ user }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
    
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaidUpdating, setIsPaidUpdating] = useState<number | null>(null); // Stores userId of player being updated
  const [hasBunqIntegration, setHasBunqIntegration] = useState<boolean>(false);
  const [isCheckingBunq, setIsCheckingBunq] = useState<boolean>(true);
  const [isSendingPaymentRequests, setIsSendingPaymentRequests] = useState<boolean>(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>('');

  useEffect(() => {
    if (gameId) {
      loadGame(parseInt(gameId));
    }
  }, [gameId]);

  // Check Bunq integration status for admin users
  useEffect(() => {
    const checkBunqIntegration = async () => {
      if (user.isAdmin) {
        try {
          const status = await bunqApi.getStatus();
          setHasBunqIntegration(status.enabled);
        } catch (error) {
          logDebug('Error checking Bunq integration status: ' + error);
          setHasBunqIntegration(false);
        }
      }
      setIsCheckingBunq(false);
    };

    checkBunqIntegration();
  }, [user.isAdmin]);

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

  // Determine if the main button should be shown and what text/action it should have
  const mainButtonProps = useCallback(() => {
    // No button during loading states or errors
    if (!game || isLoading || isActionLoading || error) {
      return { show: false };
    }

    // Find user's registration if any
    const userRegistration = game.registrations.find(reg => reg.userId === user.id);
    
    if (userRegistration) {
      // Check if user can leave the game (up to 5 hours before or anytime if waitlisted)
      if (canLeaveGame(game.dateTime, userRegistration.isWaitlist)) {
        return {
          show: true,
          text: 'Leave Game',
          onClick: () => {
            if (isActionAllowed()) {
              handleUnregister();
            }
          }
        };
      }
    } else {
      // Check if user can join the game (starting 5 days before)
      if (canJoinGame(game.dateTime)) {
        return {
          show: true,
          text: 'Join Game',
          onClick: () => {
            if (isActionAllowed()) {
              handleRegister();
            }
          }
        };
      }
    }
    
    // Default: don't show button
    return { show: false };
  }, [game, user, isLoading, isActionLoading, error]);

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
    
    // Can join starting 5 days before the game (same as server)
    const fiveDaysBeforeGame = new Date(gameDateTime.getTime());
    fiveDaysBeforeGame.setDate(fiveDaysBeforeGame.getDate() - 5);
    
    return now >= fiveDaysBeforeGame;
  };
  
  // Check if game is upcoming (for delete button visibility)
  const isGameUpcoming = (gameDate: string): boolean => {
    const gameDateTime = new Date(gameDate);
    const now = new Date();
    return gameDateTime > now;
  };
  
  // Check if game is in the past
  const isGamePast = (gameDate: string): boolean => {
    const gameDateTime = new Date(gameDate);
    const now = new Date();
    return gameDateTime < now;
  };
  
  const canLeaveGame = (gameDate: string, isWaitlist: boolean): boolean => {
    // Waitlist players can leave at any time
    if (isWaitlist) {
      return true;
    }
    
    const gameDateTime = new Date(gameDate);
    const now = new Date();
    
    // Get the configurable deadline hours from the game, default to 5 if not set
    const deadlineHours = game?.unregisterDeadlineHours || 5;
    
    // Active players can leave up to the configured deadline hours before the game
    const deadlineTime = new Date(gameDateTime.getTime());
    deadlineTime.setHours(deadlineTime.getHours() - deadlineHours);
    
    return now <= deadlineTime;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if the date is today or tomorrow
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    
    if (isToday) {
      return `Today, ${timeString}`;
    } else if (isTomorrow) {
      return `Tomorrow, ${timeString}`;
    } else {
      // Format as "8 June, Sunday, 17:00"
      const day = date.getDate();
      const month = date.toLocaleString('en-US', { month: 'long' });
      const weekday = date.toLocaleString('en-US', { weekday: 'long' });
      
      return `${day} ${month}, ${weekday}, ${timeString}`;
    }
  };

  // Get info text for timing restrictions
  const getInfoText = () => {
    if (!game) return null;

    const userRegistration = game.registrations.find(reg => reg.userId === user.id);
    const deadlineHours = game.unregisterDeadlineHours || 5;
    
    // If user is registered, check if they can leave
    if (userRegistration) {
      if (!isGamePast(game.dateTime) && !canLeaveGame(game.dateTime, userRegistration.isWaitlist) && !userRegistration.isWaitlist) {
        return `You can only leave the game up to ${deadlineHours} hours before it starts.`;
      }
    } else {
      // If user is not registered, check if they can join
      if (!canJoinGame(game.dateTime)) {
        const gameDateTime = new Date(game.dateTime);
        const fiveDaysBeforeGame = new Date(gameDateTime.getTime());
        fiveDaysBeforeGame.setDate(fiveDaysBeforeGame.getDate() - 5);
        return `Registration opens ${fiveDaysBeforeGame.toLocaleDateString()} (5 days before the game).`;
      }
    }
    
    return null;
  };

  const handleRegister = async () => {
    if (!game || isActionLoading) return;

    try {
      setIsActionLoading(true);
      await gamesApi.registerForGame(game.id);
      // Reload the game to get updated registration status
      await loadGame(game.id);
    } catch (err: any) {
      logDebug('Error registering for game:');
      logDebug(err);
      
      // Handle specific timing restriction errors from server
      if (err.response?.status === 403) {
        const errData = err.response?.data;
        if (errData?.registrationOpensAt) {
          const openDate = new Date(errData.registrationOpensAt);
          alert(`Registration is only possible starting ${openDate.toLocaleDateString()} (5 days before the game).`);
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
      } 
    });
  };
  
  const performUnregistration = async () => {
    if (!game) return;
    
    try {
      setIsActionLoading(true);
      await gamesApi.unregisterFromGame(game.id);
      // Reload game data to get updated registrations
      await loadGame(game.id);
    } catch (err: any) {
      logDebug('Error unregistering from game:');
      logDebug(err);
      
      // Handle specific timing restriction errors from server
      if (err.response?.status === 403) {
        const errData = err.response?.data;
        if (errData?.error?.includes('unregister')) {
          const gameTime = new Date(game.dateTime);
          const deadlineHours = game.unregisterDeadlineHours || 5; // Default to 5 if not set
          const deadline = new Date(gameTime.getTime() - deadlineHours * 60 * 60 * 1000);
          
          WebApp.showPopup({
            title: 'Cannot Leave Game',
            message: `You can only unregister up to ${deadline.toLocaleTimeString()} (${deadlineHours} hours before the game starts).`,
            buttons: [{ type: 'ok' }]
          });
        } else {
          WebApp.showPopup({
            title: 'Error',
            message: typeof err === 'string' ? err : err.message || 'Failed to leave the game',
            buttons: [{ type: 'ok' }]
          });
        }
      } else {
        WebApp.showPopup({
          title: 'Error',
          message: typeof err === 'string' ? err : err.message || 'Failed to leave the game',
          buttons: [{ type: 'ok' }]
        });
      }
    } finally {
      setIsActionLoading(false);
    }
  };
  
  // Handle toggling paid status for a player
  const handleTogglePaidStatus = (userId: number, currentPaidStatus: boolean) => {
    if (!game) return;
    
    const newPaidStatus = !currentPaidStatus;
    const username = game.registrations.find(reg => reg.userId === userId)?.user?.username || `Player ${userId}`;
    
    // Show confirmation dialog
    WebApp.showConfirm(
      `${newPaidStatus ? 'Mark' : 'Unmark'} ${username} as ${newPaidStatus ? 'paid' : 'unpaid'}?`,
      async (confirmed) => {
        if (confirmed) {
          try {
            setIsPaidUpdating(userId);
            await gamesApi.updatePlayerPaidStatus(game.id, userId, newPaidStatus);
            
            // Update local state to reflect the change
            setGame(prevGame => {
              if (!prevGame) return null;
              
              return {
                ...prevGame,
                registrations: prevGame.registrations.map(reg => 
                  reg.userId === userId ? { ...reg, paid: newPaidStatus } : reg
                )
              };
            });
          } catch (err) {
            logDebug('Error updating paid status:');
            logDebug(err);
            
            WebApp.showPopup({
              title: 'Error',
              message: 'Failed to update payment status',
              buttons: [{ type: 'ok' }]
            });
          } finally {
            setIsPaidUpdating(null);
          }
        }
      }
    );
  };
  
  // Handle sending payment requests
  const handleSendPaymentRequests = async () => {
    if (!game || !isActionAllowed()) return;
    
    // Clear any previous password error and show password dialog directly
    setPasswordError('');
    setShowPasswordDialog(true);
  };

  // Handle password dialog submission
  const handlePasswordSubmit = async (password: string) => {
    if (!game) return;
    
    try {
      setIsSendingPaymentRequests(true);
      setPasswordError('');
      
      const result = await gamesApi.createPaymentRequests(game.id, password);
      
      // Close password dialog
      setShowPasswordDialog(false);
      
      // Show success message with details
      WebApp.showPopup({
        title: 'Payment requests sent',
        message: `${result.requestsCreated} payment requests sent successfully.${result.errors.length > 0 ? ` ${result.errors.length} errors occurred.` : ''}`,
        buttons: [{ type: 'ok' }]
      });
      
      // Reload game data to get updated payment status
      await loadGame(game.id);
    } catch (error) {
      logDebug('Error sending payment requests: ' + error);
      if (error instanceof AxiosError && error.response?.data?.error == 'Invalid password') {
        setPasswordError(error.response?.data?.error);
      } else {
        // Close dialog and show general error
        setShowPasswordDialog(false);
        WebApp.showPopup({
          title: 'Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          buttons: [{ type: 'ok' }]
        });
      }
    } finally {
      setIsSendingPaymentRequests(false);
    }
  };

  // Handle password dialog cancellation
  const handlePasswordCancel = () => {
    setShowPasswordDialog(false);
    setPasswordError('');
    setIsSendingPaymentRequests(false);
  };
  
  // Handle game deletion with confirmation
  const handleDeleteGame = async () => {
    if (!isActionAllowed()) return;
    
    // Show confirmation dialog
    WebApp.showConfirm(
      'Are you sure you want to delete this game? This action cannot be undone.',
      async (confirmed) => {
        if (confirmed) {
          try {
            setIsActionLoading(true);
            await gamesApi.deleteGame(parseInt(gameId!));
            
            // Navigate back to games list after popup is closed
            navigate('/');
          } catch (error) {
            logDebug('Error deleting game:');
            logDebug(error);
            
            // Show error message
            WebApp.showPopup({
              title: 'Error',
              message: 'Failed to delete the game. Please try again.',
              buttons: [{ type: 'ok' }]
            });
            setIsActionLoading(false);
          }
        }
      }
    );
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

  // Get the current main button properties
  const { show: showMainButton, text: mainButtonText, onClick: mainButtonClick } = mainButtonProps();

  return (
    <div className="game-details-container">
      {/* BackButton component */}
      <BackButton onClick={() => navigate('/')} />
      <div className="game-header">
        {/* First line: Game date and time */}
        <div className="game-date-line">
          <div className="game-date">{formatDate(game.dateTime)}</div>
        </div>
        
        {/* Second line: Status information and actions */}
        <div className="game-status-line">
          <div className="status-info">
            {userRegistration && (
              <div className={`user-status ${userRegistration.isWaitlist ? 'waitlist' : 'registered'}`}>
                {userRegistration.isWaitlist ? 'Waitlist' : "You're in"}
              </div>
            )}
            
            {game.paymentAmount > 0 && (
              <div className="payment-amount">
                Payment: {formatEuros(game.paymentAmount)}
              </div>
            )}
          </div>
          
          {/* Admin-only: Game management buttons */}
          {user.isAdmin && (
            <div className="admin-actions">
              <button
                className="edit-game-button"
                onClick={() => navigate(`/game/${gameId}/edit`)}
                title="Edit Game Settings"
              >
                <FaCog />
              </button>
              {isGameUpcoming(game.dateTime) && (
                <button
                  className="delete-game-button"
                  onClick={handleDeleteGame}
                  title="Delete Game"
                  disabled={isActionLoading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
              )}
              
              {/* Send payment requests icon button for past games with payment amount and Bunq integration */}
              {isGamePast(game.dateTime) && game.paymentAmount > 0 && !game.fullyPaid && hasBunqIntegration && !isCheckingBunq && (
                <button 
                  className="send-payment-requests-button" 
                  onClick={handleSendPaymentRequests}
                  disabled={isSendingPaymentRequests || isActionLoading}
                  title="Send payment requests to unpaid players"
                >
                  {isSendingPaymentRequests ? (
                    <div className="mini-spinner"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path d="M15 18.5c-2.51 0-4.68-1.42-5.76-3.5H15v-2H8.58c-.05-.33-.08-.66-.08-1s.03-.67.08-1H15V9H9.24C10.32 6.92 12.5 5.5 15 5.5c1.61 0 3.09.59 4.23 1.57L21 5.3C19.41 3.87 17.3 3 15 3c-3.92 0-7.24 2.51-8.48 6H3v2h3.06c-.04.33-.06.66-.06 1s.02.67.06 1H3v2h3.52c1.24 3.49 4.56 6 8.48 6 2.31 0 4.41-.87 6-2.3l-1.78-1.77c-1.13.98-2.6 1.57-4.22 1.57z"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="players-container">
        <div className="players-stats-header">
          <div className="stats-row">
            <div className="compact-stats">
              <span className="registered-count">{activeRegistrations.length}</span>
              <span className="stats-divider">/</span>
              <span className="max-count">{game.maxPlayers}</span>
              {waitlistRegistrations.length > 0 && (
                <span className="waitlist-indicator">(+{waitlistRegistrations.length})</span>
              )}
            </div>
          </div>
        </div>

        {activeRegistrations.length > 0 ? (
          <div className="players-section">
            <div className="players-list">
              {activeRegistrations.map((registration) => (
                <div key={registration.id} className="player-item">
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
                    {registration.userId === user.id && (
                      <div className="player-badge">You</div>
                    )}
                    {/* Paid status checkbox for admins on past games (not for waitlist) */}
                    {user.isAdmin && isGamePast(game.dateTime) && !registration.isWaitlist && (
                      <div 
                        className={`paid-status ${registration.paid ? 'paid' : 'unpaid'}`}
                        onClick={() => handleTogglePaidStatus(registration.userId, registration.paid)}
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

      {getInfoText() && (
        <div className="info-text">
          {getInfoText()}
        </div>
      )}

      {isActionLoading && (
        <div className="action-loading">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}
      
      {/* MainButton component */}
      {showMainButton && (
        <MainButton
          text={mainButtonText || ''}
          onClick={mainButtonClick}
          progress={isActionLoading}
          disabled={isActionLoading}
        />
      )}
      
      {/* Password Dialog for Payment Requests */}
      <PasswordDialog
        isOpen={showPasswordDialog}
        title="Enter Password"
        message="Please enter your password to send payment requests."
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
        isProcessing={isSendingPaymentRequests}
        error={passwordError}
      />
    </div>
  );
};

export default GameDetails;
