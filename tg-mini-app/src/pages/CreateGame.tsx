import React, { useState, useEffect, useCallback } from 'react';
import { logDebug } from '../debug';
import { useNavigate } from 'react-router-dom';
import { gamesApi } from '../services/api';
import { PricingMode } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { BackButton } from '@twa-dev/sdk/react';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import { enGB } from 'date-fns/locale/en-GB';
import { eurosToCents, centsToEuroString } from '../utils/currencyUtils';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker-fixes.scss';
import './CreateGame.scss';

// Register the locale with Monday as first day of week
registerLocale('en-GB', enGB);

const CreateGame: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [maxPlayers, setMaxPlayers] = useState<number>(14);
  const [unregisterDeadlineHours, setUnregisterDeadlineHours] = useState<number>(5);
  const [paymentAmount, setPaymentAmount] = useState<number>(500); // Stored in cents
  const [paymentAmountDisplay, setPaymentAmountDisplay] = useState<string>(centsToEuroString(500)); // Display value in euros
  const [pricingMode, setPricingMode] = useState<PricingMode>(PricingMode.PER_PARTICIPANT);
  const [withPositions, setWithPositions] = useState<boolean>(false);
  const [locationName, setLocationName] = useState<string>('');
  const [locationLink, setLocationLink] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch default date and time from the server
  useEffect(() => {
    const fetchDefaultDateTime = async () => {
      try {
        setIsInitialLoading(true);
        
        const defaults = await gamesApi.getDefaultGameSettings();
        const defaultDate = defaults.date;
        
        if (defaultDate.getHours() === 0 && defaultDate.getMinutes() === 0) {
          defaultDate.setHours(17, 0, 0, 0);
        }
        
        setSelectedDate(defaultDate);
        if (defaults.locationName) setLocationName(defaults.locationName);
        if (defaults.locationLink) setLocationLink(defaults.locationLink);
        if (defaults.pricingMode) setPricingMode(defaults.pricingMode);
        if (typeof defaults.paymentAmount === 'number') {
          setPaymentAmount(defaults.paymentAmount);
          setPaymentAmountDisplay(centsToEuroString(defaults.paymentAmount));
        }
        if (typeof defaults.withPositions === 'boolean') {
          setWithPositions(defaults.withPositions);
        }
      } catch (err) {
        logDebug('Error fetching default date and time:');
        logDebug(err);
        setError('Failed to fetch default date and time');
        
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
        maxPlayers,
        unregisterDeadlineHours,
        paymentAmount,
        pricingMode,
        withPositions,
        locationName: locationName || null,
        locationLink: locationLink || null,
      });
      
      navigate('/');
    } catch (err) {
      logDebug('Error creating game:');
      logDebug(err);
      setError('Failed to create game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCancel = useCallback(() => {
    navigate('/');
  }, [navigate]);
  
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

  if (isInitialLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="create-game-container">
      <BackButton onClick={handleCancel} />
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
              dateFormat="MMMM d, yyyy HH:mm"
              placeholderText="Select date and time"
              className="datepicker-input"
              calendarClassName="datepicker-calendar"
              locale="en-GB" // Use locale with Monday as first day of week
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
            min="0"
            max="48"
            required
          />
          <div className="field-description">
            Players can unregister up until this many hours before the game starts.
          </div>
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
              ? 'Each player pays this amount.'
              : 'Cost per participant will be calculated automatically based on the number of registered players.'}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="paymentAmount">
            {pricingMode === PricingMode.PER_PARTICIPANT ? 'Cost per Participant (€):' : 'Total Game Cost (€):'}
          </label>
          <input
            type="number"
            id="paymentAmount"
            value={paymentAmountDisplay}
            onChange={handlePaymentAmountChange}
            step="0.01"
            min="0"
            required
          />
          {pricingMode === PricingMode.TOTAL_COST && (
            <div className="field-description">
              Cost per participant will be calculated based on the number of registered players. Preview (if full): €{paymentAmountDisplay} ÷ {maxPlayers} players = €{(parseFloat(paymentAmountDisplay || '0') / maxPlayers).toFixed(2)} per player
            </div>
          )}
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
