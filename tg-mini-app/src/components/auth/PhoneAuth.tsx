import React from 'react';
import { authApi } from '../../services/api';
import PhoneStep from './PhoneStep';
import CodeStep from './CodeStep';
import UsernameStep from './UsernameStep';

type PhoneAuthStep = 'phone' | 'code' | 'username';

const COUNTRY_PREFIX = '+31';
const CODE_LENGTH = 6;

interface PhoneAuthProps {
  onClose?: () => void;
  isDevMode?: boolean;
}

// ViewModel holding all state and logic
class PhoneAuthViewModel {
  private listeners = new Set<() => void>();
  private state: {
    step: PhoneAuthStep;
    phoneLocal: string; // digits only, without prefix
    isProcessing: boolean;
    error: string | null;
    sessionId: string | null;
  } = {
    step: 'phone',
    phoneLocal: '',
    isProcessing: false,
    error: null,
    sessionId: null,
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
      phoneLocal: '',
      isProcessing: false,
      error: null,
      sessionId: null,
    });
  }

  setPhoneLocal(value: string) {
    // keep only digits
    const digits = value.replace(/\D+/g, '');
    this.setState({ phoneLocal: digits });
  }

  get fullPhone() {
    return `${COUNTRY_PREFIX}${this.state.phoneLocal}`;
  }

  async startAuth() {
    this.setState({ error: null });
    if (!this.state.phoneLocal) return;
    try {
      this.setState({ isProcessing: true });
      const res = await authApi.startPhoneAuth(this.fullPhone);
      this.setState({
        step: 'code',
        sessionId: res.sessionId,
      });
    } catch (e: any) {
      const message = e?.response?.data?.error || 'Failed to start authentication';
      this.setState({ error: message });
    } finally {
      this.setState({ isProcessing: false });
    }
  }

  async resendCode(): Promise<number | void> {
    try {
      this.setState({ isProcessing: true, error: null });
      const res = await authApi.startPhoneAuth(this.fullPhone);
      this.setState({ sessionId: res.sessionId });
      return;
    } catch (e: any) {
      const status = e?.response?.status as number | undefined;
      if (status === 429) {
        // Extract retry seconds from body or Retry-After header
        const retryFromBody = e?.response?.data?.retryAfterSec;
        const retryFromHeader = e?.response?.headers?.['retry-after'];
        let retryAfterSec = 0;
        if (typeof retryFromBody === 'number') retryAfterSec = retryFromBody;
        else if (typeof retryFromHeader === 'string') retryAfterSec = parseInt(retryFromHeader, 10) || 0;
        const message = e?.response?.data?.error || `Please wait ${retryAfterSec || 60}s before requesting a new code`;
        this.setState({ error: message });
        return retryAfterSec || 60;
      }
      const message = e?.response?.data?.error || 'Failed to resend code';
      this.setState({ error: message });
      return;
    } finally {
      this.setState({ isProcessing: false });
    }
  }

  cancelCodeEntry() {
    this.setState({ step: 'phone', error: null });
  }

  async verifyCode(code: string, onSuccess: () => void) {
    if (code.length !== CODE_LENGTH) return;
    if (!this.state.sessionId) {
      this.setState({ error: 'Session not initialized. Please restart authentication.' });
      return;
    }
    try {
      this.setState({ isProcessing: true, error: null });
      const res = await authApi.verifyPhoneAuth(this.state.sessionId, code);
      if (res.creatingNewUser) {
        this.setState({ step: 'username' });
      } else {
        onSuccess();
      }
    } catch (e: any) {
      const message = e?.response?.data?.error || 'Invalid or expired code';
      this.setState({ error: message });
    } finally {
      this.setState({ isProcessing: false });
    }
  }

  async submitUsername(username: string, onSuccess: () => void) {
    const name = username.trim();
    if (!name) {
      this.setState({ error: 'Please enter your name' });
      return;
    }
    if (!this.state.sessionId) {
      this.setState({ error: 'Session not initialized. Please restart authentication.' });
      return;
    }
    try {
      this.setState({ isProcessing: true, error: null });
      await authApi.createUser(this.state.sessionId, name);
      onSuccess();
    } catch (e: any) {
      const message = e?.response?.data?.error || 'Failed to save display name';
      this.setState({ error: message });
    } finally {
      this.setState({ isProcessing: false });
    }
  }

  async devLogin(displayName: string, isAdmin: boolean, onSuccess: () => void) {
    const name = displayName.trim();
    if (!name) {
      this.setState({ error: 'Please enter your name' });
      return;
    }
    if (!this.state.phoneLocal) {
      this.setState({ error: 'Please enter your phone number' });
      return;
    }
    try {
      this.setState({ isProcessing: true, error: null });
      await authApi.devLogin(this.fullPhone, name, isAdmin);
      onSuccess();
    } catch (e: any) {
      const message = e?.response?.data?.error || 'Dev login failed';
      this.setState({ error: message });
    } finally {
      this.setState({ isProcessing: false });
    }
  }
}

function PhoneAuth({ onClose, isDevMode }: PhoneAuthProps) {
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

  const finishAuth = () => {
    if (onClose) onClose();
    // After successful auth, ensure the app reloads to fetch authenticated state and show games list
    if (window.location.pathname === '/') {
      window.location.reload();
    } else {
      window.location.replace('/');
    }
  };

  return (
    <div className="landing-auth">
      {/* Phone number step */}
      {state.step === 'phone' && (
        <PhoneStep
          countryPrefix={COUNTRY_PREFIX}
          phoneLocal={state.phoneLocal}
          isProcessing={state.isProcessing}
          error={state.error}
          onPhoneChange={(v) => viewModel.setPhoneLocal(v)}
          onContinue={() => viewModel.startAuth()}
          isDevMode={isDevMode}
          onDevLogin={(name, isAdmin) => viewModel.devLogin(name, isAdmin, finishAuth)}
        />
      )}

      {/* Code step */}
      {state.step === 'code' && (
        <CodeStep
          isProcessing={state.isProcessing}
          error={state.error}
          onVerify={(code) => viewModel.verifyCode(code, finishAuth)}
          onResend={() => viewModel.resendCode()}
          onCancel={() => viewModel.cancelCodeEntry()}
        />
      )}

      {/* Username step */}
      {state.step === 'username' && (
        <UsernameStep
          isProcessing={state.isProcessing}
          error={state.error}
          sessionId={state.sessionId!}
          onSubmit={(name) => viewModel.submitUsername(name, finishAuth)}
        />
      )}
    </div>
  );
}

export default PhoneAuth;
