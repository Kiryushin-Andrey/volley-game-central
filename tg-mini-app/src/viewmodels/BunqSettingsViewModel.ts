import { bunqApi, userApi } from '../services/api';

export interface BunqCredentials {
  apiKey: string;
  apiKeyName: string;
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
  assignedUserName: string | null;
}

export type BunqSettingsStateUpdater = (updates: Partial<BunqSettingsState>) => void;

export class BunqSettingsViewModel {
  private updateState: BunqSettingsStateUpdater;
  private assignedUserId?: number;

  constructor(updateState: BunqSettingsStateUpdater, assignedUserId?: number) {
    this.updateState = updateState;
    this.assignedUserId = assignedUserId;
  }

  /**
   * Load Bunq integration status from the API
   */
  async loadBunqStatus(): Promise<void> {
    try {
      this.updateState({ isLoading: true, error: '' });
      const status = await bunqApi.getStatus(this.assignedUserId);
      this.updateState({ isEnabled: status.enabled });
    } catch (err: any) {
      console.error('Failed to load Bunq status:', err);
      this.updateState({ error: 'Failed to load Bunq integration status' });
    } finally {
      this.updateState({ isLoading: false });
    }
  }

  /**
   * Load assigned user's display name if assignedUserId is set
   */
  async loadAssignedUserName(): Promise<void> {
    if (!this.assignedUserId) {
      this.updateState({ assignedUserName: null });
      return;
    }

    try {
      const user = await userApi.getUserById(this.assignedUserId);
      this.updateState({ assignedUserName: user.displayName });
    } catch (err: any) {
      console.error('Failed to load assigned user name:', err);
      this.updateState({ assignedUserName: null });
    }
  }

  /**
   * Enable Bunq integration with provided credentials
   */
  async handleEnableIntegration(credentials: BunqCredentials): Promise<void> {
    if (!credentials.apiKey.trim() || !credentials.password.trim() || !credentials.apiKeyName.trim()) {
      this.updateState({ error: 'Please provide API key, API key name, and password' });
      return;
    }

    try {
      this.updateState({ 
        isProcessing: true, 
        error: '', 
        successMessage: '' 
      });
      
      const result = await bunqApi.enable(credentials.apiKey.trim(), credentials.password.trim(), this.assignedUserId, credentials.apiKeyName.trim());
      
      if (result.success) {
        this.updateState({ 
          isEnabled: true,
          showCredentialsForm: false,
          successMessage: 'Bunq integration enabled successfully!',
          storedPassword: credentials.password.trim(),
          credentials: { apiKey: '', apiKeyName: '', password: '' }
        });
      } else {
        this.updateState({ 
          error: result.message || 'Failed to enable Bunq integration' 
        });
      }
    } catch (err: any) {
      console.error('Failed to enable Bunq integration:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to enable Bunq integration';
      this.updateState({ error: errorMessage });
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
        const message = this.assignedUserId
          ? `Are you sure you want to disable Bunq integration for this user? This will remove all stored credentials.`
          : 'Are you sure you want to disable Bunq integration? This will remove all stored credentials.';
        
        if (webApp?.showConfirm && typeof webApp.showConfirm === 'function') {
          try {
            webApp.showConfirm(
              message,
              (confirmed: boolean) => resolve(confirmed)
            );
          } catch (error) {
            // Fallback to browser confirm if Telegram WebApp method fails
            const confirmed = window.confirm(message);
            resolve(confirmed);
          }
        } else {
          const confirmed = window.confirm(message);
          resolve(confirmed);
        }
      });
    };

    const confirmed = await confirmDisable();
    if (!confirmed) {
      return;
    }

    try {
      this.updateState({ 
        isProcessing: true, 
        error: '', 
        successMessage: '' 
      });
      
      const result = await bunqApi.disable(this.assignedUserId);
      
      if (result.success) {
        this.updateState({ 
          isEnabled: false,
          showCredentialsForm: false,
          successMessage: 'Bunq integration disabled successfully!',
          selectedMonetaryAccountId: null,
          storedPassword: '',
          credentials: { apiKey: '', apiKeyName: '', password: '' }
        });
      } else {
        this.updateState({ 
          error: result.message || 'Failed to disable Bunq integration' 
        });
      }
    } catch (err: any) {
      console.error('Failed to disable Bunq integration:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to disable Bunq integration';
      this.updateState({ error: errorMessage });
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
      credentials: { apiKey: '', apiKeyName: '', password: '' },
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
        apiKeyName: updates.apiKeyName ?? '',
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
      const result = await bunqApi.installWebhook(pwd, this.assignedUserId);
      if (result.success) {
        this.updateState({ successMessage: 'Webhook installed successfully', storedPassword: '' });
        return true;
      } else {
        this.updateState({ error: result.message || 'Failed to install webhook' });
        return false;
      }
    } catch (err: any) {
      console.error('Failed to install webhook:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to install webhook';
      this.updateState({ error: errorMessage });
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
      credentials: { apiKey: '', apiKeyName: '', password: '' },
      error: '',
      successMessage: '',
      selectedMonetaryAccountId: null,
      storedPassword: '',
      assignedUserName: null,
    };
  }
}
