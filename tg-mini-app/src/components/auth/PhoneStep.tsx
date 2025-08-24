import React from 'react';

interface PhoneStepProps {
  countryPrefix: string;
  phoneLocal: string;
  isProcessing: boolean;
  error: string | null;
  onPhoneChange: (val: string) => void;
  onContinue: () => void;
}

const PhoneStep: React.FC<PhoneStepProps> = ({
  countryPrefix,
  phoneLocal,
  isProcessing,
  error,
  onPhoneChange,
  onContinue,
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
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
      <p className="wa-note">We will send a one-time code via SMS to this phone number.</p>

      {error && (
        <p className="wa-error" role="alert" style={{ marginTop: 8 }}>{error}</p>
      )}

      <div className="wa-actions">
        <button
          type="button"
          className="wa-button"
          disabled={!phoneLocal.trim() || isProcessing}
          onClick={onContinue}
        >
          {isProcessing ? 'Sending…' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default PhoneStep;
