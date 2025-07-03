import React, { useState, useEffect, useCallback } from 'react';
import {
    MonetaryAccountSelectorViewModel,
    MonetaryAccountSelectorState
} from '../viewmodels/MonetaryAccountSelectorViewModel';
import './MonetaryAccountSelector.scss';

interface MonetaryAccountSelectorProps {
    // Optional props for integration with parent component
    onAccountSelected?: (accountId: number) => void;
    onError?: (error: string) => void;
    onSuccess?: (message: string) => void;
    onPasswordFormToggle?: (isShown: boolean) => void;
    initialPassword?: string;
}

const MonetaryAccountSelector: React.FC<MonetaryAccountSelectorProps> = ({
    onAccountSelected,
    onError,
    onSuccess,
    onPasswordFormToggle,
    initialPassword
}) => {
    // State management
    const [state, setState] = useState<MonetaryAccountSelectorState>(
        MonetaryAccountSelectorViewModel.getInitialState()
    );

    // Create viewmodel instance with state updater
    const updateState = useCallback((updates: Partial<MonetaryAccountSelectorState>) => {
        setState(prevState => ({ ...prevState, ...updates }));
    }, []);

    const viewModel = new MonetaryAccountSelectorViewModel(updateState);

    // Load monetary accounts if initial password is provided
    useEffect(() => {
        if (initialPassword) {
            viewModel.loadMonetaryAccounts(initialPassword);
        }
    }, [initialPassword]);

    // Notify parent component of account selection changes
    useEffect(() => {
        if (state.selectedMonetaryAccountId && onAccountSelected) {
            onAccountSelected(state.selectedMonetaryAccountId);
        }
    }, [state.selectedMonetaryAccountId, onAccountSelected]);

    // Notify parent component of errors
    useEffect(() => {
        if (state.error && onError) {
            onError(state.error);
        }
    }, [state.error, onError]);

    // Notify parent component of success messages
    useEffect(() => {
        if (state.successMessage && onSuccess) {
            onSuccess(state.successMessage);
        }
    }, [state.successMessage, onSuccess]);

    // Notify parent component when password form is shown/hidden
    useEffect(() => {
        if (onPasswordFormToggle) {
            onPasswordFormToggle(state.showPasswordPrompt);
        }
    }, [state.showPasswordPrompt, onPasswordFormToggle]);

    if (state.showPasswordPrompt) {
        return <div className="form-group">
            <input
                type="password"
                id="accountPassword"
                value={state.tempPassword}
                onChange={(e) => viewModel.updatePasswordForAccounts(e.target.value)}
                placeholder="Enter your password"
                disabled={state.isProcessing}
                onKeyPress={(e) => {
                    if (e.key === 'Enter' && state.tempPassword.trim()) {
                        viewModel.handleSubmitPassword(state);
                    }
                }}
            />

            <div className="form-actions">
                <button
                    className="btn btn-secondary"
                    onClick={() => viewModel.handleCancelPasswordPrompt()}
                    disabled={state.isProcessing}
                >
                    Cancel
                </button>
                <button
                    className="btn btn-primary"
                    onClick={() => viewModel.handleSubmitPassword(state)}
                    disabled={state.isProcessing || !state.tempPassword.trim()}
                >
                    {state.isProcessing ? 'Loading...' : 'Load Accounts'}
                </button>
            </div>
        </div>;
    }

    if (state.isLoadingAccounts) {
        return <div className="form-group">
            <div className="loading-text">Loading accounts...</div>
        </div>;
    }

    if (state.monetaryAccounts.length > 0) {
        return (
            <div className="form-group">
                <label htmlFor="monetaryAccount">Choose account to receive payments to</label>
                <select
                    id="monetaryAccount"
                    value={state.selectedMonetaryAccountId || ''}
                    onChange={(e) => viewModel.handleMonetaryAccountChange(Number(e.target.value))}
                    disabled={state.isProcessing}
                    className="form-select"
                >
                    {state.monetaryAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.description}
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    if (!state.storedPassword) {
        return (
            <div className="form-group">
                <div className="button-group">
                    <button
                        className="btn btn-primary"
                        onClick={() => viewModel.handleShowPasswordPrompt()}
                        disabled={state.isProcessing}
                    >
                        Choose account to receive payments to
                    </button>
                </div>
            </div>
        );
    }

    return <div className="form-group">
        <div className="error-text">No monetary accounts available</div>
    </div>;
};

export default MonetaryAccountSelector;
