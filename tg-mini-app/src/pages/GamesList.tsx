import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logDebug } from '../debug';
import { gamesApi } from '../services/api';
import { GameWithStats, User } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { resolveLocationLink } from '../utils/locationUtils';
import { isGameUpcoming } from '../utils/gameDateUtils';
import './GamesList.scss';

type GameFilter = 'upcoming' | 'past';

interface GamesListProps {
  user: User;
}

// Games List Item component for displaying individual games
const GameItem = memo(({ game, onClick, formatDate }: { 
  game: GameWithStats, 
  onClick: (id: number) => void,
  formatDate: (date: string) => string 
}) => {
  const isUpcomingGame = isGameUpcoming(game.dateTime);
  
  return (
    <div
      className={`game-card ${game.isUserRegistered ? 'registered' : ''}`}
      onClick={() => onClick(game.id)}
    >
      <div className="game-header">
        <div className="game-date-location">
          <span className="game-date">{formatDate(game.dateTime)}</span>
          {isUpcomingGame && (game.locationName || game.locationLink) && (
            <span className="game-location">
              <a
                href={resolveLocationLink(game.locationName, game.locationLink)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()} // Prevent card click when clicking location
              >
                📍 {game.locationName || 'Location'}
              </a>
            </span>
          )}
      </div>
      {game.isUserRegistered && (
        <div className={`registration-badge ${game.userRegistration?.isWaitlist ? 'waitlist' : 'active'}`}>
          {game.userRegistration?.isWaitlist ? 'Waitlist' : 'You\'re in'}
        </div>
      )}
    </div>
    
    <div className="game-stats">
      {/* Past games: show paid/total counts */}
      {game.paidCount !== undefined && (
        <div className="compact-stats">
          <span className="counter">{game.paidCount}</span>
          <span className="divider">/</span>
          <span className="counter">{game.totalRegisteredCount}</span>
        </div>
      )}

      {/* Upcoming games within registration window: show registered/total */}
      {game.registeredCount !== undefined && (
        <div className="compact-stats">
          <span className="counter">{game.registeredCount}</span>
          <span className="divider">/</span>
          <span className="counter">{game.maxPlayers}</span>
        </div>
      )}
      
      {/* Regular upcoming games: show current count/capacity */}
      {game.paidCount === undefined && game.registeredCount === undefined && (
        <div className="compact-stats">
          <span className="counter">{game.totalRegisteredCount}</span>
          <span className="divider">/</span>
          <span className="counter">{game.maxPlayers}</span>
        </div>
      )}
    </div>
  </div>
  );
});

// Games List component to contain all game items
const GameItemsList = memo(({ 
  games, 
  isLoading, 
  formatDate,
  handleGameClick,
  showPositions 
}: { 
  games: GameWithStats[], 
  isLoading: boolean,
  formatDate: (date: string) => string,
  handleGameClick: (id: number) => void,
  showPositions: boolean
}) => {
  // Show loading indicator when loading
  if (isLoading) {
    return (
      <div className="games-loading">
        <LoadingSpinner />
        <p className="loading-text">Loading...</p>
      </div>
    );
  }
  
  // Show no games message when no games are available
  if (games.length === 0) {
    return (
      <div className="no-games">
        <p>No games available</p>
      </div>
    );
  }
  
  // Show the list of games
  return (
    <div className="games-list">
      {games.map((game) => (
        <div 
          key={game.id} 
          className={`game-card-wrapper ${showPositions ? (game.withPositions ? 'with-positions' : 'without-positions') : ''}`}
        >
          <GameItem 
            game={game} 
            onClick={handleGameClick}
            formatDate={formatDate}
          />
        </div>
      ))}
    </div>
  );
});

