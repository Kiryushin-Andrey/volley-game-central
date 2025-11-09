import { gamesApi, bunqApi } from '../services/api';
import { showPopup, showConfirm } from '../utils/uiPrompts';
import { logDebug } from '../debug';
import { Game, User } from '../types';
import type { UserPublicInfo } from '../types';
import { ActionGuard } from '../utils/actionGuard';
import { getUserRegistration } from '../utils/registrationsUtils';
import { isGamePast, canJoinGame, canLeaveGame, DAYS_BEFORE_GAME_TO_JOIN } from '../utils/gameDateUtils';

export interface GameDataState {
  game: Game | null;
  isLoading: boolean;
  error: string | null;
}

export interface ActionState {
  isActionLoading: boolean;
  isPaidUpdating: number | null; // Stores userId of player being updated
}

export interface BunqState {
  hasBunqIntegration: boolean;
  isCheckingBunq: boolean;
}

export interface PaymentRequestState {
  isSendingPaymentRequests: boolean;
  showPasswordDialog: boolean;
  passwordError: string;
  passwordDialogAction: 'payment_requests' | 'check_payments';
  isCheckingPayments: boolean;
}

export interface DialogState {
  showUserSearch: boolean;
  showGuestDialog: boolean;
  guestError: string;
  isGuestRegistering: boolean;
  defaultGuestName: string;
  showPlayerInfo: boolean;
  selectedUser: UserPublicInfo | null;
  showBringBallDialog: boolean;
}

export interface GameDetailsState {
  gameData: GameDataState;
  action: ActionState;
  bunq: BunqState;
  paymentRequest: PaymentRequestState;
  dialogs: DialogState;
}

type StateUpdater<T> = (updates: Partial<T>) => void;

export class GameDetailsViewModel {
  private state: GameDetailsState;
  private updateGameData: StateUpdater<GameDataState>;
  private updateAction: StateUpdater<ActionState>;
  private updateBunq: StateUpdater<BunqState>;
  private updatePaymentRequest: StateUpdater<PaymentRequestState>;
  private updateDialogs: StateUpdater<DialogState>;
  private readonly navigate: (url: string) => void;
  private readonly user: User;
  private readonly actionGuard: ActionGuard;

  constructor(args: {
    updateGameData: StateUpdater<GameDataState>;
    updateAction: StateUpdater<ActionState>;
    updateBunq: StateUpdater<BunqState>;
    updatePaymentRequest: StateUpdater<PaymentRequestState>;
    updateDialogs: StateUpdater<DialogState>;
    navigate: (url: string) => void;
    user: User;
  }) {
    this.updateGameData = args.updateGameData;
    this.updateAction = args.updateAction;
    this.updateBunq = args.updateBunq;
    this.updatePaymentRequest = args.updatePaymentRequest;
    this.updateDialogs = args.updateDialogs;
    this.navigate = args.navigate;
    this.user = args.user;
    this.actionGuard = new ActionGuard(1000);
    
    // Initialize internal state
    this.state = GameDetailsViewModel.getInitialState();
    
    // Sync initial state to React
    this.updateGameData(this.state.gameData);
    this.updateAction(this.state.action);
    this.updateBunq(this.state.bunq);
    this.updatePaymentRequest(this.state.paymentRequest);
    this.updateDialogs(this.state.dialogs);
  }

  // Internal state update methods
  private setGameData(updates: Partial<GameDataState>): void {
    this.state.gameData = { ...this.state.gameData, ...updates };
    this.updateGameData(this.state.gameData);
  }

  private setAction(updates: Partial<ActionState>): void {
    this.state.action = { ...this.state.action, ...updates };
    this.updateAction(this.state.action);
  }

  private setBunq(updates: Partial<BunqState>): void {
    this.state.bunq = { ...this.state.bunq, ...updates };
    this.updateBunq(this.state.bunq);
  }

  private setPaymentRequest(updates: Partial<PaymentRequestState>): void {
    this.state.paymentRequest = { ...this.state.paymentRequest, ...updates };
    this.updatePaymentRequest(this.state.paymentRequest);
  }

  private setDialogs(updates: Partial<DialogState>): void {
    this.state.dialogs = { ...this.state.dialogs, ...updates };
    this.updateDialogs(this.state.dialogs);
  }

  // Getters for current state
  get game(): Game | null {
    return this.state.gameData.game;
  }

