import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { logDebug } from '../debug';
import { gamesApi } from '../services/api';
import { PricingMode } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { BackButton } from '@twa-dev/sdk/react';
import { isTelegramApp } from '../utils/telegram';
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
  const [pricingMode, setPricingMode] = useState<PricingMode>(PricingMode.PER_PARTICIPANT);
  const [withPositions, setWithPositions] = useState<boolean>(false);
  const [locationName, setLocationName] = useState<string>('');
  const [locationLink, setLocationLink] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const inTelegram = isTelegramApp();

  // Handle payment amount input changes, converting from euros to cents
  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove all non-digit and non-decimal point characters
    const numericValue = value.replace(/[^\d.]/g, '');
    
    // Only update if the value is a valid number or empty string
    if (numericValue === '' || !isNaN(Number(numericValue))) {
      setPaymentAmountDisplay(numericValue);
      // Convert the numeric value to a string with proper decimal separator
      setPaymentAmount(eurosToCents(numericValue || '0'));
    }
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
        
        // Set pricing mode
        setPricingMode(game.pricingMode || PricingMode.PER_PARTICIPANT);
        
        // Set withPositions flag
        setWithPositions(!!game.withPositions);
        setLocationName(game.locationName || '');
        setLocationLink(game.locationLink || '');
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
        paymentAmount,
        pricingMode,
        withPositions,
        locationName: locationName || null,
        locationLink: locationLink || null
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
      {inTelegram && (
        <BackButton onClick={handleCancel} />
      )}
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
        </div>
        
        <div className="form-group">
          <div className="toggle-container">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={pricingMode === PricingMode.TOTAL_COST}
                onChange={(e) => setPricingMode(e.target.checked ? PricingMode.TOTAL_COST : PricingMode.PER_PARTICIPANT)}
              />
              <span className="slider round"></span>
            </label>
            <span className="toggle-label">
              {pricingMode === PricingMode.TOTAL_COST ? 'Specify total game cost' : 'Specify game cost per participant'}
            </span>
          </div>
          <div className="field-description">
            {pricingMode === PricingMode.PER_PARTICIPANT 
              ? 'Set the cost per participant. Each player pays this amount.'
              : 'Set the total cost of the game. Cost per participant will be calculated automatically based on the number of registered players.'}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="paymentAmount">
            {pricingMode === PricingMode.PER_PARTICIPANT ? 'Cost per Participant (€):' : 'Total Game Cost (€):'}
          </label>
          <input
            type="text"
            id="paymentAmount"
            value={paymentAmountDisplay}
            onChange={handlePaymentAmountChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="locationName">Location name:</label>
          <input
            type="text"
            id="locationName"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g. Victoria Park, Amsterdam"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="locationLink">Location link (Maps URL):</label>
          <input
            type="url"
            id="locationLink"
            value={locationLink}
            onChange={(e) => setLocationLink(e.target.value)}
            placeholder="Paste a Google/Apple Maps link (optional)"
          />
          <div className="field-description">
            Optional: open Google/Apple Maps, share the place and paste the link here.
          </div>
        </div>

        <div className="form-group">
          <div className="toggle-container">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={withPositions}
                onChange={(e) => setWithPositions(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
            <span className="toggle-label">Playing 5-1</span>
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
