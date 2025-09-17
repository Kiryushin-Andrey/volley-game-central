import React, { memo } from 'react';
import { useGamesListViewModel } from './GamesListViewModel';
import UnpaidGamesList from '../components/UnpaidGamesList';
import { GameWithStats, User } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { resolveLocationLink } from '../utils/locationUtils';
import { isGameUpcoming } from '../utils/gameDateUtils';
import './GamesList.scss';

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
  formatDate,
  handleGameClick,
  showPositions 
}: { 
  games: GameWithStats[], 
  formatDate: (date: string) => string,
  handleGameClick: (id: number) => void,
  showPositions: boolean
}) => {  
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
  const vm = useGamesListViewModel(user);

  if (vm.error) {
    return (
      <div className="games-list-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{vm.error}</p>
          <button onClick={() => vm.loadGames()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (vm.loadingGames || vm.loadingUnpaid) {
    return (
      <div className="games-list-container">
        <div className="games-loading">
          <LoadingSpinner />
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="games-list-container">
      <div style={{ margin: '8px 12px' }}>
        {vm.unpaidItems.length > 0 && (
          <>
            <div style={{ fontWeight: 600, margin: '0 0 6px 2px' }}>Your unpaid games</div>
            <UnpaidGamesList items={vm.unpaidItems} />
            {!vm.showPageContent && (
              <button
                type="button"
                onClick={() => vm.setShowPageContent(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px 4px',
                  color: 'var(--tg-theme-link-color, #2481cc)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 14,
                  marginLeft: 2,
                }}
              >
                Show upcoming games
              </button>
            )}
          </>
        )}
      </div>

      {vm.showPageContent && (
        <>
          <div className="games-header">
            <div className="filters-container">
            <div className="toggle-container">
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={vm.showPositions}
                  onChange={(e) => vm.setShowPositions(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
              <span className="toggle-label">Show games with 5-1 positions</span>
            </div>
            
            {vm.showPositions && (
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
                    onClick={() => vm.navigateTo('/bunq-settings')}
                  >
                    💳 Bunq settings
                  </button>
                  <button
                    className="create-game-button"
                    onClick={() => vm.navigateTo('/games/new')}
                  >
                    Create New Game
                  </button>
                </div>
                
                  <div className="game-filters">
                  <div className="radio-group">
                    <label className={`radio-label ${vm.gameFilter === 'upcoming' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="gameFilter"
                        value="upcoming"
                        checked={vm.gameFilter === 'upcoming'}
                        onChange={() => vm.setGameFilter('upcoming')}
                      />
                      <span>Upcoming</span>
                    </label>
                    <label className={`radio-label ${vm.gameFilter === 'past' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="gameFilter"
                        value="past"
                        checked={vm.gameFilter === 'past'}
                        onChange={() => vm.setGameFilter('past')}
                      />
                      <span>Past</span>
                    </label>
                  </div>
                  
                  <div className="show-all-toggle">
                    <input
                      type="checkbox"
                      id="showAllGames"
                      checked={vm.showAll}
                      onChange={(e) => vm.setShowAll(e.target.checked)}
                    />
                    <label htmlFor="showAllGames">
                      {vm.gameFilter == 'upcoming' ? "Show all scheduled games" : "Show fully paid games"}
                    </label>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <GameItemsList
            games={vm.games}
            formatDate={vm.formatDate}
            handleGameClick={vm.handleGameClick}
            showPositions={vm.showPositions}
          />
        </>
      )}

    </div>
  );
};

export default GamesList;
