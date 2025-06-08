import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { logDebug } from '../debug';
import { gamesApi } from '../services/api';
import { GameWithStats, User } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import './GamesList.scss';

interface GamesListProps {
  user: User;
}

// Games List Item component for displaying individual games
const GameItem = memo(({ game, onClick, formatDate }: { 
  game: GameWithStats, 
  onClick: (id: number) => void,
  formatDate: (date: string) => string 
}) => (
  <div
    className={`game-card ${game.isUserRegistered ? 'registered' : ''}`}
    onClick={() => onClick(game.id)}
  >
    <div className="game-header">
      <div className="game-date">
        {formatDate(game.dateTime)}
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

      {/* Upcoming games within 6 days: show registered/total */}
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
));

// Games List component to contain all game items
const GameItemsList = memo(({ 
  games, 
  isLoading, 
  includePastGames,
  formatDate,
  handleGameClick 
}: { 
  games: GameWithStats[], 
  isLoading: boolean,
  includePastGames: boolean,
  formatDate: (date: string) => string,
  handleGameClick: (id: number) => void
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
        <p>No {includePastGames ? '' : 'upcoming '}games available</p>
      </div>
    );
  }
  
  // Show the list of games
  return (
    <div className="games-list">
      {games.map((game) => (
        <GameItem 
          key={game.id} 
          game={game} 
          onClick={handleGameClick}
          formatDate={formatDate}
        />
      ))}
    </div>
  );
});

const GamesList: React.FC<GamesListProps> = ({ user }) => {
  const [games, setGames] = useState<GameWithStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [includePastGames, setIncludePastGames] = useState(false);
  
  // Use a ref for loading state to avoid re-renders of the parent component
  const isLoadingRef = useRef(false);
  const [loadingIndicator, setLoadingIndicator] = useState(false);
  const navigate = useNavigate();

  // Function to handle the checkbox change without triggering full re-render
  const handlePastGamesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setIncludePastGames(newValue); // This will trigger the useEffect
  };
  
  // Effect to re-load games when the checkbox state changes
  useEffect(() => {
    loadGames();
  }, [includePastGames]);
  
  // Ensure main button is hidden on games list screen
  // It should only be visible on game details screen
  useEffect(() => {
    // Load games when component mounts
    loadGames();

    // No cleanup needed
    return () => {};
  }, []);

  const loadGames = async () => {
    if (isLoadingRef.current) return;
    try {
      isLoadingRef.current = true;
      setLoadingIndicator(true);
      
      // Use setTimeout to ensure loading indicator has time to appear
      // and to ensure DOM updates before the potentially expensive operation
      const gamesPromise = gamesApi.getAllGames(includePastGames);
      
      const fetchedGames = await gamesPromise;
      
      // The optimized API now includes all necessary data:  
      // - totalRegisteredCount, paidCount, registeredCount
      // - isUserRegistered and userRegistration for games within 5 days
      
      // Process games to ensure they have all required properties with defaults
      const gamesWithRequiredProps: GameWithStats[] = fetchedGames.map((game: any) => {
        return {
          ...game,
          // Ensure required fields have defaults
          totalRegisteredCount: game.totalRegisteredCount || 0,
          paidCount: game.paidCount,
          registeredCount: game.registeredCount,
          // User registration status (already included by API for games within 5 days)
          isUserRegistered: game.isUserRegistered || false,
          userRegistration: game.userRegistration || undefined
        };
      });
      
      // Games are already filtered and sorted by the backend
      setGames(gamesWithRequiredProps);
      setError(null);
    } catch (err) {
      setError('Failed to load games');
      logDebug('Error loading games:');
      logDebug(err);
    } finally {
      isLoadingRef.current = false;
      setLoadingIndicator(false);
    }
  };

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

  // Loading state is now handled inside the GameItemsList component

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

  const handleCreateGame = () => {
    navigate('/create-game');
  };

  return (
    <div className="games-list-container">
      <header className="games-header">
        {user.isAdmin && (
          <div className="admin-controls">
            <label className="past-games-toggle">
              <input
                type="checkbox"
                checked={includePastGames}
                onChange={handlePastGamesChange}
                disabled={isLoadingRef.current}
              />
              Show past games
            </label>
            <button 
              onClick={handleCreateGame} 
              className="create-game-button"
              disabled={isLoadingRef.current}
            >
              + New Game
            </button>
          </div>
        )}
      </header>

      {error ? (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadGames} className="retry-button">Retry</button>
        </div>
      ) : (
        <GameItemsList 
          games={games}
          isLoading={loadingIndicator}
          includePastGames={includePastGames}
          formatDate={formatDate}
          handleGameClick={handleGameClick}
        />
      )}
    </div>
  );
};

export default GamesList;