  get isLoading(): boolean {
    return this.state.gameData.isLoading;
  }

  get error(): string | null {
    return this.state.gameData.error;
  }

  get isActionLoading(): boolean {
    return this.state.action.isActionLoading;
  }

  get isPaidUpdating(): number | null {
    return this.state.action.isPaidUpdating;
  }

  get hasBunqIntegration(): boolean {
    return this.state.bunq.hasBunqIntegration;
  }

  get isCheckingBunq(): boolean {
    return this.state.bunq.isCheckingBunq;
  }

  async loadGame(id: number): Promise<void> {
    try {
      this.setGameData({ isLoading: true });
      const fetchedGame = await gamesApi.getGame(id);
      this.setGameData({ game: fetchedGame, error: null });
    } catch (err) {
      this.setGameData({ error: 'Failed to load game details' });
      logDebug('Error loading game:');
      logDebug(err);
    } finally {
      this.setGameData({ isLoading: false });
    }
  }

  async checkBunqIntegration(isAdmin: boolean): Promise<void> {
    const doCheck = async () => {
      if (isAdmin) {
        try {
          const status = await bunqApi.getStatus();
          this.setBunq({ hasBunqIntegration: status.enabled });
        } catch (error) {
          logDebug('Error checking Bunq integration status: ' + error);
          this.setBunq({ hasBunqIntegration: false });
        }
      }
      this.setBunq({ isCheckingBunq: false });
    };
    await doCheck();
  }

  private async addParticipant(game: Game, userId: number): Promise<void> {
    try {
      this.setAction({ isActionLoading: true });
      await gamesApi.addParticipant(game.id, userId);
      await this.loadGame(game.id);
      this.setDialogs({ showUserSearch: false });
    } catch (err: any) {
      logDebug('Error adding participant:');
      logDebug(err);
      alert('Failed to add participant. Please try again.');
    } finally {
      this.setAction({ isActionLoading: false });
    }
  }

  private async register(game: Game, bringingTheBall: boolean): Promise<void> {
    try {
      this.setAction({ isActionLoading: true });
      await gamesApi.registerForGame(game.id, undefined, bringingTheBall);
      await this.loadGame(game.id);
    } catch (err: any) {
      logDebug('Error registering for game:');
      logDebug(err);
      if (err.response?.status === 403) {
        const errData = err.response?.data;
        if (errData?.registrationOpensAt) {
          const openDate = new Date(errData.registrationOpensAt);
          alert(`Registration is only possible starting ${openDate.toLocaleDateString()} (X days before the game).`);
        } else {
          alert('You cannot register for this game yet due to timing restrictions.');
        }
      } else {
        alert('Failed to register for game. Please try again.');
      }
    } finally {
      this.setAction({ isActionLoading: false });
    }
  }

  private confirmAndUnregister(game: Game, guestName?: string): void {
    const isGuest = !!guestName;
    const title = isGuest ? 'Unregister Guest' : 'Leave Game';
    const message = isGuest
      ? `Are you sure you want to unregister guest "${guestName}" from this game?`
      : 'Are you sure you want to leave this game?';
    const actionId = isGuest ? 'unregister' : 'leave';
    const actionText = isGuest ? 'Unregister Guest' : 'Leave Game';
    showPopup({
      title,
      message,
      buttons: [
        { id: 'cancel', type: 'cancel' },
        { id: actionId, type: 'destructive', text: actionText }
      ]
    }, (buttonId?: string) => {
      if (buttonId === actionId) {
        this.performUnregistration(game, guestName);
      }
    });
  }

  private async performUnregistration(game: Game, guestName?: string): Promise<void> {
    try {
      this.setAction({ isActionLoading: true });
      if (guestName) {
        await gamesApi.unregisterFromGame(game.id, guestName);
      } else {
        await gamesApi.unregisterFromGame(game.id);
      }
      await this.loadGame(game.id);
    } catch (err: any) {
      logDebug('Error unregistering from game:');
      logDebug(err);
      if (err.response?.status === 403) {
        const errData = err.response?.data;
        if (errData?.error?.includes('unregister')) {
          const gameTime = new Date(game.dateTime);
          const deadlineHours = game.unregisterDeadlineHours || 5;
          const deadline = new Date(gameTime.getTime() - deadlineHours * 60 * 60 * 1000);
          showPopup({
            title: guestName ? 'Cannot Unregister Guest' : 'Cannot Leave Game',
            message: `You can only unregister up to ${deadline.toLocaleTimeString()} (${deadlineHours} hours before the game starts).`,
            buttons: [{ type: 'ok' }]
          });
        } else {
          showPopup({
            title: 'Error',
            message: typeof err === 'string' ? err : err.message || (guestName ? 'Failed to unregister guest' : 'Failed to leave the game'),
            buttons: [{ type: 'ok' }]
          });
        }
      } else {
        showPopup({
          title: 'Error',
          message: typeof err === 'string' ? err : err.message || (guestName ? 'Failed to unregister guest' : 'Failed to leave the game'),
          buttons: [{ type: 'ok' }]
        });
      }
    } finally {
      this.setAction({ isActionLoading: false });
    }
  }

