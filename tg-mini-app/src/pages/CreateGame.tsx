import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { BackButton } from '@twa-dev/sdk/react';
import { isTelegramApp } from '../utils/telegram';
import { registerLocale } from 'react-datepicker';
import { enGB } from 'date-fns/locale/en-GB';
import { GameFormFields } from '../components/GameFormFields';
import { GameFormViewModel, GameFormState } from '../viewmodels/GameFormViewModel';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker-fixes.scss';
import '../styles/gameForm.scss';
import './CreateGame.scss';

// Register the locale with Monday as first day of week
registerLocale('en-GB', enGB);

const CreateGame: React.FC = () => {
  const [state, setState] = useState<GameFormState>(GameFormViewModel.getInitialState());
  const navigate = useNavigate();
  const inTelegram = isTelegramApp();

  // Create ViewModel instance
  const viewModel = useMemo(() => {
    const updateState = (updates: Partial<GameFormState>) => {
      setState(prevState => ({ ...prevState, ...updates }));
    };
    return new GameFormViewModel(updateState);
  }, []);

  // Fetch default date and time from the server
  useEffect(() => {
    viewModel.loadDefaultSettings();
  }, [viewModel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await viewModel.handleSubmit(state, () => navigate('/'));
  };
  
  const handleCancel = useCallback(() => {
    navigate('/');
  }, [navigate]);

  if (state.isInitialLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="create-game-container game-form-container">
      {inTelegram && (
        <BackButton onClick={handleCancel} />
      )}
      <h1>Create New Game</h1>
      
      {state.error && <div className="error-message">{state.error}</div>}
      
      <form onSubmit={handleSubmit}>
        <GameFormFields state={state} viewModel={viewModel} />

        <div className="button-group">
          <button 
            type="button" 
            className="cancel-button" 
            onClick={handleCancel}
            disabled={state.isLoading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="submit-button" 
            disabled={state.isLoading}
          >
            {state.isLoading ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateGame;
