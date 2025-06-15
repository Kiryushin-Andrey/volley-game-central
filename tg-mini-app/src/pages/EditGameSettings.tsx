import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logDebug } from '../debug';
import { gamesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import { enGB } from 'date-fns/locale/en-GB';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker-fixes.scss';
import './EditGameSettings.scss';

// Register the locale with Monday as first day of week
registerLocale('en-GB', enGB);

const EditGameSettings: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [maxPlayers, setMaxPlayers] = useState<number>(14);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load game data on component mount
  useEffect(() => {
    const loadGame = async () => {
      if (!gameId) return;
      
      try {
        setIsLoading(true);
        const game = await gamesApi.getGame(parseInt(gameId));
        
        // Set form values from game data
        setSelectedDate(new Date(game.dateTime));
        setMaxPlayers(game.maxPlayers);
      } catch (err) {
        logDebug('Error loading game:');
        logDebug(err);
        setError('Failed to load game details');
      } finally {
        setIsLoading(false);
      }
    };

    loadGame();
  }, [gameId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !gameId) {
      setError('Please select a date and time');
      return;
    }
    
    // Validate that the date is not in the past
    const now = new Date();
    if (selectedDate < now) {
      setError('Game date cannot be in the past');
      return;
    }
    
    try {
      setIsSaving(true);
      setError(null);
      
      await gamesApi.updateGame(parseInt(gameId), {
        dateTime: selectedDate.toISOString(),
        maxPlayers
      });
      
      // Navigate back to the game details page after successful update
      navigate(`/game/${gameId}`);
    } catch (err) {
      logDebug('Error updating game:');
      logDebug(err);
      setError('Failed to update game. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/game/${gameId}`);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="edit-game-settings-container">
      <h1>Edit Game Settings</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="dateTime">Game Date & Time:</label>
          <div className="datepicker-container">
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="Time"
              dateFormat="MMMM d, yyyy HH:mm"
              placeholderText="Select date and time"
              className="datepicker-input"
              calendarClassName="datepicker-calendar"
              locale="en-GB" // Use locale with Monday as first day of week
              minDate={new Date()} // Cannot select dates in the past
              required
            />
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="maxPlayers">Maximum Players:</label>
          <input
            type="number"
            id="maxPlayers"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
            min="2"
            max="30"
            required
          />
        </div>
        
        <div className="button-group">
          <button 
            type="button" 
            className="cancel-button" 
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="save-button" 
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditGameSettings;
