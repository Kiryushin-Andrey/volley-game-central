import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { UserSearchInput } from '../components/UserSearchInput';
import { BackButton } from '@twa-dev/sdk/react';
import { isTelegramApp } from '../utils/telegram';
import {
  PriorityPlayersViewModel,
  PriorityPlayersState,
} from '../viewmodels/PriorityPlayersViewModel';
import PlayerInfoDialog from '../components/PlayerInfoDialog';
import type { UserPublicInfo } from '../types';
import './PriorityPlayers.scss';
import WebApp from '@twa-dev/sdk';
import { DAYS_OF_WEEK } from '../utils/constants';

const PriorityPlayers: React.FC = () => {
  const navigate = useNavigate();
  const { gameAdministratorId } = useParams<{ gameAdministratorId: string }>();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  const adminId = gameAdministratorId ? parseInt(gameAdministratorId) : null;

  // State management
  const [state, setState] = useState<PriorityPlayersState>(
    PriorityPlayersViewModel.getInitialState()
  );
  const [showPlayerInfo, setShowPlayerInfo] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPublicInfo | null>(null);

  // Create viewmodel instance with state updater
  const updateState = useCallback((updates: Partial<PriorityPlayersState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Create viewmodel instance once
  const viewModelRef = useRef<PriorityPlayersViewModel | null>(null);
  if (!viewModelRef.current) {
    viewModelRef.current = new PriorityPlayersViewModel(updateState);
  }
  const viewModel = viewModelRef.current;

  // Load data on mount
  useEffect(() => {
    const adminIdNum = gameAdministratorId ? parseInt(gameAdministratorId) : null;
    if (!adminIdNum || Number.isNaN(adminIdNum)) {
      navigate('/game-administrators');
      return;
    }
    viewModel.initialize(adminIdNum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameAdministratorId, navigate]);

  const handleUserSelect = async (userId: number) => {
    if (!adminId || Number.isNaN(adminId)) {
      if (inTelegram) {
        WebApp.showPopup({
          title: 'Error',
          message: 'Invalid game administrator assignment',
          buttons: [{ type: 'ok' }]
        });
      }
      return;
    }

    const success = await viewModel.createAssignment(
      adminId,
      userId,
      () => {
        // Hide the user search after successful creation
        viewModel.hideCreateForm();
      }
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
          WebApp.showConfirm('Are you sure you want to delete this priority player assignment?', (confirmed) => {
            resolve(confirmed);
          });
        });
      }
      return window.confirm('Are you sure you want to delete this priority player assignment?');
    };

    const success = await viewModel.deleteAssignment(id, state.priorityPlayers, confirmFn);

    if (!success && inTelegram) {
      WebApp.showPopup({
        title: 'Error',
        message: state.error,
        buttons: [{ type: 'ok' }]
      });
    }
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

  // Find the specific game administrator from URL
  const currentAdmin = viewModel.getCurrentAdmin(state);

  // Check if user can manage priority players for this assignment
  const canManage = viewModel.canManage(state, user?.id, user?.isAdmin);

  // Don't render if not authorized
  if (user && !user.isAdmin && !state.isLoading && currentAdmin) {
    if (currentAdmin.userId !== user.id) {
      navigate('/game-administrators');
      return null;
    }
  }

  // Redirect if admin not found
  if (!state.isLoading && adminId && !currentAdmin && state.gameAdministrators.length > 0) {
    navigate('/game-administrators');
    return null;
  }

  if (state.isLoading) {
    return (
      <div className="priority-players">
        <div className="priority-players-header">
          {inTelegram && <BackButton onClick={() => navigate(-1)} />}
          <h1>Priority Players</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="priority-players">
      <div className="priority-players-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <h1>Priority Players</h1>
      </div>

      {state.error && (
        <div className="error-message">
          {state.error}
        </div>
      )}

      {currentAdmin ? (
        <div className="assignment-group">
          <div className="assignment-header">
            <div className="assignment-info">
              <div className="assignment-user">
                <div
                  className="user-avatar clickable"
                  onClick={() => handleShowPlayerInfo(currentAdmin.user)}
                >
                  {currentAdmin.user.avatarUrl ? (
                    <img src={currentAdmin.user.avatarUrl} alt={`${currentAdmin.user.displayName}'s avatar`} />
                  ) : (
                    <span>{currentAdmin.user.displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="user-details">
                  <div
                    className="user-name clickable"
                    onClick={() => handleShowPlayerInfo(currentAdmin.user)}
                  >
                    {currentAdmin.user.displayName}
                  </div>
                  <div className="assignment-details">
                    <span className="day-badge">{DAYS_OF_WEEK[currentAdmin.dayOfWeek]}</span>
                    {currentAdmin.withPositions && (
                      <span className="positions-badge">5-1</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="priority-players-list">
            {state.priorityPlayers.length === 0 ? (
              <div className="empty-priority-players">
                No priority players yet.
              </div>
            ) : (
              state.priorityPlayers.map((pp) => (
                <div key={pp.id} className="priority-player-item">
                  <div className="priority-player-info">
                    <div
                      className="user-avatar clickable"
                      onClick={() => handleShowPlayerInfo(pp.user)}
                    >
                      {pp.user.avatarUrl ? (
                        <img src={pp.user.avatarUrl} alt={`${pp.user.displayName}'s avatar`} />
                      ) : (
                        <span>{pp.user.displayName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div
                      className="user-name clickable"
                      onClick={() => handleShowPlayerInfo(pp.user)}
                    >
                      {pp.user.displayName}
                    </div>
                  </div>
                  {canManage && (
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(pp.id)}
                      type="button"
                      aria-label="Delete priority player"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Game administrator assignment not found.</p>
        </div>
      )}

      {canManage && (
        <div className="actions">
          {state.showCreateForm && (
            <div className="user-search-container">
              <UserSearchInput
                onSelectUser={handleUserSelect}
                onCancel={handleCancelCreate}
                disabled={state.isCreating}
                placeholder="Search users to add..."
              />
            </div>
          )}
          {state.createError && (
            <div className="error-message">
              {state.createError}
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={() => viewModel.showCreateForm()}
            type="button"
            disabled={state.showCreateForm}
          >
            Add Priority Player
          </button>
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

export default PriorityPlayers;

