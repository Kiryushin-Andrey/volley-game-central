import React from 'react';
import { userApi } from '../services/api';

type PhoneAuthStep = 'phone' | 'code';

interface PhoneAuthProps {
  onClose?: () => void;
}

// ViewModel holding all state and logic
class PhoneAuthViewModel {
  private listeners = new Set<() => void>();
  private state: {
    step: PhoneAuthStep;
    phoneNumber: string;
    authCode: string;
    isChecking: boolean;
    needsUsername: boolean;
    username: string;
    error: string | null;
  } = {
    step: 'phone',
    phoneNumber: '',
    authCode: '',
    isChecking: false,
    needsUsername: false,
    username: '',
    error: null,
  };

  // subscription API for React.useSyncExternalStore
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  getSnapshot = () => this.state;

  private setState(partial: Partial<typeof this.state>) {
    this.state = { ...this.state, ...partial };
    this.emit();
  }

  reset() {
    this.setState({
      step: 'phone',
      phoneNumber: '',
      authCode: '',
      isChecking: false,
      needsUsername: false,
      username: '',
      error: null,
    });
  }

  setPhoneNumber(value: string) {
    this.setState({ phoneNumber: value });
  }

  setUsername(value: string) {
    this.setState({ username: value });
  }

  setAuthCode(value: string) {
    this.setState({ authCode: value });
  }

  async handleContinue() {
    this.setState({ error: null });
    const trimmed = this.state.phoneNumber.trim();
    if (!trimmed) return;
    try {
      this.setState({ isChecking: true });
      const { exists } = await userApi.checkPhoneExists(trimmed);
      if (exists) {
        // Proceed to requesting the authentication code
        this.setState({ step: 'code' });
      } else {
        // Ask for username first
        this.setState({ needsUsername: true });
      }
    } catch (e: any) {
      const message = e?.response?.data?.error || 'Failed to check phone number';
      this.setState({ error: message });
    } finally {
      this.setState({ isChecking: false });
    }
  }

  handleSubmitUsername() {
    const name = this.state.username.trim();
    if (!name) {
      this.setState({ error: 'Please enter a username' });
      return;
    }
    this.setState({ error: null, step: 'code' });
  }

  handleVerify(onClose?: () => void) {
    // TODO: Implement verify flow (send code to backend and authenticate)
    // For now, just close the dialog if provided
    if (!this.state.authCode.trim()) return;
    onClose?.();
  }
}

function PhoneAuth({ onClose }: PhoneAuthProps) {
  const viewModel = React.useMemo(() => new PhoneAuthViewModel(), []);
  const state = React.useSyncExternalStore(
    viewModel.subscribe,
    viewModel.getSnapshot,
    viewModel.getSnapshot
  );

  // Reset VM on mount
  React.useEffect(() => {
    viewModel.reset();
  }, [viewModel]);

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
          value={state.phoneNumber}
          onChange={(e) => viewModel.setPhoneNumber(e.target.value)}
          disabled={state.isChecking}
        />
        <p className="wa-note">We will send a one-time code via SMS to this phone number.</p>

        {/* Username prompt if user not found */}
        {state.needsUsername && (
          <div className="wa-subsection" style={{ marginTop: 12 }}>
            <label className="wa-label" htmlFor="wa-username">Your name</label>
            <input
              id="wa-username"
              className="wa-input"
              type="text"
              placeholder="e.g. John Doe"
              value={state.username}
              onChange={(e) => viewModel.setUsername(e.target.value)}
              disabled={state.isChecking}
            />
            <p className="wa-note">We will create your account with this name.</p>
          </div>
        )}

        {state.error && (
          <p className="wa-error" role="alert" style={{ marginTop: 8 }}>{state.error}</p>
        )}

        <div className="wa-actions">
          {!state.needsUsername ? (
            <button
              type="button"
              className="wa-button"
              disabled={!state.phoneNumber.trim() || state.isChecking}
              onClick={() => viewModel.handleContinue()}
            >
              {state.isChecking ? 'Checking…' : 'Continue'}
            </button>
          ) : (
            <button
              type="button"
              className="wa-button"
              disabled={!state.username.trim() || state.isChecking}
              onClick={() => viewModel.handleSubmitUsername()}
            >
              Continue
            </button>
          )}
        </div>
      </div>

      {/* Code step */}
      {state.step === 'code' && (
        <div className="wa-section">
          <label className="wa-label" htmlFor="wa-code">Enter code</label>
          <input
            id="wa-code"
            className="wa-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="6-digit code"
            value={state.authCode}
            onChange={(e) => viewModel.setAuthCode(e.target.value)}
          />
          <div className="wa-actions">
            <button
              type="button"
              className="wa-button secondary"
              disabled={!state.authCode.trim()}
              onClick={() => viewModel.handleVerify(onClose)}
            >
              Verify
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhoneAuth;
