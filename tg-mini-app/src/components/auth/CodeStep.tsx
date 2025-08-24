import React from 'react';

interface CodeStepProps {
  isProcessing: boolean;
  error: string | null;
  onVerify: (code: string) => void;
  // onResend may resolve with retryAfterSec (e.g., from server 429)
  onResend: () => Promise<number | void>;
  onCancel: () => void;
}

const CodeStep: React.FC<CodeStepProps> = ({
  isProcessing,
  error,
  onVerify,
  onResend,
  onCancel,
}) => {
  const CODE_LENGTH = 6;
  const [codeDigits, setCodeDigits] = React.useState<string[]>(() => Array.from({ length: CODE_LENGTH }, () => ''));
  
  // local ticking timer for resend cooldown
  const [now, setNow] = React.useState(Date.now());
  const [canResendAtLocal, setCanResendAtLocal] = React.useState<number>(() => Date.now() + 60_000);
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = React.useMemo(() => {
    const ms = canResendAtLocal - now;
    return ms > 0 ? Math.ceil(ms / 1000) : 0;
  }, [canResendAtLocal, now]);

  // Refs for auto-advance
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const setInputRef = (el: HTMLInputElement | null, idx: number) => {
    inputRefs.current[idx] = el;
  };

  // Track last action to distinguish verify vs resend
  const lastActionRef = React.useRef<null | 'verify' | 'resend'>(null);
  const prevProcessingRef = React.useRef(isProcessing);

  React.useEffect(() => {
    // focus first empty digit
    const idx = Math.max(0, codeDigits.findIndex((d) => d === ''));
    inputRefs.current[idx]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryAutoVerify = React.useCallback(
    (digits: string[]) => {
      const code = digits.join('');
      if (code.length === CODE_LENGTH && !isProcessing) {
        lastActionRef.current = 'verify';
        onVerify(code);
      }
    },
    [isProcessing, onVerify]
  );

  // When verification finishes with an error, clear inputs and focus first
  React.useEffect(() => {
    const wasProcessing = prevProcessingRef.current;
    prevProcessingRef.current = isProcessing;
    if (wasProcessing && !isProcessing && error && lastActionRef.current === 'verify') {
      setCodeDigits(Array.from({ length: CODE_LENGTH }, () => ''));
      // focus first input again
      inputRefs.current[0]?.focus();
      lastActionRef.current = null;
    }
  }, [isProcessing, error]);

  return (
    <div className="wa-section">
      <label className="wa-label">Enter code</label>
      <div
        style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '8px 0 12px' }}
        onPaste={(e) => {
          const text = (e.clipboardData.getData('text') || '').replace(/\D+/g, '').slice(0, CODE_LENGTH);
          if (text.length) {
            e.preventDefault();
            const updated = Array.from({ length: CODE_LENGTH }, (_, i) => text[i] || '');
            setCodeDigits(updated);
            const nextIdx = Math.min(text.length, CODE_LENGTH - 1);
            inputRefs.current[nextIdx]?.focus();
            if (text.length === CODE_LENGTH && !isProcessing) {
              lastActionRef.current = 'verify';
              onVerify(text);
            }
          }
        }}
      >
        {codeDigits.map((d, idx) => (
          <input
            key={idx}
            ref={(el) => setInputRef(el, idx)}
            className="wa-input"
            style={{ width: 40, textAlign: 'center' }}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={d}
            disabled={isProcessing}
            onChange={(e) => {
              const val = e.target.value;
              const v = val.replace(/\D+/g, '').slice(0, 1);
              setCodeDigits((prev) => {
                const next = [...prev];
                next[idx] = v;
                // auto-advance focus
                if (v && idx < CODE_LENGTH - 1) {
                  inputRefs.current[idx + 1]?.focus();
                }
                // attempt auto-verify when all digits present
                tryAutoVerify(next);
                return next;
              });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace') {
                if (codeDigits[idx]) {
                  setCodeDigits((prev) => {
                    const next = [...prev];
                    next[idx] = '';
                    return next;
                  });
                } else if (idx > 0) {
                  inputRefs.current[idx - 1]?.focus();
                  setCodeDigits((prev) => {
                    const next = [...prev];
                    next[idx - 1] = '';
                    return next;
                  });
                }
              }
            }}
          />
        ))}
      </div>

      {error && (
        <p className="wa-error" role="alert" style={{ marginTop: 8, textAlign: 'center' }}>{error}</p>
      )}

      <div className="wa-actions" style={{ gap: 8, display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="wa-button"
          disabled={isProcessing || secondsLeft > 0}
          onClick={async () => {
            try {
              lastActionRef.current = 'resend';
              const retryAfterSec = await onResend();
              if (typeof retryAfterSec === 'number' && retryAfterSec > 0) {
                setCanResendAtLocal(Date.now() + retryAfterSec * 1000);
              } else {
                // default local cooldown after successful resend
                setCanResendAtLocal(Date.now() + 60_000);
              }
            } catch (e) {
              // no-op: parent handles error display; we keep cooldown unchanged
            } finally {
              // clear action marker after resend completes
              if (lastActionRef.current === 'resend') lastActionRef.current = null;
            }
          }}
        >
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
        </button>
        <button
          type="button"
          className="wa-button danger"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CodeStep;
