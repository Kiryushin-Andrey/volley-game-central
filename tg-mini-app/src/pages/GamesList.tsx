import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { FaUsers, FaCog, FaPlus } from 'react-icons/fa';
import { useGamesListViewModel } from './GamesListViewModel';
import { GameWithStats, User } from '../types';
import { formatDate, isGameUpcoming } from '../utils/gameDateUtils';
import { isTcOnly } from '../utils/userRoles';
import { resolveLocationLink } from '../utils/locationUtils';
import { formatCardClass, listCapacity } from '../utils/courtTheme';
import { markCourtTransition, readCourtTransitionId, withViewTransition } from '../utils/courtMotion';
import { HalloweenDecorations } from '../components/HalloweenDecorations';
import { NewYearDecorations } from '../components/NewYearDecorations';
import { March8Decorations } from '../components/March8Decorations';
import LoadingSpinner from '../components/LoadingSpinner';
import FormatPill from '../components/FormatPill';
import CapacityMeter from '../components/CapacityMeter';
import CourtLines from '../components/CourtLines';
import VolleyballMark from '../components/VolleyballMark';
import UnpaidGamesList from '../components/UnpaidGamesList';
import CategoryMultiSelect from '../components/CategoryMultiSelect';
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
  const isHalloween = game.tag === 'halloween';
  const isNewYear = game.tag === 'newyear';
  const isMarch8 = game.tag === 'march8';
  const capacity = listCapacity(game);
  const isTransitionSource = readCourtTransitionId() === game.id;

  return (
    <div
      className={`game-card ${game.isUserRegistered ? 'registered' : ''} ${isHalloween ? 'halloween-theme' : ''} ${isNewYear ? 'newyear-theme' : ''} ${isMarch8 ? 'march8-theme' : ''} ${formatCardClass(game.gameFormat)} ${isTransitionSource ? 'vt-source' : ''}`}
      onClick={(event) => {
        markCourtTransition(game.id);
        document.querySelectorAll('.game-card.vt-source').forEach((card) => {
          card.classList.remove('vt-source');
        });
        event.currentTarget.classList.add('vt-source');
        withViewTransition(() => onClick(game.id));
      }}
    >
      {isHalloween && <HalloweenDecorations variant="card" />}
      {isNewYear && <NewYearDecorations variant="card" />}
      {isMarch8 && <March8Decorations variant="card" />}
      <div className="game-header">
        <div className="game-header-top">
          <div className="game-date-location">
            <span className="game-date">{formatDate(game.dateTime)}</span>
            <FormatPill format={game.gameFormat} />
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
        {game.title && (
          <div className="game-title">
            {game.title}
          </div>
        )}
      </div>
      
      {/* Show stats for non-readonly games, or for past readonly games (which have paidCount) */}
      {capacity && (
        <div className="game-stats">
          <div className="compact-stats">
            <CapacityMeter count={capacity.count} max={capacity.max} kind={capacity.kind} />
          </div>
        </div>
      )}
    </div>
  );
});

// Games List component to contain all game items
const GameItemsList = memo(({ 
  games, 
  formatDate,
  handleGameClick,
  emptyMessage,
}: { 
  games: GameWithStats[], 
  formatDate: (date: string) => string,
  handleGameClick: (id: number) => void,
  emptyMessage: string,
}) => {  
  if (games.length === 0) {
    return (
      <div className="no-games">
        <div className="court-empty">
          <CourtLines className="court-empty-lines" />
          <VolleyballMark className="court-empty-ball" />
        </div>
        <p>{emptyMessage}</p>
      </div>
    );
  }
  
  // Show the list of games
  return (
    <div className="games-list">
      {games.map((game, index) => {
        const isHalloween = game.tag === 'halloween';
        const isNewYear = game.tag === 'newyear';
        const isMarch8 = game.tag === 'march8';
        return (
          <div 
            key={game.id} 
            className={`game-card-wrapper ${isHalloween ? 'halloween-wrapper' : ''} ${isNewYear ? 'newyear-wrapper' : ''} ${isMarch8 ? 'march8-wrapper' : ''}`}
            style={{ ['--court-stagger' as string]: Math.min(index, 12) } as React.CSSProperties}
          >
            {isHalloween && <div className="leaf-layer" />}
            {isNewYear && <div className="snowflake-layer" />}
            {isMarch8 && <div className="petal-layer" />}
            <GameItem 
              game={game} 
              onClick={handleGameClick}
              formatDate={formatDate}
            />
          </div>
        );
      })}
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

  // Show full-page loading only on initial load
  if ((vm.loadingGames || vm.loadingUnpaid) && vm.games.length === 0) {
    return (
      <div className="games-list-container">
        <div className="games-loading">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="games-list-container">
      <div style={{ margin: '8px 12px' }}>
        {vm.unpaidItems.length > 0 && vm.gameFilter === 'upcoming' && (
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
            {vm.gameFilter === 'upcoming' && (
              <div className="category-filter-container">
                <CategoryMultiSelect
                  selectedCategories={vm.selectedCategories}
                  availableCategories={vm.availableCategories}
                  onToggleCategory={(category) => vm.toggleCategory(category)}
                />
              </div>
            )}
            
            {/* Admin controls */}
              {(user.isAdmin || vm.hasAdminAssignments) && (
                <div className="admin-controls">
                  <div className="game-filters">
                  <div className="radio-group-with-actions">
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
                    {user.isAdmin && (
                      <div className="admin-icon-buttons">
                        <Link
                          to="/players"
                          className="icon-button"
                          title="Players"
                        >
                          <FaUsers />
                        </Link>
                        <Link
                          to="/bunq-settings"
                          className="icon-button"
                          title="Bunq Settings"
                        >
                          <FaCog />
                        </Link>
                        <Link
                          to="/games/new"
                          className="icon-button icon-button-primary"
                          title="Create New Game"
                        >
                          <FaPlus />
                        </Link>
                      </div>
                    )}
                    {!user.isAdmin && vm.hasAdminAssignments && (
                      <div className="admin-icon-buttons">
                        <Link
                          to="/games/new"
                          className="icon-button icon-button-primary"
                          title="Create New Game"
                        >
                          <FaPlus />
                        </Link>
                      </div>
                    )}
                  </div>
                  
                  {(user.isAdmin || vm.hasAdminAssignments) && (
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
                  )}
                  </div>
                </div>
              )}
            {isTcOnly(user) && (
              <div className="tc-player-levels-nav">
                <Link
                  to="/player-levels"
                  className="tc-player-levels-link"
                  title="Manage player levels"
                >
                  <FaUsers aria-hidden />
                  <span>Manage player levels</span>
                </Link>
              </div>
            )}
            </div>
          </div>
          {vm.loadingGames ? (
            <div className="games-loading">
              <LoadingSpinner />
            </div>
          ) : (
            <GameItemsList
              games={vm.games}
              formatDate={formatDate}
              handleGameClick={vm.handleGameClick}
              emptyMessage={vm.gameFilter === 'past' ? 'No past games' : 'No games this week'}
            />
          )}
        </>
      )}

    </div>
  );
};

export default GamesList;
