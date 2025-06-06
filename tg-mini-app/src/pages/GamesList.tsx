import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Game, GameWithStats, User } from '../types';
import { gamesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './GamesList.scss';

interface GamesListProps {
  user: User;
}

const GamesList: React.FC<GamesListProps> = ({ user }) => {
  const [games, setGames] = useState<GameWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includePastGames, setIncludePastGames] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadGames();
  }, [includePastGames]);

  const loadGames = async () => {
    try {
      setIsLoading(true);
      // Pass includePastGames parameter to the API
      const fetchedGames = await gamesApi.getAllGames(includePastGames);
      
      // Process games to add stats and user registration info
      const gamesWithStats: GameWithStats[] = fetchedGames.map((game: Game) => {
        const activeRegistrations = game.registrations.filter(reg => !reg.isWaitlist);
        const waitlistRegistrations = game.registrations.filter(reg => reg.isWaitlist);
        const userRegistration = game.registrations.find(reg => reg.userId === user.id);

        return {
          ...game,
          activePlayersCount: activeRegistrations.length,
          waitlistCount: waitlistRegistrations.length,
          isUserRegistered: !!userRegistration,
          userRegistration,
        };
      });
      
      // Games are already filtered and sorted by the backend
      setGames(gamesWithStats);
    } catch (err) {
      setError('Failed to load games');
      console.error('Error loading games:', err);
    } finally {
      setIsLoading(false);
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
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const handleGameClick = (gameId: number) => {
    navigate(`/game/${gameId}`);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

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
        <h1>{includePastGames ? 'All Games' : 'Upcoming Games'}</h1>
        <div className="header-actions">
          <p>Welcome, {user.username}!</p>
          {user.isAdmin && (
            <>
              <div className="admin-controls">
                <label className="past-games-toggle">
                  <input
                    type="checkbox"
                    checked={includePastGames}
                    onChange={(e) => setIncludePastGames(e.target.checked)}
                  />
                  Show past games
                </label>
              </div>
              <button onClick={handleCreateGame} className="create-game-button">
                + New Game
              </button>
            </>
          )}
        </div>
      </header>

      {games.length === 0 ? (
        <div className="no-games">
          <h2>No upcoming games</h2>
          <p>Check back later for new volleyball games!</p>
        </div>
      ) : (
        <div className="games-list">
          {games.map((game) => (
            <div
              key={game.id}
              className={`game-card ${game.isUserRegistered ? 'registered' : ''}`}
              onClick={() => handleGameClick(game.id)}
            >
              <div className="game-header">
                <div className="game-date">
                  {formatDate(game.dateTime)}
                </div>
                {game.isUserRegistered && (
                  <div className={`registration-badge ${game.userRegistration?.isWaitlist ? 'waitlist' : 'active'}`}>
                    {game.userRegistration?.isWaitlist ? 'Waitlist' : 'Registered'}
                  </div>
                )}
              </div>
              
              <div className="game-stats">
                <div className="stat">
                  <div className="stat-value">{game.activePlayersCount}</div>
                  <div className="stat-label">Players</div>
                </div>
                <div className="stat-divider">/</div>
                <div className="stat">
                  <div className="stat-value">{game.maxPlayers}</div>
                  <div className="stat-label">Max</div>
                </div>
                {game.waitlistCount > 0 && (
                  <>
                    <div className="stat-separator">•</div>
                    <div className="stat waitlist">
                      <div className="stat-value">{game.waitlistCount}</div>
                      <div className="stat-label">Waiting</div>
                    </div>
                  </>
                )}
              </div>

              <div className={`availability-status ${
                game.activePlayersCount >= game.maxPlayers ? 'full' : 'available'
              }`}>
                {game.activePlayersCount >= game.maxPlayers ? 'Full' : 'Available'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GamesList;
