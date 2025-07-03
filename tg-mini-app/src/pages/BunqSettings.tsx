import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';
import { bunqApi } from '../services/api';
import './BunqSettings.scss';

interface BunqCredentials {
  apiKey: string;
  password: string;
}

const BunqSettings: React.FC = () => {
  const navigate = useNavigate();
  const { webApp } = useTelegramWebApp();
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showCredentialsForm, setShowCredentialsForm] = useState<boolean>(false);
  const [credentials, setCredentials] = useState<BunqCredentials>({ apiKey: '', password: '' });
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Load Bunq integration status on component mount
  useEffect(() => {
    loadBunqStatus();
  }, []);

  const loadBunqStatus = async () => {
    try {
      setIsLoading(true);
      setError('');
      const status = await bunqApi.getStatus();
      setIsEnabled(status.enabled);
    } catch (err: any) {
      console.error('Failed to load Bunq status:', err);
      setError('Failed to load Bunq integration status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableIntegration = async () => {
    if (!credentials.apiKey.trim() || !credentials.password.trim()) {
      setError('Please provide both API key and password');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setSuccessMessage('');
      
      const result = await bunqApi.enable(credentials.apiKey.trim(), credentials.password.trim());
      
      if (result.success) {
        setIsEnabled(true);
        setShowCredentialsForm(false);
        setCredentials({ apiKey: '', password: '' });
        setSuccessMessage(result.message || 'Bunq integration enabled successfully!');
      } else {
        setError(result.message || 'Failed to enable Bunq integration');
      }
    } catch (err: any) {
      console.error('Failed to enable Bunq integration:', err);
      setError(err.response?.data?.message || 'Failed to enable Bunq integration');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableIntegration = async () => {
    if (!webApp) return;

    // Show confirmation dialog
    webApp.showConfirm(
      'Are you sure you want to disable Bunq integration? This will remove all stored credentials.',
      async (confirmed: boolean) => {
        if (!confirmed) return;

        try {
          setIsProcessing(true);
          setError('');
          setSuccessMessage('');
          
          const result = await bunqApi.disable();
          
          if (result.success) {
            setIsEnabled(false);
            setSuccessMessage(result.message || 'Bunq integration disabled successfully!');
          } else {
            setError(result.message || 'Failed to disable Bunq integration');
          }
        } catch (err: any) {
          console.error('Failed to disable Bunq integration:', err);
          setError(err.response?.data?.message || 'Failed to disable Bunq integration');
        } finally {
          setIsProcessing(false);
        }
      }
    );
  };

  const handleShowCredentialsForm = () => {
    setShowCredentialsForm(true);
    setCredentials({ apiKey: '', password: '' });
    setError('');
    setSuccessMessage('');
  };

  const handleCancelCredentialsForm = () => {
    setShowCredentialsForm(false);
    setCredentials({ apiKey: '', password: '' });
    setError('');
  };

  React.useEffect(() => {
    if (webApp) {
      // Set up back button
      webApp.BackButton.show();
      webApp.BackButton.onClick(() => {
        navigate('/');
      });

      // Clean up on unmount
      return () => {
        webApp.BackButton.hide();
        webApp.BackButton.offClick();
      };
    }
  }, [webApp, navigate]);

  if (isLoading) {
    return (
      <div className="bunq-settings-container">
        <header className="bunq-settings-header">
          <h1>Bunq Integration Settings</h1>
        </header>
        <div className="settings-content">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bunq-settings-container">
      <header className="bunq-settings-header">
        <h1>Bunq Integration Settings</h1>
      </header>

      <div className="settings-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}

        <div className="integration-status">
          <div className="status-indicator">
            <div className={`status-dot ${isEnabled ? 'enabled' : 'disabled'}`}></div>
            <span className="status-text">
              Bunq integration is {isEnabled ? 'enabled' : 'disabled'}
            </span>
          </div>
        </div>

        {!isEnabled && !showCredentialsForm && (
          <div className="action-section">
            <p className="description">
              Enable Bunq integration to collect payments for volleyball games.
            </p>
            <button 
              className="btn btn-primary"
              onClick={handleShowCredentialsForm}
              disabled={isProcessing}
            >
              Enable Bunq Integration
            </button>
          </div>
        )}

        {!isEnabled && showCredentialsForm && (
          <div className="credentials-form">
            <h3>Bunq API Credentials</h3>
            <p className="form-description">
              Provide your Bunq API key to enable the integration.
            </p>
            
            <div className="form-group">
              <label htmlFor="apiKey">API Key</label>
              <input
                type="password"
                id="apiKey"
                value={credentials.apiKey}
                onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Provide your Bunq API key"
                disabled={isProcessing}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Devise a password for API key encryption"
                disabled={isProcessing}
              />
            </div>
            
            <div className="form-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleCancelCredentialsForm}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleEnableIntegration}
                disabled={isProcessing || !credentials.apiKey.trim() || !credentials.password.trim()}
              >
                {isProcessing ? 'Enabling...' : 'Enable Integration'}
              </button>
            </div>
          </div>
        )}

        {isEnabled && (
          <div className="action-section">
            <p className="description">
              Bunq integration is active. You can update your API key or disable the integration.
            </p>
            
            <div className="button-group">
              <button 
                className="btn btn-secondary"
                onClick={handleShowCredentialsForm}
                disabled={isProcessing}
              >
                Update API Key
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleDisableIntegration}
                disabled={isProcessing}
              >
                {isProcessing ? 'Disabling...' : 'Disable Integration'}
              </button>
            </div>
          </div>
        )}

        {isEnabled && showCredentialsForm && (
          <div className="credentials-form">
            <h3>Update Bunq API Credentials</h3>
            <p className="form-description">
              Enter your new Bunq API key.
            </p>
            
            <div className="form-group">
              <label htmlFor="apiKey">API Key</label>
              <input
                type="password"
                id="apiKey"
                value={credentials.apiKey}
                onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Provide your Bunq API key"
                disabled={isProcessing}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Devise a password for API key encryption"
                disabled={isProcessing}
              />
            </div>
            
            <div className="form-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleCancelCredentialsForm}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleEnableIntegration}
                disabled={isProcessing || !credentials.apiKey.trim() || !credentials.password.trim()}
              >
                {isProcessing ? 'Updating...' : 'Update Credentials'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BunqSettings;
