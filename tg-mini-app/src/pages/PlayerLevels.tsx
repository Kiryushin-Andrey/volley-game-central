import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@twa-dev/sdk/react';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { canManagePlayerLevels, playerInfoDialogViewer } from '../utils/userRoles';
import { isTelegramApp } from '../utils/telegram';
import PlayerInfoDialog from '../components/PlayerInfoDialog';
import {
  PlayerLevelsViewModel,
  PlayerLevelsState,
} from '../viewmodels/PlayerLevelsViewModel';
import type { PlayerLevel, UserWithPlayerLevel } from '../types';
import {
  playerLevelPillClass,
  PLAYER_LEVEL_FILTER_OPTIONS,
  PLAYER_LEVEL_LABELS,
} from '../utils/playerLevel';
import './PlayerLevels.scss';

const PlayerLevels: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  const [state, setState] = useState<PlayerLevelsState>(PlayerLevelsViewModel.getInitialState());
  const [dialogUser, setDialogUser] = useState<UserWithPlayerLevel | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const updateState = useCallback((updates: Partial<PlayerLevelsState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const viewModelRef = useRef<PlayerLevelsViewModel | null>(null);
  if (!viewModelRef.current) {
    viewModelRef.current = new PlayerLevelsViewModel(updateState);
  }
  const viewModel = viewModelRef.current;

  useEffect(() => {
    if (user && !canManagePlayerLevels(user)) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (canManagePlayerLevels(user)) {
      void viewModel.loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.isAdmin, user?.isTc]);

  const filteredUsers = viewModel.filterUsers(state);

  const openDialog = (row: UserWithPlayerLevel) => {
    setDialogUser(row);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setDialogUser(null);
  };

  const handleLevelChange = async (level: PlayerLevel) => {
    if (!dialogUser) return false;
    const updated = await viewModel.updatePlayerLevel(dialogUser.id, level);
    if (updated) {
      setDialogUser(updated);
      return true;
    }
    return false;
  };

  if (user && !canManagePlayerLevels(user)) {
    return null;
  }

  if (state.isLoading) {
    return (
      <div className="player-levels-page">
        <div className="player-levels-header">
          {inTelegram && <BackButton onClick={() => navigate(-1)} />}
          <h1>Player levels</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="player-levels-page">
      <div className="player-levels-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <h1>Player levels</h1>
      </div>

      {state.error && <div className="error-message">{state.error}</div>}

      <div className="player-levels-filters">
        <input
          type="search"
          placeholder="Filter by name..."
          value={state.filterQuery}
          onChange={(e) => viewModel.setFilterQuery(e.target.value)}
          aria-label="Filter players by name"
        />
        <select
          value={state.levelFilter}
          onChange={(e) => viewModel.setLevelFilter(e.target.value as typeof state.levelFilter)}
          aria-label="Filter by level"
        >
          {PLAYER_LEVEL_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="players-list player-levels-list">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">No players match your filter.</div>
        ) : (
          filteredUsers.map((row) => (
            <div
              key={row.id}
              className="player-levels-row"
              onClick={() => openDialog(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDialog(row);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="player-info">
                <div className="player-avatar">
                  {row.avatarUrl ? (
                    <img
                      src={row.avatarUrl}
                      alt={`${row.displayName}'s avatar`}
                      className="avatar-image"
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {(row.displayName || row.telegramUsername || `Player ${row.id}`)
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="player-details">
                  <div className="player-name">
                    {row.displayName || row.telegramUsername || `Player ${row.id}`}
                  </div>
                  {row.playerLevel && row.playerLevelSetBy && (
                    <div className="player-level-set-by">
                      Set by {row.playerLevelSetBy.displayName}
                    </div>
                  )}
                </div>
                {row.playerLevel && (
                  <span className={playerLevelPillClass(row.playerLevel)}>
                    {PLAYER_LEVEL_LABELS[row.playerLevel]}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <PlayerInfoDialog
        isOpen={showDialog}
        onClose={closeDialog}
        user={dialogUser}
        viewer={playerInfoDialogViewer(user)}
        allowLevelEdit
        playerLevel={dialogUser?.playerLevel ?? null}
        playerLevelSetBy={dialogUser?.playerLevelSetBy ?? null}
        onPlayerLevelChange={handleLevelChange}
        levelChangeBusy={state.savingUserId === dialogUser?.id}
      />
    </div>
  );
};

export default PlayerLevels;
