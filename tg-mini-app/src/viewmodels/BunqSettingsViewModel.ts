import { bunqApi } from '../services/api';

export interface BunqCredentials {
  apiKey: string;
  password: string;
}

export interface MonetaryAccount {
  id: number;
  description: string;
}

export interface BunqSettingsState {
  isEnabled: boolean;
  isLoading: boolean;
  isProcessing: boolean;
  showCredentialsForm: boolean;
  credentials: BunqCredentials;
  error: string;
  successMessage: string;
  selectedMonetaryAccountId: number | null;
  storedPassword: string;
}

export type BunqSettingsStateUpdater = (updates: Partial<BunqSettingsState>) => void;

export class BunqSettingsViewModel {
  private updateState: BunqSettingsStateUpdater;

  constructor(updateState: BunqSettingsStateUpdater) {
    this.updateState = updateState;
  }

  /**
   * Load Bunq integration status from the API
   */
  async loadBunqStatus(): Promise<void> {
    try {
      this.updateState({ isLoading: true, error: '' });
      const status = await bunqApi.getStatus();
      this.updateState({ isEnabled: status.enabled });
    } catch (err: any) {
      console.error('Failed to load Bunq status:', err);
      this.updateState({ error: 'Failed to load Bunq integration status' });
    } finally {
      this.updateState({ isLoading: false });
    }
  }

  /**
   * Enable Bunq integration with provided credentials
   */
  async handleEnableIntegration(credentials: BunqCredentials): Promise<void> {
    if (!credentials.apiKey.trim() || !credentials.password.trim()) {
      this.updateState({ error: 'Please provide both API key and password' });
      return;
    }

    try {
      this.updateState({ 
        isProcessing: true, 
        error: '', 
        successMessage: '' 
      });
      
      const result = await bunqApi.enable(credentials.apiKey.trim(), credentials.password.trim());
      
      if (result.success) {
        this.updateState({ 
          isEnabled: true,
          showCredentialsForm: false,
          successMessage: 'Bunq integration enabled successfully!',
          storedPassword: credentials.password.trim(),
          credentials: { apiKey: '', password: '' }
        });
      } else {
        this.updateState({ 
          error: result.message || 'Failed to enable Bunq integration' 
        });
      }
    } catch (err: any) {
      console.error('Failed to enable Bunq integration:', err);
      this.updateState({ 
        error: err.response?.data?.message || 'Failed to enable Bunq integration' 
      });
    } finally {
      this.updateState({ isProcessing: false });
    }
  }

  /**
   * Disable Bunq integration with confirmation
   */
  async handleDisableIntegration(webApp?: any): Promise<void> {
    const confirmDisable = () => {
      return new Promise<boolean>((resolve) => {
        if (webApp?.showConfirm) {
          webApp.showConfirm(
            'Are you sure you want to disable Bunq integration? This will remove all stored credentials.',
            (confirmed: boolean) => resolve(confirmed)
          );
        } else {
          resolve(window.confirm('Are you sure you want to disable Bunq integration? This will remove all stored credentials.'));
        }
      });
    };

    const confirmed = await confirmDisable();
    if (!confirmed) return;

    try {
      this.updateState({ 
        isProcessing: true, 
        error: '', 
        successMessage: '' 
      });
      
      const result = await bunqApi.disable();
      
      if (result.success) {
        this.updateState({ 
          isEnabled: false,
          showCredentialsForm: false,
          successMessage: 'Bunq integration disabled successfully!',
          selectedMonetaryAccountId: null,
          storedPassword: '',
          credentials: { apiKey: '', password: '' }
        });
      } else {
        this.updateState({ 
          error: result.message || 'Failed to disable Bunq integration' 
        });
      }
    } catch (err: any) {
      console.error('Failed to disable Bunq integration:', err);
      this.updateState({ 
        error: err.response?.data?.message || 'Failed to disable Bunq integration' 
      });
    } finally {
      this.updateState({ isProcessing: false });
    }
  }

  /**
   * Show the credentials form for updating API key
   */
  handleShowCredentialsForm(): void {
    this.updateState({ 
      showCredentialsForm: true,
      error: '',
      successMessage: ''
    });
  }

  /**
   * Cancel the credentials form
   */
  handleCancelCredentialsForm(): void {
    this.updateState({ 
      showCredentialsForm: false,
      credentials: { apiKey: '', password: '' },
      error: '',
      successMessage: ''
    });
  }

  /**
   * Update credentials in the state
   */
  updateCredentials(updates: Partial<BunqCredentials>): void {
    this.updateState({ 
      credentials: { 
        apiKey: updates.apiKey ?? '',
        password: updates.password ?? ''
      }
    });
  }

  /**
   * Clear error and success messages
   */
  clearMessages(): void {
    this.updateState({ 
      error: '', 
      successMessage: '' 
    });
  }

  /**
   * Manually install Bunq webhook filters
   */
  async handleInstallWebhook(password?: string): Promise<boolean> {
    try {
      this.updateState({ isProcessing: true, error: '', successMessage: '' });
      const pwd = (password || '').trim();
      if (!pwd) {
        this.updateState({ isProcessing: false, error: 'Password is required to install webhook' });
        return false;
      }
      const result = await bunqApi.installWebhook(pwd);
      if (result.success) {
        this.updateState({ successMessage: 'Webhook installed successfully', storedPassword: pwd });
        return true;
      } else {
        this.updateState({ error: result.message || 'Failed to install webhook' });
        return false;
      }
    } catch (err: any) {
      console.error('Failed to install webhook:', err);
      this.updateState({ error: err.response?.data?.message || 'Failed to install webhook' });
      return false;
    } finally {
      this.updateState({ isProcessing: false });
    }
  }

  /**
   * Get initial state for the component
   */
  static getInitialState(): BunqSettingsState {
    return {
      isEnabled: false,
      isLoading: true,
      isProcessing: false,
      showCredentialsForm: false,
      credentials: { apiKey: '', password: '' },
      error: '',
      successMessage: '',
      selectedMonetaryAccountId: null,
      storedPassword: '',
    };
  }
}
