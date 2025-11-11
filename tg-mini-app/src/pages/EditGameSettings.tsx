import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

// Register the locale with Monday as first day of week
registerLocale('en-GB', enGB);

const EditGameSettings: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<GameFormState>(GameFormViewModel.getInitialState());
  const inTelegram = isTelegramApp();

  // Create ViewModel instance
  const viewModel = useMemo(() => {
    const updateState = (updates: Partial<GameFormState>) => {
      setState(prevState => ({ ...prevState, ...updates }));
    };
    return new GameFormViewModel(updateState, gameId ? parseInt(gameId) : undefined);
  }, [gameId]);

  // Load game data on component mount
  useEffect(() => {
    if (gameId) {
      viewModel.loadGame();
    }
  }, [gameId, viewModel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await viewModel.handleSubmit(state, () => {
      if (gameId) {
        navigate(`/game/${gameId}`);
      } else {
        navigate('/');
      }
    });
  };

  const handleCancel = useCallback(() => {
    if (gameId) {
      navigate(`/game/${gameId}`);
    } else {
      navigate('/');
    }
  }, [navigate, gameId]);

  if (state.isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="edit-game-settings-container game-form-container">
      {inTelegram && (
        <BackButton onClick={handleCancel} />
      )}
      <h1>Edit Game Settings</h1>
      
      {state.error && <div className="error-message">{state.error}</div>}
      
      <form onSubmit={handleSubmit}>
        <GameFormFields state={state} viewModel={viewModel} />
        
        <div className="button-group">
          <button 
            type="button" 
            className="cancel-button" 
            onClick={handleCancel}
            disabled={state.isSaving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="submit-button" 
            disabled={state.isSaving}
          >
            {state.isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditGameSettings;
