import React from 'react';
import { BunqCredentials } from '../viewmodels/BunqSettingsViewModel';

interface CredentialsFormProps {
  credentials: BunqCredentials;
  isProcessing: boolean;
  onCredentialsChange: (updates: Partial<BunqCredentials>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

const CredentialsForm: React.FC<CredentialsFormProps> = ({
  credentials,
  isProcessing,
  onCredentialsChange,
  onCancel,
  onSubmit
}) => {  
  return (
    <div className="credentials-form">
      <h3>Specify Bunq API Credentials</h3>
      <p className="form-description">
        Enter your Bunq API key and create a password for secure storage.
      </p>
      
      <div className="form-group">
        <label htmlFor="apiKey">API Key</label>
        <input
          type="password"
          id="apiKey"
          value={credentials.apiKey}
          onChange={(e) => onCredentialsChange({ apiKey: e.target.value })}
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
          onChange={(e) => onCredentialsChange({ password: e.target.value })}
          placeholder="Devise a password for API key encryption"
          disabled={isProcessing}
        />
      </div>
      
      <div className="form-actions">
        <button 
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button 
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={isProcessing || !credentials.apiKey.trim() || !credentials.password.trim()}
        >
          {isProcessing 
            ? 'Enabling...' 
            : 'Enable Integration'}
        </button>
      </div>
    </div>
  );
};

export default CredentialsForm;
