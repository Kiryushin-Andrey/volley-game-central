export type WhatsAppStep = 'idle' | 'phone' | 'code';

interface WhatsAppAuthProps {
  step: WhatsAppStep;
  phone: string;
  code: string;
  onPhoneChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onContinue: () => void;
  onVerify: () => void;
}

function WhatsAppAuth({
  step,
  phone,
  code,
  onPhoneChange,
  onCodeChange,
  onContinue,
  onVerify,
}: WhatsAppAuthProps) {
  if (step === 'idle') return null;

  return (
    <div className="landing-auth">
      {/* Phone number step */}
      <div className="wa-section">
        <label className="wa-label" htmlFor="wa-phone">Phone number</label>
        <input
          id="wa-phone"
          className="wa-input"
          type="tel"
          inputMode="tel"
          placeholder="e.g. +31612345678"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
        />
        <p className="wa-note">This number must have a WhatsApp account. We will send an authentication code to this WhatsApp.</p>
        <div className="wa-actions">
          <button
            type="button"
            className="wa-button"
            disabled={!phone.trim()}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>

      {/* Code step */}
      {step === 'code' && (
        <div className="wa-section">
          <label className="wa-label" htmlFor="wa-code">Enter code</label>
          <input
            id="wa-code"
            className="wa-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
          />
          <div className="wa-actions">
            <button
              type="button"
              className="wa-button secondary"
              disabled={!code.trim()}
              onClick={onVerify}
            >
              Verify
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsAppAuth;
