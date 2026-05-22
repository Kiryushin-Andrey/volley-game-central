import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@twa-dev/sdk/react';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { isTelegramApp } from '../utils/telegram';
import { adminUsersApi } from '../services/api';
import type { AdminUserListItem, PlayerLevel } from '../types';
import LevelPill from '../components/LevelPill';
import PlayerInfoDialog from '../components/PlayerInfoDialog';
import './PlayerLevels.scss';

const PlayerLevels: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  const [allUsers, setAllUsers] = useState<AdminUserListItem[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [levelSaving, setLevelSaving] = useState(false);

  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminUsersApi.listUsers();
      setAllUsers(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || 'Failed to load players');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      void loadUsers();
    }
  }, [user?.isAdmin, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) => {
      const name = (u.displayName || u.telegramUsername || '').toLowerCase();
      return name.includes(q);
    });
  }, [allUsers, filter]);

  const handleRowClick = (row: AdminUserListItem) => {
    setSelectedUser(row);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSelectedUser(null);
  };

  const handleLevelChange = async (level: PlayerLevel) => {
    if (!selectedUser || levelSaving) return;
    setLevelSaving(true);
    try {
      const updated = await adminUsersApi.updatePlayerLevel(selectedUser.id, level);
      setAllUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      setSelectedUser(updated);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      const msg = err?.response?.data?.error || 'Failed to save level';
      if (typeof window !== 'undefined') {
        window.alert(msg);
      }
    } finally {
      setLevelSaving(false);
    }
  };

  if (user && !user.isAdmin) {
    return null;
  }

  return (
    <div className="player-levels-page">
      <div className="player-levels-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <h1>Player levels</h1>
      </div>

      <div className="player-levels-filter">
        <input
          type="search"
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter players by name"
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      {isLoading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="players-list">
          {filteredUsers.length === 0 ? (
            <div className="empty-hint">No players match your filter.</div>
          ) : (
            filteredUsers.map((row) => (
              <div
                key={row.id}
                className="player-item player-levels-row"
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(row);
                  }
                }}
              >
                <div className="player-info">
                  <div className="player-avatar">
                    {row.avatarUrl ? (
                      <img
                        src={row.avatarUrl}
                        alt=""
                        className="avatar-image"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {(row.displayName || row.telegramUsername || 'P')
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="player-details">
                    <div className="player-name">
                      {row.displayName ||
                        row.telegramUsername ||
                        `Player ${row.id}`}
                    </div>
                  </div>
                  {row.playerLevel && <LevelPill level={row.playerLevel} />}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <PlayerInfoDialog
        isOpen={showDialog}
        onClose={handleCloseDialog}
        user={selectedUser}
        allowLevelEdit
        playerLevel={selectedUser?.playerLevel ?? null}
        onPlayerLevelChange={handleLevelChange}
        levelChangeBusy={levelSaving}
      />
    </div>
  );
};

export default PlayerLevels;
