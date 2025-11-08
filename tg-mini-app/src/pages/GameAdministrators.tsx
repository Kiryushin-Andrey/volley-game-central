import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { UserSearchInput } from '../components/UserSearchInput';
import { BackButton } from '@twa-dev/sdk/react';
import { isTelegramApp } from '../utils/telegram';
import {
  GameAdministratorsViewModel,
  GameAdministratorsState,
} from '../viewmodels/GameAdministratorsViewModel';
import PlayerInfoDialog from '../components/PlayerInfoDialog';
import type { UserPublicInfo } from '../types';
import './GameAdministrators.scss';
import WebApp from '@twa-dev/sdk';
import { FaCog } from 'react-icons/fa';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
    if (user && !user.isAdmin) {
      navigate('/');
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
  if (user && !user.isAdmin) {
    return null;
  }

  if (state.isLoading) {
    return (
      <div className="game-administrators">
        <div className="game-administrators-header">
          {inTelegram && <BackButton onClick={() => navigate(-1)} />}
          <h1>Game Administrators</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="game-administrators">
      <div className="game-administrators-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <h1>Game Administrators</h1>
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
              <div className="empty-state">
                <p>No administrator assignments yet.</p>
                <p>Create one to get started.</p>
              </div>
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
                    <Link
                      to={`/bunq-settings/user/${admin.userId}`}
                      className="btn btn-small btn-secondary"
                      title="Configure Bunq Settings"
                    >
                      <FaCog />
                    </Link>
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(admin.id)}
                      type="button"
                      aria-label="Delete assignment"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={() => viewModel.showCreateForm()}
              type="button"
            >
              Add Assignment
            </button>
          </div>
        </>
      ) : (
        <div className="create-form">
          <h2>New Assignment</h2>
          
          {state.createError && (
            <div className="error-message">
              {state.createError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="dayOfWeek">Day of Week</label>
            <select
              id="dayOfWeek"
              value={state.selectedDayOfWeek}
              onChange={(e) => viewModel.setSelectedDayOfWeek(parseInt(e.target.value))}
              disabled={state.isCreating}
            >
              {DAYS_OF_WEEK.map((day, index) => (
                <option key={index} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={state.withPositions}
                onChange={(e) => viewModel.setWithPositions(e.target.checked)}
                disabled={state.isCreating}
              />
              <span>5-1 positions game</span>
            </label>
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
            <button
              className="btn btn-secondary"
              onClick={handleCancelCreate}
              type="button"
              disabled={state.isCreating}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={state.isCreating || !state.selectedUserId}
              type="button"
            >
              {state.isCreating ? 'Creating...' : 'Create'}
            </button>
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

