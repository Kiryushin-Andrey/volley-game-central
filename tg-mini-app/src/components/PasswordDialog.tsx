import React, { useState, useEffect } from 'react';
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
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isProcessing}
                autoFocus
                required
              />
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <div className="dialog-buttons">
              <button
                type="button"
                onClick={onCancel}
                disabled={isProcessing}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!password.trim() || isProcessing}
                className="submit-button"
              >
                {isProcessing ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordDialog;
