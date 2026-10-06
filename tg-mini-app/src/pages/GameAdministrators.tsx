import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ButtonLink } from '../components/ui/RouterButton';
import { Button, Checkbox, IconButton, Placeholder, Select, Title } from '@telegram-apps/telegram-ui';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { UserSearchInput } from '../components/UserSearchInput';
import { BackButton } from '@twa-dev/sdk/react';
import { isGlobalAdmin, isTcOnly } from '../utils/userRoles';
import { isTelegramApp } from '../utils/telegram';
import {
  GameAdministratorsViewModel,
  GameAdministratorsState,
} from '../viewmodels/GameAdministratorsViewModel';
import PlayerInfoDialog from '../components/PlayerInfoDialog';
import type { UserPublicInfo } from '../types';
import './GameAdministrators.scss';
import WebApp from '@twa-dev/sdk';
import { FaCog, FaUsers } from 'react-icons/fa';
import { DAYS_OF_WEEK } from '../utils/constants';

const GameAdministrators: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  // State management
  const [state, setState] = useState<GameAdministratorsState>(
    GameAdministratorsViewModel.getInitialState()
  );
  const [showPlayerInfo, setShowPlayerInfo] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPublicInfo | null>(null);

  // Create viewmodel instance with state updater
  const updateState = useCallback((updates: Partial<GameAdministratorsState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Create viewmodel instance once
  const viewModelRef = useRef<GameAdministratorsViewModel | null>(null);
  if (!viewModelRef.current) {
    viewModelRef.current = new GameAdministratorsViewModel(updateState);
  }
  const viewModel = viewModelRef.current;

  // Check admin access
  useEffect(() => {
    if (user && !isGlobalAdmin(user)) {
      navigate(isTcOnly(user) ? '/player-levels' : '/');
    }
  }, [user, navigate]);

  // Load administrators on mount
  useEffect(() => {
    viewModel.loadAdministrators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!state.selectedUserId) {
      viewModel.setCreateError('Please select a user');
      return;
    }

    const success = await viewModel.createAssignment(
      state.selectedDayOfWeek,
      state.withPositions,
      state.selectedUserId
    );

    if (!success && inTelegram) {
      WebApp.showPopup({
        title: 'Error',
        message: state.createError,
        buttons: [{ type: 'ok' }]
      });
    }
  };

  const handleDelete = async (id: number) => {
    const confirmFn = async () => {
      if (inTelegram) {
        return new Promise<boolean>((resolve) => {
          WebApp.showConfirm('Are you sure you want to delete this assignment?', (confirmed) => {
            resolve(confirmed);
          });
        });
      }
      return window.confirm('Are you sure you want to delete this assignment?');
    };

    const success = await viewModel.deleteAssignment(id, confirmFn);

    if (!success && inTelegram) {
      WebApp.showPopup({
        title: 'Error',
        message: state.error,
        buttons: [{ type: 'ok' }]
      });
    }
  };

  const handleUserSelect = (userId: number) => {
    viewModel.setSelectedUserId(userId);
  };

  const handleCancelCreate = () => {
    viewModel.hideCreateForm();
  };

  const handleShowPlayerInfo = (user: UserPublicInfo) => {
    setSelectedUser(user);
    setShowPlayerInfo(true);
  };

  const handleClosePlayerInfo = () => {
    setShowPlayerInfo(false);
    setSelectedUser(null);
  };

  // Don't render if not admin
  if (user && !isGlobalAdmin(user)) {
    return null;
  }

  if (state.isLoading) {
    return (
      <div className="game-administrators">
        <div className="game-administrators-header">
          {inTelegram && <BackButton onClick={() => navigate(-1)} />}
          <Title Component="h1" weight="1">Game Administrators</Title>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="game-administrators">
      <div className="game-administrators-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <Title Component="h1" weight="1">Game Administrators</Title>
      </div>

      {state.error && (
        <div className="error-message">
          {state.error}
        </div>
      )}

      {!state.showCreateForm ? (
        <>
          <div className="administrators-list">
            {state.administrators.length === 0 ? (
              <Placeholder
                header="No administrator assignments yet."
                description="Create one to get started."
              />
            ) : (
              state.administrators.map((admin) => (
                <div key={admin.id} className="administrator-item">
                  <div className="administrator-info">
                    <div className="administrator-user">
                      <div
                        className="user-avatar clickable"
                        onClick={() => handleShowPlayerInfo(admin.user)}
                      >
                        {admin.user.avatarUrl ? (
                          <img src={admin.user.avatarUrl} alt={`${admin.user.displayName}'s avatar`} />
                        ) : (
                          <span>{admin.user.displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="user-details">
                        <div
                          className="user-name clickable"
                          onClick={() => handleShowPlayerInfo(admin.user)}
                        >
                          {admin.user.displayName}
                        </div>
                        <div className="assignment-details">
                          <span className="day-badge">{DAYS_OF_WEEK[admin.dayOfWeek]}</span>
                          {admin.withPositions && (
                            <span className="positions-badge">5-1</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="administrator-actions">
                    <ButtonLink
                      to={`/priority-players/${admin.id}`}
                      mode="gray"
                      size="s"
                      title="Manage Priority Players"
                      aria-label="Manage Priority Players"
                    >
                      <FaUsers />
                    </ButtonLink>
                    <ButtonLink
                      to={`/bunq-settings/user/${admin.userId}`}
                      mode="gray"
                      size="s"
                      title="Configure Bunq Settings"
                      aria-label="Configure Bunq Settings"
                    >
                      <FaCog />
                    </ButtonLink>
                    <IconButton
                      className="delete-button"
                      onClick={() => handleDelete(admin.id)}
                      type="button"
                      aria-label="Delete assignment"
                      mode="plain"
                    >
                      ×
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="actions">
            <Button
              stretched
              size="l"
              onClick={() => viewModel.showCreateForm()}
              type="button"
            >
              Add Assignment
            </Button>
          </div>
        </>
      ) : (
        <div className="create-form">
          <Title Component="h2">New Assignment</Title>
          
          {state.createError && (
            <div className="error-message">
              {state.createError}
            </div>
          )}

          <div className="form-group">
            <Select
              id="dayOfWeek"
              header="Day of Week"
              value={state.selectedDayOfWeek}
              onChange={(e) => viewModel.setSelectedDayOfWeek(parseInt(e.target.value))}
              disabled={state.isCreating}
            >
              {DAYS_OF_WEEK.map((day, index) => (
                <option key={index} value={index}>
                  {day}
                </option>
              ))}
            </Select>
          </div>

          <div className="form-group">
            <div className="checkbox-label">
              <Checkbox
                aria-label="5-1 positions game"
                checked={state.withPositions}
                onChange={(e) => viewModel.setWithPositions(e.target.checked)}
                disabled={state.isCreating}
              />
              <span>5-1 positions game</span>
            </div>
          </div>

          <div className="form-group">
            <label>User</label>
            <UserSearchInput
              onSelectUser={handleUserSelect}
              onCancel={handleCancelCreate}
              disabled={state.isCreating}
              placeholder="Search for a user..."
            />
          </div>

          <div className="form-actions">
            <Button
              mode="gray"
              onClick={handleCancelCreate}
              type="button"
              disabled={state.isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={state.isCreating || !state.selectedUserId}
              type="button"
            >
              {state.isCreating ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      )}

      {/* Player Info Dialog */}
      <PlayerInfoDialog
        isOpen={showPlayerInfo}
        onClose={handleClosePlayerInfo}
        user={selectedUser}
      />
    </div>
  );
};

export default GameAdministrators;

