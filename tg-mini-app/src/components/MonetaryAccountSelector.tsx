import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select } from '@telegram-apps/telegram-ui';
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
    assignedUserId?: number;
}

const MonetaryAccountSelector: React.FC<MonetaryAccountSelectorProps> = ({
    onAccountSelected,
    onError,
    onSuccess,
    onPasswordFormToggle,
    initialPassword,
    assignedUserId
}) => {
    // State management
    const [state, setState] = useState<MonetaryAccountSelectorState>(
        MonetaryAccountSelectorViewModel.getInitialState()
    );

    // Create viewmodel instance with state updater
    const updateState = useCallback((updates: Partial<MonetaryAccountSelectorState>) => {
        setState(prevState => ({ ...prevState, ...updates }));
    }, []);

    const viewModel = new MonetaryAccountSelectorViewModel(updateState, assignedUserId);

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
            <Input
                type="password"
                id="accountPassword"
                header="Password:"
                value={state.tempPassword}
                onChange={(e) => viewModel.updatePasswordForAccounts(e.target.value)}
                placeholder="Enter your password"
                disabled={state.isProcessing}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && state.tempPassword.trim()) {
                        viewModel.handleSubmitPassword(state);
                    }
                }}
            />

            <div className="form-actions">
                <Button
                    mode="gray"
                    type="button"
                    onClick={() => viewModel.handleCancelPasswordPrompt()}
                    disabled={state.isProcessing}
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    onClick={() => viewModel.handleSubmitPassword(state)}
                    disabled={state.isProcessing || !state.tempPassword.trim()}
                >
                    {state.isProcessing ? 'Loading...' : 'Load Accounts'}
                </Button>
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
                <Select
                    id="monetaryAccount"
                    header="Choose account to receive payments to"
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
                </Select>
            </div>
        );
    }

    if (!state.storedPassword) {
        return (
            <div className="form-group">
                <div className="button-group">
                    <Button
                        type="button"
                        stretched
                        onClick={() => viewModel.handleShowPasswordPrompt()}
                        disabled={state.isProcessing}
                    >
                        Choose account to receive payments to
                    </Button>
                </div>
            </div>
        );
    }

    return <div className="form-group">
        <div className="error-text">No monetary accounts available</div>
    </div>;
};

export default MonetaryAccountSelector;
