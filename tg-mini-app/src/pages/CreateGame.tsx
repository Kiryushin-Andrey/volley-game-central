import React, { useState, useEffect } from 'react';
import { logDebug } from '../debug';
import { useNavigate } from 'react-router-dom';
import { gamesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './CreateGame.scss';

const CreateGame: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [maxPlayers, setMaxPlayers] = useState<number>(14);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch default date and time from the server
  useEffect(() => {
    const fetchDefaultDateTime = async () => {
      try {
        setIsInitialLoading(true);
        
        // Call the API to get the default date and time
        const defaultDate = await gamesApi.getDefaultDateTime();
        
        // Set time to 17:00 (5:00 PM) if not already set by the server
        if (defaultDate.getHours() === 0 && defaultDate.getMinutes() === 0) {
          defaultDate.setHours(17, 0, 0, 0);
        }
        
        // Set the selected date
        setSelectedDate(defaultDate);
      } catch (err) {
        logDebug('Error fetching default date and time:');
        logDebug(err);
        setError('Failed to fetch default date and time');
        
        // Fallback to next Sunday if there's an error
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7); // Add 1 week
        defaultDate.setHours(17, 0, 0, 0); // Set to 5:00 PM
        setSelectedDate(defaultDate);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchDefaultDateTime();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate) {
      setError('Please select a date and time');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await gamesApi.createGame({
        dateTime: selectedDate.toISOString(),
        maxPlayers
      });
      
      // Navigate back to the games list after successful creation
      navigate('/');
    } catch (err) {
      logDebug('Error creating game:');
      logDebug(err);
      setError('Failed to create game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (isInitialLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="create-game-container">
      <h1>Create New Game</h1>
      
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
              dateFormat="MMMM d, yyyy h:mm aa"
              placeholderText="Select date and time"
              className="datepicker-input"
              calendarClassName="datepicker-calendar"
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
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="create-button" 
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateGame;
