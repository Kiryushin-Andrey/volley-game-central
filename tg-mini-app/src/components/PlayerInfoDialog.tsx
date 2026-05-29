import React, { useEffect, useMemo, useState } from 'react';
import './PlayerInfoDialog.scss';
import type { PlayerLevel, UserPublicInfo } from '../types';
import { userApi, playerLevelsApi, type UnpaidRegistration } from '../services/api';
import UnpaidGamesList from './UnpaidGamesList';
import { PLAYER_LEVEL_LABELS } from '../utils/playerLevel';
import type { PlayerInfoDialogViewer } from '../utils/userRoles';

export type { PlayerInfoDialogViewer };

// ViewModel encapsulating state and async loading logic for unpaid games
class PlayerInfoDialogViewModel {
  private requestId = 0;

  constructor(
    private setUnpaidGames: React.Dispatch<React.SetStateAction<UnpaidRegistration[] | null>>,
    private setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    private setError: React.Dispatch<React.SetStateAction<string | null>>,
  ) {}

  reset() {
    this.setUnpaidGames(null);
    this.setError(null);
  }

  cancel() {
    // Invalidate in-flight requests
    this.requestId++;
  }

  async load(userId: number) {
    const current = ++this.requestId;
    this.setLoading(true);
    this.setError(null);
    try {
      const data = await userApi.getUserUnpaidGames(userId);
      if (this.requestId !== current) return; // cancelled or superseded
      this.setUnpaidGames(data);
    } catch (e: any) {
      if (this.requestId !== current) return;
      this.setError(e?.response?.data?.error || 'Failed to load unpaid games');
    } finally {
      if (this.requestId !== current) return;
      this.setLoading(false);
    }
  }
}

interface PlayerInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserPublicInfo | null;
  viewer?: PlayerInfoDialogViewer;
  allowLevelEdit?: boolean;
  loadLevelProfile?: boolean;
  playerLevel?: PlayerLevel | null;
  playerLevelSetBy?: { displayName: string } | null;
  onPlayerLevelChange?: (level: PlayerLevel) => Promise<boolean>;
  levelChangeBusy?: boolean;
}

