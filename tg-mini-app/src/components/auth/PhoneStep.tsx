import React from 'react';
import { Button, Checkbox, Input } from '@telegram-apps/telegram-ui';

interface PhoneStepProps {
  countryPrefix: string;
  phoneLocal: string;
  isProcessing: boolean;
  error: string | null;
  onPhoneChange: (val: string) => void;
  onContinue: () => void;
  isDevMode?: boolean;
  onDevLogin?: (displayName: string, isAdmin: boolean, isTc: boolean) => void;
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
  const [isTc, setIsTc] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);
  
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  return (
    <div className="wa-section">
      <Input
        id="wa-phone"
        header="Phone number"
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={phoneLocal}
        ref={inputRef}
        before={<span className="wa-prefix">{countryPrefix}</span>}
        onChange={(e) => onPhoneChange(e.target.value)}
        disabled={isProcessing}
      />

      {isDevMode ? (
        <>
          <Input
            id="wa-name"
            header="Display name"
            type="text"
            value={displayName}
            ref={nameInputRef}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isProcessing}
            placeholder="Your name"
          />
          <div className="checkbox-label">
            <Checkbox
              id="wa-admin"
              aria-label="Administrator"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              disabled={isProcessing}
            />
            <span>Administrator</span>
          </div>
          <div className="checkbox-label">
            <Checkbox
              id="wa-tc"
              aria-label="Technical Committee"
              checked={isTc}
              onChange={(e) => setIsTc(e.target.checked)}
              disabled={isProcessing}
            />
            <span>Technical Committee</span>
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
          <Button
            type="button"
            stretched
            disabled={!phoneLocal.trim() || !displayName.trim() || isProcessing}
            onClick={() => onDevLogin(displayName, isAdmin, isTc)}
          >
            {isProcessing ? 'Logging in…' : 'Dev Login'}
          </Button>
        ) : (
          <Button
            type="button"
            stretched
            disabled={!phoneLocal.trim() || isProcessing}
            onClick={onContinue}
          >
            {isProcessing ? 'Sending…' : 'Continue'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default PhoneStep;
