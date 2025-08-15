import React, { useEffect, useMemo, useState } from 'react';
import './PlayerInfoDialog.scss';
import type { UserPublicInfo } from '../types';
import { userApi, type UnpaidRegistration } from '../services/api';

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
}

const PlayerInfoDialog: React.FC<PlayerInfoDialogProps> = ({ isOpen, onClose, user }) => {
  const [unpaidGames, setUnpaidGames] = useState<UnpaidRegistration[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<string | null | undefined>(null);
  const [moderationBusy, setModerationBusy] = useState(false);

  const vm = useMemo(() => new PlayerInfoDialogViewModel(setUnpaidGames, setLoading, setError), []);

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
    if (!isOpen || !user) return;
    vm.reset();
    vm.load(user.id);
    setBlockReason(user.blockReason ?? null);
    return () => vm.cancel();
  }, [isOpen, user?.id, vm]);

  if (!isOpen || !user) return null;

  const tmeLink = user.username ? `https://t.me/${encodeURIComponent(user.username)}` : undefined;

  // Format like: "Sun 8 Jun, 17:00"
  const formatGameDate = (dt: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const weekday = get('weekday');
    const day = get('day');
    const month = get('month');
    const hour = get('hour');
    const minute = get('minute');
    return `${weekday} ${day} ${month}, ${hour}:${minute}`;
  };

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
      const res = await userApi.blockUser(user.telegramId, reason.trim());
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
      await userApi.unblockUser(user.telegramId);
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
              <img src={user.avatarUrl} alt={`${user.username}'s avatar`} className="avatar" />
            ) : (
              <div className="avatar placeholder">{(user.username || `Player ${user.id}`).charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="info-rows">
            <div className="row">
              <span className="label">Name</span>
              <span className="value">{user.username || `Player ${user.id}`}</span>
            </div>
            <div className="row">
              <span className="label">Telegram ID</span>
              <span className="value">{user.telegramId}</span>
            </div>
            {tmeLink && (
              <div className="row">
                <span className="label">Username</span>
                <a className="value link" href={tmeLink} target="_blank" rel="noopener noreferrer">@{user.username}</a>
              </div>
            )}
          </div>

          <div className="unpaid-section" style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'flex-start' }}>
              <span className="label">Unpaid games</span>
            </div>
            {loading && <div className="hint">Loading…</div>}
            {!loading && error && <div className="error">{error}</div>}
            {!loading && !error && unpaidGames && unpaidGames.length === 0 && (
              <div className="hint">No unpaid registrations</div>
            )}
            {!loading && !error && unpaidGames && unpaidGames.length > 0 && (
              <ul className="unpaid-list" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unpaidGames.map((item, idx) => {
                  const dt = new Date(item.dateTime);
                  const hasAmount = item.totalAmountCents != null;
                  const amount = hasAmount ? (item.totalAmountCents! / 100).toFixed(2) : null;
                  return (
                    <li key={idx} className="unpaid-item" style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
                      <div className="unpaid-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {hasAmount && <div style={{ fontWeight: 600 }}>€{amount}</div>}
                          <div className="unpaid-sub" style={{ opacity: 0.8, fontSize: 12, marginTop: 2 }}>
                            {formatGameDate(dt)} {item.locationName ? `• ${item.locationName}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {item.paymentLink && (
                            <a
                              className="link"
                              href={item.paymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-block', marginTop: 4 }}
                            >
                              Pay now →
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
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

          {/* Moderation section: Block / Unblock */}
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
        </div>
      </div>
    </div>
  );
};

export default PlayerInfoDialog;
