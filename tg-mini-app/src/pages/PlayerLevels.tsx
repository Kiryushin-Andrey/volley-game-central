import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@twa-dev/sdk/react';
import { isTelegramApp } from '../utils/telegram';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { playerLevelsAdminApi } from '../services/api';
import type { AdminUserLevelRow } from '../services/api';
import type { PlayerLevel } from '../types';
import './PlayerLevels.scss';

const PAGE_SIZE = 20;

const PlayerLevels: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  const [users, setUsers] = useState<AdminUserLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = appliedSearch.trim() || undefined;
      const res = await playerLevelsAdminApi.listUsers({
        limit: PAGE_SIZE,
        page,
        q,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch {
      setError('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch]);

  useEffect(() => {
    if (user?.isAdmin) {
      void load();
    }
  }, [user?.isAdmin, load]);

  const handleLevelChange = async (row: AdminUserLevelRow, raw: string) => {
    const playerLevel: PlayerLevel | null =
      raw === '' ? null : (raw as PlayerLevel);
    setSavingId(row.id);
    setError(null);
    try {
      await playerLevelsAdminApi.setLevel(row.id, playerLevel);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === row.id ? { ...u, playerLevel } : u
        )
      );
    } catch {
      setError('Failed to update level');
    } finally {
      setSavingId(null);
    }
  };

  if (user && !user.isAdmin) {
    return null;
  }

  const totalPages =
    total !== undefined ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : undefined;

  return (
    <div className="player-levels-page">
      <div className="player-levels-header">
        {inTelegram && <BackButton onClick={() => navigate(-1)} />}
        <h1>Player levels</h1>
      </div>

      <div className="player-levels-toolbar">
        <input
          type="search"
          className="player-levels-search"
          placeholder="Search by name…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          aria-label="Search users"
        />
        <button
          type="button"
          className="player-levels-search-btn"
          onClick={() => {
            setAppliedSearch(searchDraft.trim());
            setPage(1);
          }}
        >
          Search
        </button>
      </div>

      {error && <div className="player-levels-error">{error}</div>}

      {loading ? (
        <div className="player-levels-loading">Loading…</div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="player-levels-table" data-testid="admin-user-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} data-testid={`admin-user-row-${row.id}`}>
                    <td>
                      <div className="player-cell-name">{row.displayName}</div>
                      {row.telegramUsername && (
                        <div className="player-cell-meta">@{row.telegramUsername}</div>
                      )}
                    </td>
                    <td>
                      <select
                        className="player-level-select"
                        aria-label={`Level for ${row.displayName}`}
                        value={row.playerLevel ?? ''}
                        disabled={savingId === row.id}
                        onChange={(e) => void handleLevelChange(row, e.target.value)}
                      >
                        <option value="">Not set</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <p className="player-levels-empty">No users match your search.</p>
          )}

          {totalPages !== undefined && totalPages > 1 && (
            <div className="player-levels-pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {page}
                {total !== undefined ? ` of ${totalPages}` : ''}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PlayerLevels;
