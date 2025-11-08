import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  BunqSettingsViewModel, 
  BunqSettingsState
} from '../viewmodels/BunqSettingsViewModel';
import MonetaryAccountSelector from '../components/MonetaryAccountSelector';
import CredentialsForm from '../components/CredentialsForm';
import { BackButton } from '@twa-dev/sdk/react';
import PasswordDialog from '../components/PasswordDialog';
import { isTelegramApp } from '../utils/telegram';
import './BunqSettings.scss';

const BunqSettings: React.FC = () => {
  const navigate = useNavigate();
  const { assignedUserId } = useParams<{ assignedUserId?: string }>();
  const webApp = window.Telegram?.WebApp;
  
  // Parse assignedUserId if present
  const assignedUserIdNum = assignedUserId ? parseInt(assignedUserId, 10) : undefined;
  
  // State management
  const [state, setState] = useState<BunqSettingsState>(
    BunqSettingsViewModel.getInitialState()
  );
  const [isPasswordFormShown, setIsPasswordFormShown] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  const inTelegram = isTelegramApp();
  
  // Create viewmodel instance with state updater
  const updateState = useCallback((updates: Partial<BunqSettingsState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);
  
  const viewModel = useMemo(() => {
    const vm = new BunqSettingsViewModel(updateState, assignedUserIdNum);
    vm.loadBunqStatus();
    vm.loadAssignedUserName();
    return vm;
  }, [updateState, assignedUserIdNum]);



  // Clear stored password when integration is disabled
  useEffect(() => {
    if (!state.isEnabled) {
      setState(prevState => ({ ...prevState, storedPassword: '', selectedMonetaryAccountId: null }));
    }
  }, [state.isEnabled]);

  const handleOpenPasswordDialog = () => {
    setPasswordError('');
    // Clear any previous error in state to avoid showing stale messages in the dialog
    setState(prev => ({ ...prev, error: '' }));
    setShowPasswordDialog(true);
  };

  const handlePasswordSubmit = async (password: string) => {
    setPasswordError('');
    const ok = await viewModel.handleInstallWebhook(password);
    if (ok) {
      setShowPasswordDialog(false);
    } else {
      // Keep dialog open and show error; error message is in state.error
      setPasswordError(state.error || 'Failed to install webhook');
    }
  };

  const handlePasswordCancel = () => {
    if (!state.isProcessing) {
      setShowPasswordDialog(false);
      setPasswordError('');
      setState(prev => ({ ...prev, error: '' }));
    }
  };

  if (state.isLoading) {
    return (
      <div className="bunq-settings-container">
        <div className="bunq-settings-header">
          <h1>Bunq Settings</h1>
        </div>
        <div className="settings-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bunq-settings-container">
      <div className="bunq-settings-header">
        {inTelegram && (
          <BackButton onClick={() => navigate(-1)} />
        )}
        <h1>Bunq Settings{state.assignedUserName && ` (${state.assignedUserName})`}</h1>
      </div>
      
      <div className="settings-content">
        {state.error && (
          <div className="error-message">
            {state.error}
          </div>
        )}
        
        {state.successMessage && (
          <div className="success-message">
            {state.successMessage}
          </div>
        )}

        <div className="integration-status">
          <div className="status-indicator">
            <span className={`status-dot ${state.isEnabled ? 'enabled' : 'disabled'}`}></span>
            <span className="status-text">
              Bunq integration is {state.isEnabled ? 'enabled' : 'disabled'}
            </span>
          </div>
        </div>

        {!state.isEnabled && !state.showCredentialsForm && (
          <div className="action-section">
            <p className="description">
              Enable Bunq integration to accept payments for volleyball games.
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => viewModel.handleShowCredentialsForm()}
              disabled={state.isProcessing}
            >
              Enable Bunq Integration
            </button>
          </div>
        )}

        {state.isEnabled && !state.showCredentialsForm && (
          <div className="enabled-section">
            {/* Monetary Account Selection */}
            <MonetaryAccountSelector 
              initialPassword={state.storedPassword}
              assignedUserId={assignedUserIdNum}
              onAccountSelected={(accountId) => {
                setState(prevState => ({ ...prevState, selectedMonetaryAccountId: accountId }));
              }}
              onError={(error) => {
                setState(prevState => ({ ...prevState, error }));
              }}
              onSuccess={(message) => {
                setState(prevState => ({ ...prevState, successMessage: message }));
              }}
              onPasswordFormToggle={setIsPasswordFormShown}
            />

            {/* Hide buttons when password form is shown */}
            {!isPasswordFormShown && (
              <div className="button-group">
                <button 
                  className="btn btn-secondary"
                  onClick={handleOpenPasswordDialog}
                  disabled={state.isProcessing}
                >
                  {state.isProcessing ? 'Installing Webhook...' : 'Install Webhook'}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => viewModel.handleShowCredentialsForm()}
                  disabled={state.isProcessing}
                >
                  Update API Key
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      await viewModel.handleDisableIntegration(webApp);
                    } catch (error) {
                      console.error('Error disabling integration:', error);
                      setState(prevState => ({ ...prevState, error: 'Failed to disable integration. Please try again.' }));
                    }
                  }}
                  disabled={state.isProcessing}
                >
                  {state.isProcessing ? 'Disabling...' : 'Disable Integration'}
                </button>
              </div>
            )}
          </div>
        )}

        {state.showCredentialsForm && (
          <CredentialsForm
            credentials={state.credentials}
            isProcessing={state.isProcessing}
            onCredentialsChange={(updates) => {
              const updatedCredentials = { ...state.credentials, ...updates };
              setState(prevState => ({ ...prevState, credentials: updatedCredentials }));
            }}
            onCancel={() => viewModel.handleCancelCredentialsForm()}
            onSubmit={() => viewModel.handleEnableIntegration(state.credentials)}
          />
        )}

      </div>
      <PasswordDialog
        isOpen={showPasswordDialog}
        title="Install Bunq Webhook"
        message="Enter your Bunq password to install webhook filters."
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
        isProcessing={state.isProcessing}
        error={passwordError || state.error}
      />
    </div>
  );
};

export default BunqSettings;
