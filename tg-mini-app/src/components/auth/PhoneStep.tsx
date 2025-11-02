import React from 'react';

interface PhoneStepProps {
  countryPrefix: string;
  phoneLocal: string;
  isProcessing: boolean;
  error: string | null;
  onPhoneChange: (val: string) => void;
  onContinue: () => void;
  isDevMode?: boolean;
  onDevLogin?: (displayName: string, isAdmin: boolean) => void;
}

const PhoneStep: React.FC<PhoneStepProps> = ({
  countryPrefix,
  phoneLocal,
  isProcessing,
  error,
  onPhoneChange,
  onContinue,
  isDevMode,
  onDevLogin,
}) => {
  const [displayName, setDisplayName] = React.useState('');
  const [isAdmin, setIsAdmin] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  return (
    <div className="wa-section">
      <label className="wa-label" htmlFor="wa-phone">Phone number</label>
      <div className="wa-input-group">
        <span className="wa-prefix">{countryPrefix}</span>
        <input
          id="wa-phone"
          className="wa-input"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={phoneLocal}
          ref={inputRef}
          onChange={(e) => onPhoneChange(e.target.value)}
          disabled={isProcessing}
        />
      </div>

      {isDevMode ? (
        <>
          <label className="wa-label" htmlFor="wa-name" style={{ marginTop: 16 }}>Display name</label>
          <input
            id="wa-name"
            className="wa-input"
            type="text"
            value={displayName}
            ref={nameInputRef}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isProcessing}
            placeholder="Your name"
          />
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="wa-admin"
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              disabled={isProcessing}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="wa-admin" style={{ cursor: 'pointer', fontSize: 14 }}>Administrator</label>
          </div>
          <p className="wa-note">Dev mode: No SMS verification required</p>
        </>
      ) : (
        <p className="wa-note">We will send a one-time code via SMS to this phone number.</p>
      )}

      {error && (
        <p className="wa-error" role="alert" style={{ marginTop: 8 }}>{error}</p>
      )}

      <div className="wa-actions">
        {isDevMode && onDevLogin ? (
          <button
            type="button"
            className="wa-button"
            disabled={!phoneLocal.trim() || !displayName.trim() || isProcessing}
            onClick={() => onDevLogin(displayName, isAdmin)}
          >
            {isProcessing ? 'Logging in…' : 'Dev Login'}
          </button>
        ) : (
          <button
            type="button"
            className="wa-button"
            disabled={!phoneLocal.trim() || isProcessing}
            onClick={onContinue}
          >
            {isProcessing ? 'Sending…' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PhoneStep;
