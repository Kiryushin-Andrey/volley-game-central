import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BunqSettingsViewModel, 
  BunqSettingsState
} from '../viewmodels/BunqSettingsViewModel';
import MonetaryAccountSelector from '../components/MonetaryAccountSelector';
import CredentialsForm from '../components/CredentialsForm';
import { BackButton } from '@twa-dev/sdk/react';
import { isTelegramApp } from '../utils/telegram';
import './BunqSettings.scss';

const BunqSettings: React.FC = () => {
  const navigate = useNavigate();
  const webApp = window.Telegram?.WebApp;
  
  // State management
  const [state, setState] = useState<BunqSettingsState>(
    BunqSettingsViewModel.getInitialState()
  );
  const [isPasswordFormShown, setIsPasswordFormShown] = useState(false);
  
  const inTelegram = isTelegramApp();
  
  // Create viewmodel instance with state updater
  const updateState = useCallback((updates: Partial<BunqSettingsState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);
  
  const viewModel = new BunqSettingsViewModel(updateState);

  // Load Bunq integration status on component mount
  useEffect(() => {
    viewModel.loadBunqStatus();
  }, []);



  // Clear stored password when integration is disabled
  useEffect(() => {
    if (!state.isEnabled) {
      setState(prevState => ({ ...prevState, storedPassword: '', selectedMonetaryAccountId: null }));
    }
  }, [state.isEnabled]);

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
        <h1>Bunq Settings</h1>
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
                  onClick={() => {
                    const pwd = state.storedPassword || window.prompt('Enter your Bunq password to install webhook') || '';
                    if (pwd && pwd.trim()) {
                      viewModel.handleInstallWebhook(pwd);
                    }
                  }}
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
                  onClick={() => viewModel.handleDisableIntegration(webApp)}
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
    </div>
  );
};

export default BunqSettings;
