import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logDebug } from '../debug';
import { gamesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { BackButton } from '@twa-dev/sdk/react';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import { enGB } from 'date-fns/locale/en-GB';
import { eurosToCents, centsToEuroString } from '../utils/currencyUtils';
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
  const [unregisterDeadlineHours, setUnregisterDeadlineHours] = useState<number>(5);
  const [paymentAmount, setPaymentAmount] = useState<number>(0); // Stored in cents
  const [paymentAmountDisplay, setPaymentAmountDisplay] = useState<string>('0.00'); // Display value in euros
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Handle payment amount input changes, converting from euros to cents
  const handlePaymentAmountChange = (value: string) => {
    // Store the display value (with comma or dot as decimal separator)
    setPaymentAmountDisplay(value);
    
    // Use the utility function to convert euros to cents
    setPaymentAmount(eurosToCents(value));
  };

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
        setUnregisterDeadlineHours(game.unregisterDeadlineHours || 5); // Default to 5 if not set
        
        // Set payment amount and display value
        setPaymentAmount(game.paymentAmount || 0);
        setPaymentAmountDisplay(centsToEuroString(game.paymentAmount || 0));
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
    
    try {
      setIsSaving(true);
      setError(null);
      
      await gamesApi.updateGame(parseInt(gameId), {
        dateTime: selectedDate.toISOString(),
        maxPlayers,
        unregisterDeadlineHours,
        paymentAmount
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

  const handleCancel = useCallback(() => {
    if (gameId) {
      navigate(`/game/${gameId}`);
    } else {
      navigate('/');
    }
  }, [navigate, gameId]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="edit-game-settings-container">
      <BackButton onClick={handleCancel} />
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
              locale="en-GB" // Use locale with Monday as first day of week              // minDate removed to allow selecting past dates
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
            max="100"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="unregisterDeadlineHours">Unregister Deadline (hours before game):</label>
          <input
            type="number"
            id="unregisterDeadlineHours"
            value={unregisterDeadlineHours}
            onChange={(e) => setUnregisterDeadlineHours(parseInt(e.target.value))}
            min="1"
            max="48"
            required
          />
          <div className="field-description">
            Players can unregister up until this many hours before the game starts.
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="paymentAmount">Payment Amount (€):</label>
          <input
            type="text"
            id="paymentAmount"
            value={paymentAmountDisplay}
            onChange={(e) => handlePaymentAmountChange(e.target.value)}
            required
          />
          <div className="field-description">
            Payment amount in euros.
          </div>
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