const PlayerInfoDialog: React.FC<PlayerInfoDialogProps> = ({
  isOpen,
  onClose,
  user,
  viewer = 'globalAdmin',
  allowLevelEdit,
  loadLevelProfile,
  playerLevel: playerLevelProp,
  playerLevelSetBy: playerLevelSetByProp,
  onPlayerLevelChange,
  levelChangeBusy,
}) => {
  const [unpaidGames, setUnpaidGames] = useState<UnpaidRegistration[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<string | null | undefined>(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [loadedLevel, setLoadedLevel] = useState<PlayerLevel | null | undefined>(undefined);
  const [loadedSetBy, setLoadedSetBy] = useState<{ displayName: string } | null | undefined>(undefined);
  const [levelProfileLoading, setLevelProfileLoading] = useState(false);
  const [levelProfileError, setLevelProfileError] = useState<string | null>(null);

  const vm = useMemo(() => new PlayerInfoDialogViewModel(setUnpaidGames, setLoading, setError), []);

  const showFinancialSections = viewer === 'globalAdmin' || viewer === 'assignedGameAdmin';
  const showModeration = showFinancialSections;
  const showLevelSection = viewer === 'globalAdmin' || viewer === 'tc';

  const resolvedLevel =
    playerLevelProp !== undefined ? playerLevelProp : loadedLevel !== undefined ? loadedLevel : null;
  const resolvedSetBy =
    playerLevelSetByProp !== undefined
      ? playerLevelSetByProp
      : loadedSetBy !== undefined
        ? loadedSetBy
        : null;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Prevent any global Escape handlers (e.g., navigation/back) from firing
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    if (isOpen) document.addEventListener('keydown', onEsc, { capture: true });
    return () => document.removeEventListener('keydown', onEsc, { capture: true } as any);
  }, [isOpen, onClose]);

  // Load unpaid games for the selected user when dialog opens or user changes
  useEffect(() => {
    if (!isOpen || !user || !showFinancialSections) return;
    vm.reset();
    vm.load(user.id);
    setBlockReason(user.blockReason ?? null);
    return () => vm.cancel();
  }, [isOpen, user?.id, vm, showFinancialSections]);

  useEffect(() => {
    if (!isOpen || !user) {
      setLoadedLevel(undefined);
      setLoadedSetBy(undefined);
      setLevelProfileError(null);
      setLevelProfileLoading(false);
      return;
    }
    if (!showLevelSection) return;
    if (!loadLevelProfile) return;
    if (playerLevelProp !== undefined && playerLevelSetByProp !== undefined) return;

    let cancelled = false;
    setLevelProfileLoading(true);
    setLevelProfileError(null);
    void playerLevelsApi
      .getUser(user.id)
      .then((profile) => {
        if (cancelled) return;
        setLoadedLevel(profile.playerLevel);
        setLoadedSetBy(profile.playerLevelSetBy);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setLevelProfileError(e?.response?.data?.error || 'Failed to load player level');
      })
      .finally(() => {
        if (!cancelled) setLevelProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    user?.id,
    showLevelSection,
    loadLevelProfile,
    playerLevelProp,
    playerLevelSetByProp,
  ]);

  if (!isOpen || !user) return null;

  const tmeLink = user.telegramUsername ? `https://t.me/${encodeURIComponent(user.telegramUsername)}` : undefined;

  const handleSendReminder = async () => {
    if (!user) return;
    setReminderError(null);
    setSendingReminder(true);
    try {
      await userApi.sendPaymentReminder(user.id);
    } catch (e: any) {
      const message = e?.response?.data?.error || e?.message || 'Failed to send reminder';
      setReminderError(message);
    } finally {
      setSendingReminder(false);
    }
  };

  const handleBlock = async () => {
    if (!user || moderationBusy) return;
    // Request reason from admin
    const reason = typeof window !== 'undefined' ? window.prompt('Enter blocking reason:') : '';
    if (!reason || !reason.trim()) return;
    try {
      setModerationBusy(true);
      const res = await userApi.blockUser(user.id, reason.trim());
      setBlockReason(res.user.blockReason ?? reason.trim());
    } catch (e: any) {
      const tg: any = (window as any)?.Telegram?.WebApp;
      const msg = e?.response?.data?.error || e?.message || 'Failed to block user';
      tg?.showAlert?.(msg);
    } finally {
      setModerationBusy(false);
    }
  };

  const handleUnblock = async () => {
    if (!user || moderationBusy) return;
    try {
      setModerationBusy(true);
      await userApi.unblockUser(user.id);
      setBlockReason(null);
    } catch (e: any) {
      const tg: any = (window as any)?.Telegram?.WebApp;
      const msg = e?.response?.data?.error || e?.message || 'Failed to unblock user';
      tg?.showAlert?.(msg);
    } finally {
      setModerationBusy(false);
    }
  };

  return (
    <div className="player-info-dialog-overlay" onClick={onClose}>
      <div className="player-info-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Player details</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="dialog-content">
          <div className="avatar-wrap">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={`${user.displayName}'s avatar`} className="avatar" />
            ) : (
              <div className="avatar placeholder">{(user.displayName || user.telegramUsername || `Player ${user.id}`).charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="info-rows">
            <div className="row">
              <span className="label">Display Name</span>
              <span className="value">{user.displayName || user.telegramUsername || `Player ${user.id}`}</span>
            </div>
            <div className="row">
              <span className="label">Telegram ID</span>
              <span className="value">{user.telegramId}</span>
            </div>
            {tmeLink && (
              <div className="row">
                <span className="label">Telegram Username</span>
                <a className="value link" href={tmeLink} target="_blank" rel="noopener noreferrer">@{user.telegramUsername}</a>
              </div>
            )}
            {user.phoneNumber && (
              <div className="row">
                <span className="label">Phone</span>
                <a className="value link" href={`tel:${user.phoneNumber}`}>{user.phoneNumber}</a>
              </div>
            )}
          </div>

          {showFinancialSections && (loading || error || (unpaidGames && unpaidGames.length > 0)) && (
            <div className="unpaid-section" style={{ marginTop: 16 }}>
              <div className="row" style={{ justifyContent: 'flex-start' }}>
                <span className="label">Unpaid games</span>
              </div>
              {loading && <div className="hint">Loading…</div>}
              {!loading && error && <div className="error">{error}</div>}
              {!loading && !error && unpaidGames && unpaidGames.length > 0 && (
                <UnpaidGamesList items={unpaidGames} />
              )}
              {!loading && !error && unpaidGames && unpaidGames.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reminderError && <div className="error">{reminderError}</div>}
                  <button
                    className="primary-btn"
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {sendingReminder ? 'Sending…' : 'Send payment reminder'}
                  </button>
                </div>
              )}
            </div>
          )}

          {showLevelSection && allowLevelEdit && onPlayerLevelChange && (
            <div className="player-level-section" style={{ marginTop: 20 }}>
              <div className="row" style={{ justifyContent: 'flex-start', marginBottom: 8 }}>
                <span className="label">Player level</span>
              </div>
              {!resolvedLevel && (
                <div className="hint" style={{ marginBottom: 8 }}>
                  Unassigned
                </div>
              )}
              <div className="level-selector" role="group" aria-label="Player level">
                {(['beginner', 'intermediate', 'advanced'] as PlayerLevel[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`level-selector-btn${resolvedLevel === level ? ' active' : ''}`}
                    disabled={levelChangeBusy}
                    onClick={async () => {
                      if (resolvedLevel === level || levelChangeBusy) return;
                      await onPlayerLevelChange(level);
                    }}
                  >
                    {PLAYER_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
              {resolvedLevel && resolvedSetBy && (
                <div className="hint" style={{ marginTop: 8 }}>
                  Set by {resolvedSetBy.displayName}
                </div>
              )}
            </div>
          )}

          {showLevelSection && !allowLevelEdit && (
            <div className="player-level-section" style={{ marginTop: 20 }}>
              <div className="row" style={{ justifyContent: 'flex-start', marginBottom: 8 }}>
                <span className="label">Player level</span>
              </div>
              {levelProfileLoading && <div className="hint">Loading…</div>}
              {!levelProfileLoading && levelProfileError && (
                <div className="error">{levelProfileError}</div>
              )}
              {!levelProfileLoading && !levelProfileError && !resolvedLevel && (
                <div className="hint">Unassigned</div>
              )}
              {!levelProfileLoading && !levelProfileError && resolvedLevel && (
                <div className="level-readonly-value">{PLAYER_LEVEL_LABELS[resolvedLevel]}</div>
              )}
              {!levelProfileLoading && !levelProfileError && resolvedLevel && resolvedSetBy && (
                <div className="hint" style={{ marginTop: 8 }}>
                  Set by {resolvedSetBy.displayName}
                </div>
              )}
            </div>
          )}

          {showModeration && (
            <div className="moderation-section" style={{ marginTop: 20 }}>
              {blockReason ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="hint">Blocked: {blockReason}</div>
                  <button
                    className="primary-btn"
                    onClick={handleUnblock}
                    disabled={moderationBusy}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {moderationBusy ? 'Processing…' : 'Unblock'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="danger-btn"
                    onClick={handleBlock}
                    disabled={moderationBusy}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {moderationBusy ? 'Processing…' : 'Block'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerInfoDialog;
