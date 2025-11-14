import { priorityPlayersApi, gameAdministratorsApi, PriorityPlayer, GameAdministrator } from '../services/api';
import { AxiosError } from 'axios';

export interface PriorityPlayersState {
  priorityPlayers: PriorityPlayer[];
  gameAdministrators: GameAdministrator[];
  isLoading: boolean;
  error: string;
  showCreateForm: boolean;
  selectedGameAdministratorId: number | null;
  selectedUserId: number | null;
  isCreating: boolean;
  createError: string;
  currentAdminId: number | null;
}

export type PriorityPlayersStateUpdater = (updates: Partial<PriorityPlayersState>) => void;

export class PriorityPlayersViewModel {
  private updateState: PriorityPlayersStateUpdater;

  constructor(updateState: PriorityPlayersStateUpdater) {
    this.updateState = updateState;
  }

  /**
   * Initialize the viewmodel with a game administrator ID from URL
   */
  async initialize(gameAdministratorId: number | null): Promise<boolean> {
    if (!gameAdministratorId || Number.isNaN(gameAdministratorId)) {
      this.updateState({ error: 'Invalid game administrator ID' });
      return false;
    }

    this.updateState({ currentAdminId: gameAdministratorId });
    await Promise.all([
      this.loadPriorityPlayersForAdmin(gameAdministratorId),
      this.loadGameAdministrators(),
    ]);
    this.setSelectedGameAdministratorId(gameAdministratorId);
    return true;
  }

  /**
   * Load all priority players and game administrators
   */
  async loadData(): Promise<void> {
    try {
      this.updateState({ isLoading: true, error: '' });
      const [priorityPlayers, gameAdministrators] = await Promise.all([
        priorityPlayersApi.getAll(),
        gameAdministratorsApi.getAll(),
      ]);
      this.updateState({ priorityPlayers, gameAdministrators });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      this.updateState({ error: errorMessage });
      console.error('Error loading priority players:', err);
    } finally {
      this.updateState({ isLoading: false });
    }
  }

  /**
   * Load game administrators
   */
  async loadGameAdministrators(): Promise<void> {
    try {
      const gameAdministrators = await gameAdministratorsApi.getAll();
      this.updateState({ gameAdministrators });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load game administrators';
      this.updateState({ error: errorMessage });
      console.error('Error loading game administrators:', err);
    }
  }

  /**
   * Load priority players filtered by game administrator ID
   */
  async loadPriorityPlayersForAdmin(gameAdministratorId: number): Promise<void> {
    try {
      this.updateState({ isLoading: true, error: '' });
      const data = await priorityPlayersApi.getAll(gameAdministratorId);
      this.updateState({ priorityPlayers: data });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load priority players';
      this.updateState({ error: errorMessage });
      console.error('Error loading priority players:', err);
    } finally {
      this.updateState({ isLoading: false });
    }
  }

  /**
   * Create a new priority player assignment
   */
  async createAssignment(
    gameAdministratorId: number,
    userId: number,
    onSuccess?: () => void
  ): Promise<boolean> {
    try {
      this.updateState({ isCreating: true, createError: '' });
      await priorityPlayersApi.create({
        gameAdministratorId,
        userId,
      });
      
      // Reset form
      this.updateState({
        showCreateForm: false,
        selectedUserId: null,
      });
      
      // Reload priority players
      await this.loadPriorityPlayersForAdmin(gameAdministratorId);
      
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
   * Delete a priority player assignment
   */
  async deleteAssignment(
    id: number,
    currentPriorityPlayers: PriorityPlayer[],
    confirmFn: () => Promise<boolean>
  ): Promise<boolean> {
    const confirmed = await confirmFn();
    if (!confirmed) return false;

    try {
      await priorityPlayersApi.delete(id);
      const updatedPriorityPlayers = currentPriorityPlayers.filter(pp => pp.id !== id);
      this.updateState({ priorityPlayers: updatedPriorityPlayers });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete assignment';
      this.updateState({ error: errorMessage });
      console.error('Error deleting priority player:', err);
      return false;
    }
  }

  /**
   * Get the current game administrator from state
   */
  getCurrentAdmin(state: PriorityPlayersState): GameAdministrator | null {
    if (!state.currentAdminId) return null;
    return state.gameAdministrators.find((admin) => admin.id === state.currentAdminId) || null;
  }

  /**
   * Check if user can manage priority players for the current assignment
   */
  canManage(state: PriorityPlayersState, userId: number | undefined, isAdmin: boolean | undefined): boolean {
    const currentAdmin = this.getCurrentAdmin(state);
    if (!currentAdmin) return false;
    if (isAdmin) return true;
    return currentAdmin.userId === userId;
  }

  /**
   * Validate create form
   */
  validateCreateForm(state: PriorityPlayersState): string | null {
    if (!state.selectedUserId) {
      return 'Please select a user';
    }
    if (!state.selectedGameAdministratorId) {
      return 'Invalid game administrator assignment';
    }
    return null;
  }

  /**
   * Show the create form
   */
  showCreateForm(): void {
    this.updateState({
      showCreateForm: true,
      createError: '',
      selectedUserId: null,
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
   * Update selected game administrator ID
   */
  setSelectedGameAdministratorId(gameAdministratorId: number | null): void {
    this.updateState({ selectedGameAdministratorId: gameAdministratorId });
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
  static getInitialState(): PriorityPlayersState {
    return {
      priorityPlayers: [],
      gameAdministrators: [],
      isLoading: true,
      error: '',
      showCreateForm: false,
      selectedGameAdministratorId: null,
      selectedUserId: null,
      isCreating: false,
      createError: '',
      currentAdminId: null,
    };
  }
}

