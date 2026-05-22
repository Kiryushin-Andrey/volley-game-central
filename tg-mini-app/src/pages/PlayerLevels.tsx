import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@twa-dev/sdk/react';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { isTelegramApp } from '../utils/telegram';
import { playerLevelsApi } from '../services/api';
import type { AdminUserWithPlayerLevel, PlayerLevel, UserPublicInfo } from '../types';
import PlayerInfoDialog from '../components/PlayerInfoDialog';
import { PLAYER_LEVEL_LABELS, playerLevelPillClass } from '../utils/playerLevel';
import './PlayerLevels.scss';

const PlayerLevels: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  const [users, setUsers] = useState<AdminUserWithPlayerLevel[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlayerInfo, setShowPlayerInfo] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserPublicInfo | null>(null);
  const [levelSaving, setLevelSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await playerLevelsApi.listUsers();
      setUsers(data);
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load players';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/');
      return;
    }
    if (user?.isAdmin) {
      loadUsers();
    }
  }, [user, navigate, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.displayName || u.telegramUsername || '').toLowerCase();
      return name.includes(q);
    });
  }, [users, filter]);

  const handleShowPlayerInfo = (row: AdminUserWithPlayerLevel) => {
    setSelectedUser(row);
    setShowPlayerInfo(true);
  };

  const handleClosePlayerInfo = () => {
    setShowPlayerInfo(false);
    setSelectedUser(null);
  };

  const handlePlayerLevelChange = async (level: PlayerLevel) => {
    if (!selectedUser) return;
    setLevelSaving(true);
    try {
      const updated = await playerLevelsApi.updatePlayerLevel(selectedUser.id, level);
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
      );
      setSelectedUser((prev) => (prev ? { ...prev, playerLevel: updated.playerLevel } : prev));
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update player level';
      const tg = (window as { Telegram?: { WebApp?: { showAlert?: (msg: string) => void } } })
        ?.Telegram?.WebApp;
      tg?.showAlert?.(message);
      throw e;
    } finally {
      setLevelSaving(false);
    }
  };

  if (user && !user.isAdmin) {
    return null;
  }

  return (
    <div className="player-levels">
      <div className="player-levels-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <h1>Player levels</h1>
      </div>

      <div className="player-levels-filter">
        <label htmlFor="player-levels-name-filter">Filter by name</label>
        <input
          id="player-levels-name-filter"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search players…"
          autoComplete="off"
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      {isLoading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="player-levels-list">
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <p>{filter.trim() ? 'No players match your filter.' : 'No registered users yet.'}</p>
            </div>
          ) : (
            filteredUsers.map((row) => (
              <div
                key={row.id}
                className="player-levels-item"
                onClick={() => handleShowPlayerInfo(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleShowPlayerInfo(row);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="player-levels-item-main">
                  <div className="user-avatar">
                    {row.avatarUrl ? (
                      <img src={row.avatarUrl} alt="" />
                    ) : (
                      <span>{(row.displayName || '?').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="user-name">{row.displayName}</div>
                </div>
                {row.playerLevel ? (
                  <span className={playerLevelPillClass(row.playerLevel)}>
                    {PLAYER_LEVEL_LABELS[row.playerLevel]}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      <PlayerInfoDialog
        isOpen={showPlayerInfo}
        onClose={handleClosePlayerInfo}
        user={selectedUser}
        showPlayerLevelEditor
        playerLevelSaving={levelSaving}
        onPlayerLevelChange={handlePlayerLevelChange}
      />
    </div>
  );
};

export default PlayerLevels;