const GamesList: React.FC<GamesListProps> = ({ user }) => {
  const [games, setGames] = useState<GameWithStats[]>([]);
  const [allGames, setAllGames] = useState<GameWithStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gameFilter, setGameFilter] = useState<GameFilter>('upcoming');
  const [showAll, setShowAll] = useState(false);
  const [showPositions, setShowPositions] = useState<boolean>(() => {
    // Initialize from localStorage to persist user preference across navigations
    try {
      const saved = localStorage.getItem('showPositions');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  
  // Use a ref for loading state to avoid re-renders of the parent component
  const isLoadingRef = useRef(false);
  const [loadingIndicator, setLoadingIndicator] = useState(false);
  const navigate = useNavigate();

  // Persist showPositions preference
  useEffect(() => {
    try {
      localStorage.setItem('showPositions', showPositions ? 'true' : 'false');
    } catch {}
  }, [showPositions]);

  useEffect(() => {
    if (allGames.length > 0) {
      let filteredGames = [...allGames];
      
      if (!showPositions) {
        filteredGames = filteredGames.filter(game => !game.withPositions);
      }
      
      setGames(filteredGames);
    }
  }, [showPositions, allGames]);
  
  // Load games function with useCallback to prevent infinite loops
  const loadGames = useCallback(async () => {
    if (isLoadingRef.current) return;
    try {
      isLoadingRef.current = true;
      setLoadingIndicator(true);
      
      // Use setTimeout to ensure loading indicator has time to appear
      // and to ensure DOM updates before the potentially expensive operation
      const showPast = gameFilter === 'past';
      const fetchedGames = await gamesApi.getAllGames(showPast, showAll);
      
      // Process games to ensure they have all required properties with defaults
      const gamesWithRequiredProps: GameWithStats[] = fetchedGames.map((game: any) => ({
        ...game,
        // Ensure required fields have defaults
        totalRegisteredCount: game.totalRegisteredCount || 0,
        paidCount: game.paidCount,
        registeredCount: game.registeredCount,
        // User registration status (already included by API for games within 10 days)
        isUserRegistered: game.isUserRegistered || false,
        userRegistration: game.userRegistration || undefined
      }));
      
      // Store all games and apply filters
      setAllGames(gamesWithRequiredProps);
      setError(null);
      
      // Apply current filters
      let filteredGames = [...gamesWithRequiredProps];
      
      // Filter by positions toggle if enabled
      if (showPositions) {
        filteredGames = filteredGames.filter(game => game.withPositions);
      }
      
      setGames(filteredGames);
    } catch (err) {
      setError('Failed to load games');
      logDebug('Error loading games:');
      logDebug(err);
    } finally {
      isLoadingRef.current = false;
      setLoadingIndicator(false);
    }
  }, [gameFilter, showAll, showPositions]);
  
  // Effect to re-load games when filter or showAll state changes
  useEffect(() => {
    loadGames();
  }, [loadGames]);
  
  // Ensure main button is hidden on games list screen
  // It should only be visible on game details screen
  useEffect(() => {
    // Load games when component mounts
    loadGames();

    // No cleanup needed
    return () => {};
  }, []);



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

  const handleGameClick = (gameId: number) => {
    navigate(`/game/${gameId}`);
  };

  if (error) {
    return (
      <div className="games-list-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadGames} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="games-list-container">
      <div className="games-header">
        <div className="filters-container">
          <div className="toggle-container">
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={showPositions}
                onChange={(e) => setShowPositions(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
            <span className="toggle-label">Show games with 5-1 positions</span>
          </div>
          
          {showPositions && (
            <div className="positions-note">
              <p>🔶 Games marked with yellow are played with 5-1 positions. Knowledge of the 5-1 scheme is expected of all participants.</p>
            </div>
          )}
          
          {/* Admin controls */}
          {user.isAdmin && (
            <div className="admin-controls">
              <div className="button-row">
                <button
                  className="bunq-settings-button"
                  onClick={() => navigate('/bunq-settings')}
                >
                  💳 Bunq settings
                </button>
                <button
                  className="check-payments-button"
                  onClick={() => navigate('/check-payments')}
                >
                  🔄 Check Payments
                </button>
                <button
                  className="create-game-button"
                  onClick={() => navigate('/games/new')}
                >
                  Create New Game
                </button>
              </div>
              
              <div className="game-filters">
                <div className="radio-group">
                  <label className={`radio-label ${gameFilter === 'upcoming' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="gameFilter"
                      value="upcoming"
                      checked={gameFilter === 'upcoming'}
                      onChange={() => setGameFilter('upcoming')}
                    />
                    <span>Upcoming</span>
                  </label>
                  <label className={`radio-label ${gameFilter === 'past' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="gameFilter"
                      value="past"
                      checked={gameFilter === 'past'}
                      onChange={() => setGameFilter('past')}
                    />
                    <span>Past</span>
                  </label>
                </div>
                
                <div className="show-all-toggle">
                  <input
                    type="checkbox"
                    id="showAllGames"
                    checked={showAll}
                    onChange={(e) => setShowAll(e.target.checked)}
                  />
                  <label htmlFor="showAllGames">
                    {gameFilter == 'upcoming' ? "Show all scheduled games" : "Show fully paid games"}
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <GameItemsList 
        games={games}
        isLoading={loadingIndicator}
        formatDate={formatDate}
        handleGameClick={handleGameClick}
        showPositions={showPositions}
      />
    </div>
  );
};

export default GamesList;
