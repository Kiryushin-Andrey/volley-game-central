import React from 'react';
import { gamesApi } from '../services/api';
import { GameFormat, PricingMode } from '../types';
import { eurosToCents, centsToEuroString } from '../utils/currencyUtils';
import { logDebug } from '../debug';
import { parseGameFormat } from '../utils/gameFormat';

export interface GameFormState {
  selectedDate: Date | null;
  maxPlayers: number;
  unregisterDeadlineHours: number;
  paymentAmount: number; // Stored in cents
  paymentAmountDisplay: string; // Display value in euros
  pricingMode: PricingMode;
  gameFormat: GameFormat;
  readonly: boolean;
  locationName: string;
  locationLink: string;
  title: string;
  isLoading: boolean;
  isInitialLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export type GameFormStateUpdater = (updates: Partial<GameFormState>) => void;

export class GameFormViewModel {
  private readonly syncReactState: GameFormStateUpdater;
  private formState: GameFormState;
  private gameId: number | null;

  constructor(syncReactState: GameFormStateUpdater, gameId?: number) {
    this.formState = GameFormViewModel.getInitialState();
    this.syncReactState = syncReactState;
    this.gameId = gameId || null;
  }

  /** Apply partial updates to ViewModel state and mirror them into React. */
  private updateState(updates: Partial<GameFormState>): void {
    this.formState = { ...this.formState, ...updates };
    this.syncReactState(updates);
  }

  /**
   * Load default game settings (for creating a new game)
   */
  async loadDefaultSettings(): Promise<void> {
    try {
      this.updateState({ isInitialLoading: true, error: null });
      
      const defaults = await gamesApi.getDefaultGameSettings();
      const defaultDate = defaults.date;
      
      if (defaultDate.getHours() === 0 && defaultDate.getMinutes() === 0) {
        defaultDate.setHours(17, 0, 0, 0);
      }
      
      const updates: Partial<GameFormState> = {
        selectedDate: defaultDate,
        isInitialLoading: false,
      };

      if (defaults.locationName) updates.locationName = defaults.locationName;
      if (defaults.locationLink) updates.locationLink = defaults.locationLink;
      if (defaults.pricingMode) updates.pricingMode = defaults.pricingMode;
      if (typeof defaults.paymentAmount === 'number') {
        updates.paymentAmount = defaults.paymentAmount;
        updates.paymentAmountDisplay = centsToEuroString(defaults.paymentAmount);
      }
      if (defaults.gameFormat) {
        updates.gameFormat = defaults.gameFormat;
      }

      this.updateState(updates);
    } catch (err) {
      logDebug('Error fetching default date and time:');
      logDebug(err);
      
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7); // Add 1 week
      defaultDate.setHours(17, 0, 0, 0); // Set to 5:00 PM
      
      this.updateState({
        selectedDate: defaultDate,
        isInitialLoading: false,
        error: 'Failed to fetch default date and time',
      });
    }
  }

  /**
   * Load game data (for editing an existing game)
   */
  async loadGame(): Promise<void> {
    if (!this.gameId) return;
    
    try {
      this.updateState({ isLoading: true, error: null });
      const game = await gamesApi.getGame(this.gameId);
      
      this.updateState({
        selectedDate: new Date(game.dateTime),
        maxPlayers: game.maxPlayers,
        unregisterDeadlineHours: game.unregisterDeadlineHours || 5,
        paymentAmount: game.paymentAmount || 0,
        paymentAmountDisplay: centsToEuroString(game.paymentAmount || 0),
        pricingMode: game.pricingMode || PricingMode.PER_PARTICIPANT,
        gameFormat: game.gameFormat,
        readonly: !!game.readonly,
        locationName: game.locationName || '',
        locationLink: game.locationLink || '',
        title: game.title || '',
        isLoading: false,
      });
    } catch (err) {
      logDebug('Error loading game:');
      logDebug(err);
      this.updateState({
        isLoading: false,
        error: 'Failed to load game details',
      });
    }
  }

  /**
   * Handle date change
   */
  handleDateChange(date: Date | null): void {
    this.updateState({ selectedDate: date });
  }

  /**
   * Handle max players change
   */
  handleMaxPlayersChange(value: number): void {
    this.updateState({ maxPlayers: value });
  }

  /**
   * Handle unregister deadline hours change
   */
  handleUnregisterDeadlineHoursChange(value: number): void {
    this.updateState({ unregisterDeadlineHours: value });
  }

