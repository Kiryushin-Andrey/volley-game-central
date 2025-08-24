import React from 'react';
import { authApi } from '../../services/api';

interface UsernameStepProps {
  isProcessing: boolean;
  error: string | null;
  sessionId: string;
  onSubmit: (username: string) => void;
}

const UsernameStep: React.FC<UsernameStepProps> = ({
  isProcessing,
  error,
  sessionId,
  onSubmit,
}) => {
  const [username, setUsername] = React.useState('');
  const [availability, setAvailability] = React.useState<
    'idle' | 'checking' | 'available' | 'taken' | 'error'
  >('idle');
  const [availabilityMsg, setAvailabilityMsg] = React.useState<string>('');

  // Debounced availability check
  React.useEffect(() => {
    const name = username.trim();
    if (!name) {
      setAvailability('idle');
      setAvailabilityMsg('');
      return;
    }
    let cancelled = false;
    setAvailability('checking');
    setAvailabilityMsg('Checking…');
    const t = setTimeout(async () => {
      try {
        const res = await authApi.checkDisplayName(sessionId, name);
        if (cancelled) return;
        if (res.available) {
          setAvailability('available');
          setAvailabilityMsg('Name is available');
        } else {
          setAvailability('taken');
          setAvailabilityMsg('This name is already taken');
        }
      } catch (e) {
        if (cancelled) return;
        setAvailability('error');
        setAvailabilityMsg('Failed to check name. Please try again.');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, sessionId]);

  return (
    <div className="wa-section">
      <label className="wa-label" htmlFor="wa-username">Your display name</label>
      <input
        id="wa-username"
        className="wa-input"
        type="text"
        placeholder="e.g. John Doe"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        disabled={isProcessing}
      />
      {availability !== 'idle' && !error && (
        <p
          className={
            availability === 'available'
              ? 'wa-success'
              : availability === 'taken' || availability === 'error'
              ? 'wa-error'
              : 'wa-hint'
          }
          style={{ marginTop: 8 }}
          role={availability === 'taken' || availability === 'error' ? 'alert' : undefined}
        >
          {availabilityMsg}
        </p>
      )}
      {error && (
        <p className="wa-error" role="alert" style={{ marginTop: 8 }}>{error}</p>
      )}
      <div className="wa-actions">
        <button
          type="button"
          className="wa-button"
          disabled={!username.trim() || isProcessing || availability === 'taken' || availability === 'checking'}
          onClick={() => onSubmit(username.trim())}
        >
          {isProcessing ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default UsernameStep;
