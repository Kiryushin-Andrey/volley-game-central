import React from 'react';
import { Button, Input, Title } from '@telegram-apps/telegram-ui';
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
      <Title Component="h3">Specify Bunq API Credentials</Title>
      <p className="form-description">
        Enter your Bunq API key and create a password for secure storage.
      </p>
      
      <Input
        type="password"
        id="apiKey"
        header="API Key"
        value={credentials.apiKey}
        onChange={(e) => onCredentialsChange({ apiKey: e.target.value })}
        placeholder="Provide your Bunq API key"
        disabled={isProcessing}
      />
      
      <Input
        type="text"
        id="apiKeyName"
        header="API Key Name"
        value={credentials.apiKeyName}
        onChange={(e) => onCredentialsChange({ apiKeyName: e.target.value })}
        placeholder="Enter a name for this API key (used as User-Agent)"
        disabled={isProcessing}
      />
      <small className="form-help">This name will be used to identify your API key in Bunq</small>
      
      <Input
        type="password"
        id="password"
        header="Password"
        value={credentials.password}
        onChange={(e) => onCredentialsChange({ password: e.target.value })}
        placeholder="Devise a password for API key encryption"
        disabled={isProcessing}
      />
      
      <div className="form-actions">
        <Button 
          mode="gray"
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button 
          type="button"
          onClick={onSubmit}
          disabled={isProcessing || !credentials.apiKey.trim() || !credentials.password.trim() || !credentials.apiKeyName.trim()}
        >
          {isProcessing 
            ? 'Enabling...' 
            : 'Enable Integration'}
        </Button>
      </div>
    </div>
  );
};

export default CredentialsForm;
