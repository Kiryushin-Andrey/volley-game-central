import React from 'react';
import DatePicker from 'react-datepicker';
import { PricingMode } from '../types';
import { ToggleSwitch } from './ToggleSwitch';
import { GameFormState, GameFormViewModel } from '../viewmodels/GameFormViewModel';
import './GameFormFields.scss';

interface GameFormFieldsProps {
  state: GameFormState;
  viewModel: GameFormViewModel;
}

export const GameFormFields: React.FC<GameFormFieldsProps> = ({
  state,
  viewModel,
}) => {
  const {
    selectedDate,
    maxPlayers,
    unregisterDeadlineHours,
    paymentAmountDisplay,
    pricingMode,
    withPositions,
    withPriorityPlayers,
    readonly,
    locationName,
    locationLink,
    title,
  } = state;

  return (
    <>
      <div className="form-group">
        <label htmlFor="dateTime">Game Date & Time:</label>
        <div className="datepicker-container">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => viewModel.handleDateChange(date)}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            timeCaption="Time"
            dateFormat="MMMM d, yyyy HH:mm"
            placeholderText="Select date and time"
            className="datepicker-input"
            calendarClassName="datepicker-calendar"
            locale="en-GB"
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
          onChange={(e) => viewModel.handleMaxPlayersChange(parseInt(e.target.value))}
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
          onChange={(e) => viewModel.handleUnregisterDeadlineHoursChange(parseInt(e.target.value))}
          min="0"
          max="48"
          required
        />
        <div className="field-description">
          Players can unregister up until this many hours before the game starts.
        </div>
      </div>

      <div className="form-group">
        <ToggleSwitch
          id="pricingMode"
          checked={pricingMode === PricingMode.TOTAL_COST}
          onChange={(checked) => viewModel.handlePricingModeChange(checked ? PricingMode.TOTAL_COST : PricingMode.PER_PARTICIPANT)}
          label={pricingMode === PricingMode.TOTAL_COST ? 'Specify total game cost' : 'Specify game cost per participant'}
        />
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
          onChange={(e) => viewModel.handlePaymentAmountChange(e)}
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
          onChange={(e) => viewModel.handleLocationNameChange(e.target.value)}
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
          onChange={(e) => viewModel.handleLocationLinkChange(e.target.value)}
          placeholder="Paste a Google/Apple Maps link (optional)"
        />
        <div className="field-description">
          Optional: open Google/Apple Maps, share the place and paste the link here.
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="title">Game Title (optional):</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => viewModel.handleTitleChange(e.target.value)}
          placeholder="e.g. Tournament Final, Friendly Match"
          maxLength={255}
        />
        <div className="field-description">
          Optional: add a custom title for this game that will be displayed in the games list and game details.
        </div>
      </div>

      <div className="form-group">
        <ToggleSwitch
          id="withPositions"
          checked={withPositions}
          onChange={(checked) => viewModel.handleWithPositionsChange(checked)}
          label="Playing 5-1"
        />
      </div>

      <div className="form-group">
        <ToggleSwitch
          id="withPriorityPlayers"
          checked={withPriorityPlayers}
          onChange={(checked) => viewModel.handleWithPriorityPlayersChange(checked)}
          label="With priority players"
        />
        <div className="field-description">
          When enabled, priority players assigned to this game's day and type will have priority in registration.
        </div>
      </div>

      <div className="form-group">
        <ToggleSwitch
          id="readonly"
          checked={readonly}
          onChange={(checked) => viewModel.handleReadonlyChange(checked)}
          label="Readonly (close registration)"
        />
        <div className="field-description">
          When enabled, regular users cannot register or unregister. Admins can still manage participants until payment requests are sent.
        </div>
      </div>
    </>
  );
};

export default GameFormFields;
