import { bunqApi } from '../services/api';

export interface MonetaryAccount {
  id: number;
  description: string;
}

export interface MonetaryAccountSelectorState {
  monetaryAccounts: MonetaryAccount[];
  selectedMonetaryAccountId: number | null;
  isLoadingAccounts: boolean;
  storedPassword: string;
  showPasswordPrompt: boolean;
  tempPassword: string;
  isProcessing: boolean;
  error: string;
  successMessage: string;
}

export type MonetaryAccountSelectorStateUpdater = (updates: Partial<MonetaryAccountSelectorState>) => void;

export class MonetaryAccountSelectorViewModel {
  private updateState: MonetaryAccountSelectorStateUpdater;

  constructor(updateState: MonetaryAccountSelectorStateUpdater) {
    this.updateState = updateState;
  }

  /**
   * Load monetary accounts for the user
   */
  async loadMonetaryAccounts(password?: string, storedPassword?: string): Promise<void> {
    const passwordToUse = password || storedPassword;
    if (!passwordToUse) {
      // Don't show error, just return - we'll show "Choose account" button instead
      return;
    }

    try {
      this.updateState({ isLoadingAccounts: true, error: '' });
      const result = await bunqApi.getMonetaryAccounts(passwordToUse);
      
      if (result.success) {
        this.updateState({ 
          monetaryAccounts: result.accounts,
          // Set the first account as selected if none is selected
          selectedMonetaryAccountId: result.accounts.length > 0 ? result.accounts[0].id : null,
          // Store the password in memory for future use
          storedPassword: passwordToUse
        });
      } else {
        this.updateState({ error: 'Failed to load Bunq accounts' });
      }
    } catch (err: any) {
      console.error('Failed to load Bunq accounts:', err);
      this.updateState({ error: 'Failed to load Bunq accounts' });
    } finally {
      this.updateState({ isLoadingAccounts: false });
    }
  }

  /**
   * Handle monetary account selection change
   */
  async handleMonetaryAccountChange(accountId: number): Promise<void> {
    try {
      this.updateState({ 
        isProcessing: true, 
        error: '', 
        successMessage: '' 
      });
      
      const result = await bunqApi.updateMonetaryAccount(accountId);
      
      if (result.success) {
        this.updateState({ 
          selectedMonetaryAccountId: accountId,
          successMessage: 'Bunq account updated successfully!'
        });
      } else {
        this.updateState({ 
          error: result.message || 'Failed to update Bunq account' 
        });
      }
    } catch (err: any) {
      console.error('Failed to update Bunq account:', err);
      this.updateState({ 
        error: err.response?.data?.message || 'Failed to update Bunq account' 
      });
    } finally {
      this.updateState({ isProcessing: false });
    }
  }

  /**
   * Show password prompt for loading monetary accounts
   */
  handleShowPasswordPrompt(): void {
    this.updateState({ 
      showPasswordPrompt: true,
      tempPassword: '',
      error: '',
      successMessage: ''
    });
  }

  /**
   * Cancel password prompt
   */
  handleCancelPasswordPrompt(): void {
    this.updateState({ 
      showPasswordPrompt: false,
      tempPassword: '',
      error: '',
      successMessage: ''
    });
  }

  /**
   * Submit password and load monetary accounts
   */
  async handleSubmitPassword(currentState: MonetaryAccountSelectorState): Promise<void> {
    const { tempPassword } = currentState;
    
    if (!tempPassword.trim()) {
      this.updateState({ error: 'Please enter a password' });
      return;
    }

    try {
      this.updateState({ isProcessing: true, error: '' });
      await this.loadMonetaryAccounts(tempPassword.trim());
      
      // Close the password prompt on success and clear temp password
      this.updateState({ 
        showPasswordPrompt: false,
        tempPassword: ''
      });
    } catch (err: any) {
      console.error('Failed to load Bunq accounts with password:', err);
      this.updateState({ error: 'Failed to load Bunq accounts with provided password' });
    } finally {
      this.updateState({ isProcessing: false });
    }
  }

  /**
   * Update password for accounts in the state
   */
  updatePasswordForAccounts(password: string): void {
    this.updateState({ tempPassword: password });
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
   * Get initial state for the component
   */
  static getInitialState(): MonetaryAccountSelectorState {
    return {
      monetaryAccounts: [],
      selectedMonetaryAccountId: null,
      isLoadingAccounts: false,
      storedPassword: '',
      showPasswordPrompt: false,
      tempPassword: '',
      isProcessing: false,
      error: '',
      successMessage: '',
    };
  }
}
