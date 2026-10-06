import React, { useState, useEffect } from 'react';
import { Button, Input } from '@telegram-apps/telegram-ui';
import './PasswordDialog.scss';

interface PasswordDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  error?: string;
}

const PasswordDialog: React.FC<PasswordDialogProps> = ({
  isOpen,
  title,
  message,
  onSubmit,
  onCancel,
  isProcessing = false,
  error
}) => {
  const [password, setPassword] = useState('');

  // Reset password when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setPassword('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() && !isProcessing) {
      onSubmit(password);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isProcessing) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="password-dialog-overlay" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="password-dialog">
        <div className="password-dialog-header">
          <h3>{title}</h3>
        </div>
        
        <div className="password-dialog-content">
          <p>{message}</p>
          
          <form onSubmit={handleSubmit} className="password-form">
            <Input
              id="password"
              header="Password:"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isProcessing}
              autoFocus
              required
            />
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <div className="dialog-buttons">
              <Button
                type="button"
                mode="gray"
                onClick={onCancel}
                disabled={isProcessing}
                className="cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!password.trim() || isProcessing}
                className="submit-button"
              >
                {isProcessing ? 'Processing...' : 'Submit'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordDialog;