  private removePlayer(game: Game, userId: number, guestName?: string): void {
    const player = game.registrations.find(reg => reg.userId === userId && (!guestName ? !reg.guestName : reg.guestName === guestName));
    const displayName = guestName || player?.user?.displayName || player?.user?.telegramUsername || `Player ${userId}`;
    showConfirm(`Remove ${displayName} from this game?`, async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setAction({ isActionLoading: true });
        await gamesApi.removeParticipant(game.id, userId, guestName);
        // Reload game to ensure only the targeted registration is removed
        await this.loadGame(game.id);
        showPopup({ title: 'Success', message: `${displayName} has been removed from the game`, buttons: [{ type: 'ok' }] });
      } catch (err) {
        logDebug('Error removing player:');
        logDebug(err);
        showPopup({ title: 'Error', message: 'Failed to remove player from the game', buttons: [{ type: 'ok' }] });
      } finally {
        this.setAction({ isActionLoading: false });
      }
    });
  }

  private togglePaidStatus(game: Game, userId: number, currentPaidStatus: boolean): void {
    const newPaidStatus = !currentPaidStatus;
    const name = game.registrations.find(reg => reg.userId === userId)?.user?.displayName
      || game.registrations.find(reg => reg.userId === userId)?.user?.telegramUsername
      || `Player ${userId}`;
    showConfirm(`${newPaidStatus ? 'Mark' : 'Unmark'} ${name} as ${newPaidStatus ? 'paid' : 'unpaid'}?`, async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setAction({ isPaidUpdating: userId });
        await gamesApi.updatePlayerPaidStatus(game.id, userId, newPaidStatus);
        // Update game in state
        const updatedGame: Game = {
          ...game,
          registrations: game.registrations.map(reg => reg.userId === userId ? { ...reg, paid: newPaidStatus } : reg)
        };
        this.setGameData({ game: updatedGame });
      } catch (err) {
        logDebug('Error updating paid status:');
        logDebug(err);
        showPopup({ title: 'Error', message: 'Failed to update payment status', buttons: [{ type: 'ok' }] });
      } finally {
        this.setAction({ isPaidUpdating: null });
      }
    });
  }

  private startPaymentRequestsFlow(): void {
    this.setPaymentRequest({ passwordError: '', showPasswordDialog: true, passwordDialogAction: 'payment_requests' });
  }

  private async submitPassword(gameId: number, password: string): Promise<void> {
    try {
      this.setPaymentRequest({ isSendingPaymentRequests: true, passwordError: '' });
      const result = await gamesApi.createPaymentRequests(gameId, password);
      this.setPaymentRequest({ showPasswordDialog: false });
      showPopup({
        title: 'Payment requests sent',
        message: `${result.requestsCreated} payment requests sent successfully.${result.errors.length > 0 ? ` ${result.errors.length} errors occurred.` : ''}`,
        buttons: [{ type: 'ok' }]
      });
      await this.loadGame(gameId);
    } catch (error: any) {
      logDebug('Error sending payment requests: ' + error);
      if (error?.response?.data?.error == 'Invalid password') {
        this.setPaymentRequest({ passwordError: error.response?.data?.error });
      } else {
        this.setPaymentRequest({ showPasswordDialog: false });
        showPopup({ title: 'Error', message: error instanceof Error ? error.message : 'Unknown error', buttons: [{ type: 'ok' }] });
      }
    } finally {
      this.setPaymentRequest({ isSendingPaymentRequests: false });
    }
  }

  private async deleteGame(gameId: number): Promise<void> {
    showConfirm('Are you sure you want to delete this game? This action cannot be undone.', async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setAction({ isActionLoading: true });
        await gamesApi.deleteGame(gameId);
        this.navigate('/');
      } catch (error) {
        logDebug('Error deleting game:');
        logDebug(error);
        showPopup({ title: 'Error', message: 'Failed to delete the game. Please try again.', buttons: [{ type: 'ok' }] });
        this.setAction({ isActionLoading: false });
      }
    });
  }

  // Helper methods for dialog state updates
  setShowUserSearch(show: boolean): void {
    this.setDialogs({ showUserSearch: show });
  }

  private setShowPasswordDialog(show: boolean): void {
    this.setPaymentRequest({ showPasswordDialog: show });
  }

  private setPasswordError(error: string): void {
    this.setPaymentRequest({ passwordError: error });
  }

  private setPasswordDialogAction(action: 'payment_requests' | 'check_payments'): void {
    this.setPaymentRequest({ passwordDialogAction: action });
  }

  private setShowGuestDialog(show: boolean): void {
    this.setDialogs({ showGuestDialog: show });
  }

  private setGuestError(error: string): void {
    this.setDialogs({ guestError: error });
  }

  private setIsGuestRegistering(isRegistering: boolean): void {
    this.setDialogs({ isGuestRegistering: isRegistering });
  }

  private setDefaultGuestName(name: string): void {
    this.setDialogs({ defaultGuestName: name });
  }

  private setShowPlayerInfo(show: boolean): void {
    this.setDialogs({ showPlayerInfo: show });
  }

  private setSelectedUser(user: UserPublicInfo | null): void {
    this.setDialogs({ selectedUser: user });
  }

  private setShowBringBallDialog(show: boolean): void {
    this.setDialogs({ showBringBallDialog: show });
  }

  private setIsCheckingPayments(isChecking: boolean): void {
    this.setPaymentRequest({ isCheckingPayments: isChecking });
  }

  // Main action handlers
  private handleRegister(): void {
    if (!this.state.gameData.game || this.state.action.isActionLoading) return;
    // Prevent blocked users from registering
    if (this.user.blockReason) {
      showPopup({
        title: "Registration blocked",
        message: `You cannot register because: ${this.user.blockReason}`,
        buttons: [{ type: 'ok' }]
      });
      return;
    }
    // Show the bring ball dialog
    this.setShowBringBallDialog(true);
  }

  private handleUnregister(): void {
    if (!this.state.gameData.game || this.state.action.isActionLoading) return;
    this.confirmAndUnregister(this.state.gameData.game);
  }

  handleAddParticipant(userId: number): void {
    if (!this.state.gameData.game || this.state.action.isActionLoading) return;
    this.addParticipant(this.state.gameData.game, userId);
  }

  handleRemovePlayer(userId: number, guestName?: string): void {
    if (!this.state.gameData.game || this.state.action.isActionLoading) return;

    const isGameAdmin = this.user.isAdmin || (this.state.gameData.game.isAssignedAdmin ?? false);
    const canUnregister = this.canUnregister();
    if (isGameAdmin && (userId != this.user.id || !canUnregister)) {
      this.removePlayer(this.state.gameData.game, userId, guestName);
      return;
    }

    this.confirmAndUnregister(this.state.gameData.game, guestName);
  }

  handleRemovePlayerFromWaitingList(userId: number, guestName?: string): void {
    if (!this.state.gameData.game || this.state.action.isActionLoading) return;

    const isGameAdmin = this.user.isAdmin || (this.state.gameData.game.isAssignedAdmin ?? false);
    if (isGameAdmin && userId != this.user.id) {
      this.removePlayer(this.state.gameData.game, userId, guestName);
      return;
    }

    this.confirmAndUnregister(this.state.gameData.game, guestName);
  }

  handleTogglePaidStatus(userId: number, currentPaidStatus: boolean): void {
    if (!this.state.gameData.game) return;
    this.togglePaidStatus(this.state.gameData.game, userId, currentPaidStatus);
  }

  handleSendPaymentRequests(): void {
    if (!this.state.gameData.game || !this.actionGuard.isAllowed()) return;
    this.setPasswordDialogAction('payment_requests');
    this.startPaymentRequestsFlow();
  }

  handleCheckPayments(): void {
    if (!this.state.gameData.game || !this.actionGuard.isAllowed()) return;
    this.setPasswordDialogAction('check_payments');
    this.setShowPasswordDialog(true);
  }

  async handlePasswordSubmit(password: string): Promise<void> {
    if (!this.state.gameData.game) return;

    if (this.state.paymentRequest.passwordDialogAction === 'check_payments') {
      try {
        this.setIsCheckingPayments(true);
        this.setPasswordError('');
        const result = await gamesApi.checkPayments(password, this.state.gameData.game.id);
        this.setShowPasswordDialog(false);
        showPopup({
          title: 'Payment check completed',
          message: result.message || 'Payment check completed successfully',
          buttons: [{ type: 'ok' }]
        });
        await this.loadGame(this.state.gameData.game.id);
      } catch (error: any) {
        if (error?.response?.data?.message === 'Invalid password') {
          this.setPasswordError(error.response?.data?.message);
        } else {
          this.setShowPasswordDialog(false);
          showPopup({
            title: 'Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            buttons: [{ type: 'ok' }]
          });
        }
      } finally {
        this.setIsCheckingPayments(false);
      }
    } else {
      await this.submitPassword(this.state.gameData.game.id, password);
    }
  }

  handlePasswordCancel(): void {
    this.setShowPasswordDialog(false);
    this.setPasswordError("");
  }

  async handleGuestRegister(): Promise<void> {
    if (!this.state.gameData.game || this.state.action.isActionLoading) return;
    // Prevent blocked users from adding guests
    if (this.user.blockReason) {
      showPopup({
        title: "Guest registration blocked",
        message: `You cannot add guests because: ${this.user.blockReason}`,
        buttons: [{ type: 'ok' }]
      });
      return;
    }
    
    try {
      // Fetch the last used guest name as default
      const { lastGuestName } = await gamesApi.getLastGuestName(this.state.gameData.game.id);
      this.setDefaultGuestName(lastGuestName || "");
      this.setShowGuestDialog(true);
      this.setGuestError("");
    } catch (error) {
      console.error('Error fetching last guest name:', error);
      this.setDefaultGuestName("");
      this.setShowGuestDialog(true);
      this.setGuestError("");
    }
  }

  async handleGuestSubmit(guestName: string, inviterUserId?: number): Promise<void> {
    if (!this.state.gameData.game || this.state.dialogs.isGuestRegistering) return;
    
    this.setIsGuestRegistering(true);
    this.setGuestError("");
    
    try {
      // If admin is adding a guest for a past game or readonly game with inviter selected, use admin endpoint
      const isPastGame = isGamePast(this.state.gameData.game.dateTime);
      const hasPaymentRequests = this.state.gameData.game.collectorUser !== null && this.state.gameData.game.collectorUser !== undefined;
      const isGameAdmin = this.user.isAdmin || (this.state.gameData.game.isAssignedAdmin ?? false);
      const isReadonly = this.state.gameData.game.readonly;
      if (isGameAdmin && (isPastGame || isReadonly) && !hasPaymentRequests && inviterUserId) {
        await gamesApi.addParticipant(this.state.gameData.game.id, inviterUserId, guestName);
      } else {
        await gamesApi.registerGuestForGame(this.state.gameData.game.id, guestName);
      }
      await this.loadGame(this.state.gameData.game.id);      
      this.setShowGuestDialog(false);
    } catch (error: any) {
      console.error('Error registering guest:', error);
      const errorMessage = error.response?.data?.error || 'Failed to register guest';
      this.setGuestError(errorMessage);
    } finally {
      this.setIsGuestRegistering(false);
    }
  }

  handleGuestCancel(): void {
    this.setShowGuestDialog(false);
    this.setGuestError("");
    this.setDefaultGuestName("");
  }

  handleShowPlayerInfo(user: UserPublicInfo): void {
    this.setSelectedUser(user);
    this.setShowPlayerInfo(true);
  }

  handleClosePlayerInfo(): void {
    this.setShowPlayerInfo(false);
    this.setSelectedUser(null);
  }

  async handleBringBallSubmit(bringingTheBall: boolean): Promise<void> {
    if (!this.state.gameData.game || this.state.action.isActionLoading) return;
    
    await this.register(this.state.gameData.game, bringingTheBall);
    this.setShowBringBallDialog(false);
  }

  handleBringBallCancel(): void {
    this.setShowBringBallDialog(false);
  }

  handleDeleteGame(): void {
    if (!this.state.gameData.game) return;
    this.deleteGame(this.state.gameData.game.id);
  }

  // Helper methods for UI state
  canUnregister(): boolean {
    if (!this.state.gameData.game) return false;
    if (isGamePast(this.state.gameData.game.dateTime)) return false;
    const deadlineHours = this.state.gameData.game.unregisterDeadlineHours || 5;
    return canLeaveGame(this.state.gameData.game.dateTime, false, deadlineHours);
  }

  getInfoText(): string | null {
    if (!this.state.gameData.game) return null;

    const userRegistration = this.state.gameData.game.registrations.find(
      (reg) => reg.userId === this.user.id
    );
    const deadlineHours = this.state.gameData.game.unregisterDeadlineHours || 5;

    // If user is registered, check if they can leave
    if (userRegistration) {
      if (
        !isGamePast(this.state.gameData.game.dateTime) &&
        !canLeaveGame(
          this.state.gameData.game.dateTime,
          userRegistration.isWaitlist,
          deadlineHours
        ) &&
        !userRegistration.isWaitlist
      ) {
        return `You can only leave the game up to ${deadlineHours} hours before it starts.`;
      }
    } else {
      // If user is not registered, check if they can join
      if (!canJoinGame(this.state.gameData.game.dateTime)) {
        const gameDateTime = new Date(this.state.gameData.game.dateTime);
        const daysBeforeGame = new Date(gameDateTime.getTime());
        daysBeforeGame.setDate(daysBeforeGame.getDate() - DAYS_BEFORE_GAME_TO_JOIN);
        return `Registration opens ${daysBeforeGame.toLocaleDateString()} (${DAYS_BEFORE_GAME_TO_JOIN} days before the game).`;
      }
    }

    return null;
  }

  shouldShowAddGuestButton(): boolean {
    if (!this.state.gameData.game || this.state.gameData.isLoading || this.state.action.isActionLoading || this.state.gameData.error) {
      return false;
    }
    
    const game = this.state.gameData.game;
    
    // For readonly games, only admins can add guests
    if (game.readonly) {
      return this.user.isAdmin || (game.isAssignedAdmin ?? false);
    }
    
    // Only show for upcoming games with open registration
    return canJoinGame(game.dateTime);
  }

  getMainButtonProps(): { show: boolean; text?: string; onClick?: () => void } {
    // No button during loading states or errors
    if (!this.state.gameData.game || this.state.gameData.isLoading || this.state.action.isActionLoading || this.state.gameData.error) {
      return { show: false };
    }

    // Don't show buttons for readonly games - all users must use admin interface
    if (this.state.gameData.game.readonly) {
      return { show: false };
    }

    // Find user's own registration (exclude their guests)
    const userRegistration = getUserRegistration(this.state.gameData.game, this.user.id);

    if (userRegistration) {
      // Check if user can leave the game (up to X hours before or anytime if waitlisted)
      if (
        canLeaveGame(
          this.state.gameData.game.dateTime,
          userRegistration.isWaitlist,
          this.state.gameData.game.unregisterDeadlineHours || 5
        )
      ) {
        return {
          show: true,
          text: "Leave Game",
          onClick: () => {
            if (this.actionGuard.isAllowed()) {
              this.handleUnregister();
            }
          },
        };
      }
    } else {
      // Check if user can join the game (starting X days before)
      if (canJoinGame(this.state.gameData.game.dateTime)) {
        return {
          show: true,
          text: "Join Game",
          onClick: () => {
            if (this.actionGuard.isAllowed()) {
              this.handleRegister();
            }
          },
        };
      }
    }

    // Default: don't show button
    return { show: false };
  }

  /**
   * Get initial state for the component
   */
  static getInitialState(): GameDetailsState {
    return {
      gameData: {
        game: null,
        isLoading: true,
        error: null,
      },
      action: {
        isActionLoading: false,
        isPaidUpdating: null,
      },
      bunq: {
        hasBunqIntegration: false,
        isCheckingBunq: true,
      },
      paymentRequest: {
        isSendingPaymentRequests: false,
        showPasswordDialog: false,
        passwordError: '',
        passwordDialogAction: 'payment_requests',
        isCheckingPayments: false,
      },
      dialogs: {
        showUserSearch: false,
        showGuestDialog: false,
        guestError: '',
        isGuestRegistering: false,
        defaultGuestName: '',
        showPlayerInfo: false,
        selectedUser: null,
        showBringBallDialog: false,
      },
    };
  }
}
