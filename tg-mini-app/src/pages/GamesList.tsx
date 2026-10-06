import React, { memo } from 'react';
import { FaUsers, FaCog, FaPlus } from 'react-icons/fa';
import { ButtonLink, CellLink } from '../components/ui/RouterButton';
import {
  Button,
  Cell,
  List,
  Placeholder,
  Section,
  SegmentedControl,
  Spinner,
  Switch,
} from '@telegram-apps/telegram-ui';
import { useGamesListViewModel } from './GamesListViewModel';
import { GameWithStats, User } from '../types';
import { formatDate, isGameUpcoming } from '../utils/gameDateUtils';
import { isPositionsGame } from '../utils/gameFormat';
import { isTcOnly } from '../utils/userRoles';
import { resolveLocationLink } from '../utils/locationUtils';
import { HalloweenDecorations } from '../components/HalloweenDecorations';
import { NewYearDecorations } from '../components/NewYearDecorations';
import { March8Decorations } from '../components/March8Decorations';
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

  const stats = (!game.readonly || game.paidCount !== undefined) ? (
    <div className="game-stats">
      {game.paidCount !== undefined && (
        <div className="compact-stats">
          <span className="counter">{game.paidCount}</span>
          <span className="divider">/</span>
          <span className="counter">{game.totalRegisteredCount}</span>
        </div>
      )}
      {game.registeredCount !== undefined && (
        <div className="compact-stats">
          <span className="counter">{game.registeredCount}</span>
          <span className="divider">/</span>
          <span className="counter">{game.maxPlayers}</span>
        </div>
      )}
      {game.paidCount === undefined && game.registeredCount === undefined && (
        <div className="compact-stats">
          <span className="counter">{game.totalRegisteredCount}</span>
          <span className="divider">/</span>
          <span className="counter">{game.maxPlayers}</span>
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <Cell
      className={`game-card ${game.isUserRegistered ? 'registered' : ''} ${isHalloween ? 'halloween-theme' : ''} ${isNewYear ? 'newyear-theme' : ''} ${isMarch8 ? 'march8-theme' : ''} ${isPositionsGame(game.gameFormat) ? 'with-positions' : 'without-positions'}`}
      onClick={() => onClick(game.id)}
      multiline
      subtitle={game.title || undefined}
      after={stats}
    >
      {isHalloween && <HalloweenDecorations variant="card" />}
      {isNewYear && <NewYearDecorations variant="card" />}
      {isMarch8 && <March8Decorations variant="card" />}
      <div className="game-header">
        <div className="game-header-top">
          <div className="game-date-location">
            <span className="game-date">{formatDate(game.dateTime)}</span>
            {isUpcomingGame && (game.locationName || game.locationLink) && (
              <span className="game-location">
                <a
                  href={resolveLocationLink(game.locationName, game.locationLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  📍 {game.locationName || 'Location'}
                </a>
              </span>
            )}
          </div>
          {game.isUserRegistered && (
            <span className={`registration-badge ${game.userRegistration?.isWaitlist ? 'waitlist' : 'active'}`}>
              {game.userRegistration?.isWaitlist ? 'Waitlist' : 'You\'re in'}
            </span>
          )}
        </div>
      </div>
    </Cell>
  );
});

// Games List component to contain all game items
const GameItemsList = memo(({ 
  games, 
  formatDate,
  handleGameClick
}: { 
  games: GameWithStats[], 
  formatDate: (date: string) => string,
  handleGameClick: (id: number) => void
}) => {  
  // Show no games message when no games are available
  if (games.length === 0) {
    return (
      <Placeholder header="No games available" />
    );
  }
  
  // Show the list of games
  return (
    <Section className="games-list">
      {games.map((game) => {
        const isHalloween = game.tag === 'halloween';
        const isNewYear = game.tag === 'newyear';
        const isMarch8 = game.tag === 'march8';
        return (
          <div 
            key={game.id} 
            className={`game-card-wrapper ${isHalloween ? 'halloween-wrapper' : ''} ${isNewYear ? 'newyear-wrapper' : ''} ${isMarch8 ? 'march8-wrapper' : ''}`}
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
    </Section>
  );
});

const GamesList: React.FC<GamesListProps> = ({ user }) => {
  const vm = useGamesListViewModel(user);

  if (vm.error) {
    return (
      <div className="games-list-container">
        <Placeholder
          header="Error"
          description={vm.error}
          action={<Button onClick={() => vm.loadGames()} className="retry-button">Retry</Button>}
        />
      </div>
    );
  }

  // Show full-page loading only on initial load
  if ((vm.loadingGames || vm.loadingUnpaid) && vm.games.length === 0) {
    return (
      <div className="games-list-container">
        <div className="games-loading">
          <Spinner size="l" />
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <List className="games-list-container">
      {vm.unpaidItems.length > 0 && vm.gameFilter === 'upcoming' && (
        <Section header="Your unpaid games" footer={!vm.showPageContent ? (
          <Button mode="plain" type="button" onClick={() => vm.setShowPageContent(true)}>
            Show upcoming games
          </Button>
        ) : undefined}>
          <UnpaidGamesList items={vm.unpaidItems} />
        </Section>
      )}

      {vm.showPageContent && (
        <Section>
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

              {(user.isAdmin || vm.hasAdminAssignments) && (
                <div className="admin-controls">
                  <div className="game-filters">
                  <div className="radio-group-with-actions">
                    <SegmentedControl>
                      <SegmentedControl.Item
                        selected={vm.gameFilter === 'upcoming'}
                        onClick={() => vm.setGameFilter('upcoming')}
                      >
                        Upcoming
                      </SegmentedControl.Item>
                      <SegmentedControl.Item
                        selected={vm.gameFilter === 'past'}
                        onClick={() => vm.setGameFilter('past')}
                      >
                        Past
                      </SegmentedControl.Item>
                    </SegmentedControl>
                    {user.isAdmin && (
                      <div className="admin-icon-buttons">
                        <ButtonLink to="/players" mode="gray" size="s" title="Players" aria-label="Players">
                          <FaUsers />
                        </ButtonLink>
                        <ButtonLink to="/bunq-settings" mode="gray" size="s" title="Bunq Settings" aria-label="Bunq Settings">
                          <FaCog />
                        </ButtonLink>
                        <ButtonLink to="/games/new" mode="filled" size="s" title="Create New Game" aria-label="Create New Game">
                          <FaPlus />
                        </ButtonLink>
                      </div>
                    )}
                    {!user.isAdmin && vm.hasAdminAssignments && (
                      <div className="admin-icon-buttons">
                        <ButtonLink to="/games/new" mode="filled" size="s" title="Create New Game" aria-label="Create New Game">
                          <FaPlus />
                        </ButtonLink>
                      </div>
                    )}
                  </div>

                  {(user.isAdmin || vm.hasAdminAssignments) && (
                  <Cell
                    after={
                      <Switch
                        id="showAllGames"
                        aria-label={vm.gameFilter == 'upcoming' ? 'Show all scheduled games' : 'Show fully paid games'}
                        checked={vm.showAll}
                        onChange={(e) => vm.setShowAll(e.target.checked)}
                      />
                    }
                  >
                    {vm.gameFilter == 'upcoming' ? 'Show all scheduled games' : 'Show fully paid games'}
                  </Cell>
                  )}
                  </div>
                </div>
              )}
            {isTcOnly(user) && (
              <CellLink to="/player-levels" before={<FaUsers aria-hidden />}>
                Manage player levels
              </CellLink>
            )}
            </div>
          </div>
        </Section>
      )}
      {vm.showPageContent && (vm.loadingGames ? (
        <div className="games-loading">
          <Spinner size="l" />
          <p className="loading-text">Loading...</p>
        </div>
      ) : (
        <GameItemsList
          games={vm.games}
          formatDate={formatDate}
          handleGameClick={vm.handleGameClick}
        />
      ))}
    </List>
  );
};

export default GamesList;
