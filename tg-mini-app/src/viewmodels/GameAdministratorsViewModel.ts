import { gameAdministratorsApi, GameAdministrator } from '../services/api';
import { AxiosError } from 'axios';

export interface GameAdministratorsState {
  administrators: GameAdministrator[];
  isLoading: boolean;
  error: string;
  showCreateForm: boolean;
  selectedDayOfWeek: number;
  withPositions: boolean;
  selectedUserId: number | null;
  isCreating: boolean;
  createError: string;
}

export type GameAdministratorsStateUpdater = (updates: Partial<GameAdministratorsState>) => void;

export class GameAdministratorsViewModel {
  private updateState: GameAdministratorsStateUpdater;

  constructor(updateState: GameAdministratorsStateUpdater) {
    this.updateState = updateState;
  }

  /**
   * Load all game administrator assignments
   */
  async loadAdministrators(): Promise<void> {
    try {
      this.updateState({ isLoading: true, error: '' });
      const data = await gameAdministratorsApi.getAll();
      this.updateState({ administrators: data });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load administrators';
      this.updateState({ error: errorMessage });
      console.error('Error loading administrators:', err);
    } finally {
      this.updateState({ isLoading: false });
    }
  }

  /**
   * Create a new game administrator assignment
   */
  async createAssignment(
    dayOfWeek: number,
    withPositions: boolean,
    userId: number,
    onSuccess?: () => void
  ): Promise<boolean> {
    try {
      this.updateState({ isCreating: true, createError: '' });
      await gameAdministratorsApi.create({
        dayOfWeek,
        withPositions,
        userId,
      });
      
      // Reset form
      this.updateState({
        showCreateForm: false,
        selectedUserId: null,
        selectedDayOfWeek: 0, // Monday
        withPositions: false,
      });
      
      // Reload administrators
      await this.loadAdministrators();
      
      if (onSuccess) {
        onSuccess();
      }
      
      return true;
    } catch (err) {
      let errorMessage = 'Failed to create assignment';
      if (err instanceof AxiosError && err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      this.updateState({ createError: errorMessage });
      return false;
    } finally {
      this.updateState({ isCreating: false });
    }
  }

  /**
   * Delete a game administrator assignment
   */
  async deleteAssignment(id: number, confirmFn: () => Promise<boolean>): Promise<boolean> {
    const confirmed = await confirmFn();
    if (!confirmed) return false;

    try {
      await gameAdministratorsApi.delete(id);
      await this.loadAdministrators();
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete assignment';
      this.updateState({ error: errorMessage });
      console.error('Error deleting administrator:', err);
      return false;
    }
  }

  /**
   * Show the create form
   */
  showCreateForm(): void {
    this.updateState({
      showCreateForm: true,
      createError: '',
      selectedUserId: null,
      selectedDayOfWeek: 0, // Monday (backend value: 0 = Monday)
      withPositions: false,
    });
  }

  /**
   * Hide the create form and reset form state
   */
  hideCreateForm(): void {
    this.updateState({
      showCreateForm: false,
      selectedUserId: null,
      createError: '',
    });
  }

  /**
   * Update selected user ID
   */
  setSelectedUserId(userId: number): void {
    this.updateState({
      selectedUserId: userId,
      createError: '',
    });
  }

  /**
   * Update selected day of week
   */
  setSelectedDayOfWeek(dayOfWeek: number): void {
    this.updateState({ selectedDayOfWeek: dayOfWeek });
  }

  /**
   * Toggle withPositions flag
   */
  setWithPositions(withPositions: boolean): void {
    this.updateState({ withPositions });
  }

  /**
   * Clear error messages
   */
  clearError(): void {
    this.updateState({ error: '' });
  }

  /**
   * Clear create error
   */
  clearCreateError(): void {
    this.updateState({ createError: '' });
  }

  /**
   * Set create error
   */
  setCreateError(error: string): void {
    this.updateState({ createError: error });
  }

  /**
   * Get initial state for the component
   */
  static getInitialState(): GameAdministratorsState {
    return {
      administrators: [],
      isLoading: true,
      error: '',
      showCreateForm: false,
      selectedDayOfWeek: 0, // Monday
      withPositions: false,
      selectedUserId: null,
      isCreating: false,
      createError: '',
    };
  }
}