  /**
   * Handle payment amount input change
   */
  handlePaymentAmountChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const value = e.target.value;
    // Remove all non-digit and non-decimal point characters
    const numericValue = value.replace(/[^\d.]/g, '');
    
    // Only update if the value is a valid number or empty string
    if (numericValue === '' || !isNaN(Number(numericValue))) {
      this.updateState({
        paymentAmountDisplay: numericValue,
        paymentAmount: eurosToCents(numericValue || '0'),
      });
    }
  }

  /**
   * Handle pricing mode change
   */
  handlePricingModeChange(mode: PricingMode): void {
    this.updateState({ pricingMode: mode });
  }

  /**
   * Handle game format change
   */
  handleGameFormatChange(value: string): void {
    const format = parseGameFormat(value);
    if (format) {
      this.updateState({ gameFormat: format });
    }
  }

  /**
   * Handle readonly change
   */
  handleReadonlyChange(value: boolean): void {
    this.updateState({ readonly: value });
  }

  /**
   * Handle location name change
   */
  handleLocationNameChange(value: string): void {
    this.updateState({ locationName: value });
  }

  /**
   * Handle location link change
   */
  handleLocationLinkChange(value: string): void {
    this.updateState({ locationLink: value });
  }

  /**
   * Handle title change
   */
  handleTitleChange(value: string): void {
    this.updateState({ title: value });
  }

  /**
   * Submit form (create or update). Reads the ViewModel's form state so submit
   * always matches the latest field values, even if React has not re-rendered yet.
   */
  async handleSubmit(onSuccess: () => void): Promise<void> {
    if (!this.formState.selectedDate) {
      this.updateState({ error: 'Please select a date and time' });
      return;
    }

    if (this.gameId) {
      await this.updateGame(onSuccess);
    } else {
      await this.createGame(onSuccess);
    }
  }

  /**
   * Create a new game
   */
  private async createGame(onSuccess: () => void): Promise<void> {
    const { formState } = this;
    try {
      this.updateState({ isLoading: true, error: null });
      
      await gamesApi.createGame({
        dateTime: formState.selectedDate!.toISOString(),
        maxPlayers: formState.maxPlayers,
        unregisterDeadlineHours: formState.unregisterDeadlineHours,
        paymentAmount: formState.paymentAmount,
        pricingMode: formState.pricingMode,
        gameFormat: formState.gameFormat,
        readonly: formState.readonly,
        locationName: formState.locationName || null,
        locationLink: formState.locationLink || null,
        title: formState.title || null,
      });
      
      this.updateState({ isLoading: false });
      onSuccess();
    } catch (err: any) {
      logDebug('Error creating game:');
      logDebug(err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to create game. Please try again.';
      this.updateState({
        isLoading: false,
        error: errorMessage,
      });
    }
  }

  /**
   * Update an existing game
   */
  private async updateGame(onSuccess: () => void): Promise<void> {
    if (!this.gameId) return;
    const { formState } = this;

    try {
      this.updateState({ isSaving: true, error: null });
      
      await gamesApi.updateGame(this.gameId, {
        dateTime: formState.selectedDate!.toISOString(),
        maxPlayers: formState.maxPlayers,
        unregisterDeadlineHours: formState.unregisterDeadlineHours,
        paymentAmount: formState.paymentAmount,
        pricingMode: formState.pricingMode,
        gameFormat: formState.gameFormat,
        readonly: formState.readonly,
        locationName: formState.locationName || null,
        locationLink: formState.locationLink || null,
        title: formState.title || null,
      });
      
      this.updateState({ isSaving: false });
      onSuccess();
    } catch (err: any) {
      logDebug('Error updating game:');
      logDebug(err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to update game. Please try again.';
      this.updateState({
        isSaving: false,
        error: errorMessage,
      });
    }
  }

  /**
   * Get initial state for the component
   */
  static getInitialState(): GameFormState {
    return {
      selectedDate: null,
      maxPlayers: 14,
      unregisterDeadlineHours: 5,
      paymentAmount: 500, // Stored in cents
      paymentAmountDisplay: centsToEuroString(500), // Display value in euros
      pricingMode: PricingMode.PER_PARTICIPANT,
      gameFormat: 'recreational',
      readonly: false,
      locationName: '',
      locationLink: '',
      title: '',
      isLoading: false,
      isInitialLoading: false,
      isSaving: false,
      error: null,
    };
  }
}
