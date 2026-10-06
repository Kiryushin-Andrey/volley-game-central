import { gamesApi as defaultGamesApi, bunqApi as defaultBunqApi } from '../services/api';
import type { UiPrompts } from '../utils/uiPrompts';
import { logDebug } from '../debug';
import { Game, User } from '../types';
import type { UserPublicInfo } from '../types';
import { ActionGuard } from '../utils/actionGuard';
import { getUserRegistration } from '../utils/registrationsUtils';
import { isGamePast, isGameUpcoming, canJoinGame, canLeaveGame, GameCategory } from '../utils/gameDateUtils';

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

type GamesApi = typeof defaultGamesApi;
type BunqApi = typeof defaultBunqApi;

export class GameDetailsViewModel {
  private state: GameDetailsState;
  private listeners: Array<() => void> = [];
  private readonly navigate: (url: string) => void;
  private readonly user: User;
  private readonly prompts: UiPrompts;
  private readonly gamesApi: GamesApi;
  private readonly bunqApi: BunqApi;
  private readonly actionGuard: ActionGuard;
  private loadGameGeneration = 0;

  constructor(args: {
    navigate: (url: string) => void;
    user: User;
    prompts: UiPrompts;
    gamesApi?: GamesApi;
    bunqApi?: BunqApi;
  }) {
    this.navigate = args.navigate;
    this.user = args.user;
    this.prompts = args.prompts;
    this.gamesApi = args.gamesApi ?? defaultGamesApi;
    this.bunqApi = args.bunqApi ?? defaultBunqApi;
    this.actionGuard = new ActionGuard(1000);
    this.state = GameDetailsViewModel.getInitialState();
  }

  /** Stable refs for React.useSyncExternalStore (same pattern as PhoneAuth). */
  subscribe = (listener: () => void) => {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  };

  getSnapshot = () => this.state;

  private emitChange() {
    for (const l of this.listeners) l();
  }

  // Internal state update methods — replace top-level state so getSnapshot identity changes
  private setGameData(updates: Partial<GameDataState>): void {
    this.state = {
      ...this.state,
      gameData: { ...this.state.gameData, ...updates },
    };
    this.emitChange();
  }

  private setAction(updates: Partial<ActionState>): void {
    this.state = {
      ...this.state,
      action: { ...this.state.action, ...updates },
    };
    this.emitChange();
  }

  private setBunq(updates: Partial<BunqState>): void {
    this.state = {
      ...this.state,
      bunq: { ...this.state.bunq, ...updates },
    };
    this.emitChange();
  }

  private setPaymentRequest(updates: Partial<PaymentRequestState>): void {
    this.state = {
      ...this.state,
      paymentRequest: { ...this.state.paymentRequest, ...updates },
    };
    this.emitChange();
  }

  private setDialogs(updates: Partial<DialogState>): void {
    this.state = {
      ...this.state,
      dialogs: { ...this.state.dialogs, ...updates },
    };
    this.emitChange();
  }

  // Convenience getters (also available via getSnapshot())
  get gameData(): GameDataState {
    return this.state.gameData;
  }

  get action(): ActionState {
    return this.state.action;
  }

  get bunq(): BunqState {
    return this.state.bunq;
  }

  get paymentRequest(): PaymentRequestState {
    return this.state.paymentRequest;
  }

  get dialogs(): DialogState {
    return this.state.dialogs;
  }

  get game(): Game | null {
    return this.state.gameData.game;
  }

  get gameCategory(): GameCategory | null {
    if (!this.game) return null;
    return this.game.category;
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
    const generation = ++this.loadGameGeneration;
    try {
      this.setGameData({ isLoading: true });
      const fetchedGame = await this.gamesApi.getGame(id);
      if (generation !== this.loadGameGeneration) {
        return;
      }
      this.setGameData({ game: fetchedGame, error: null });
    } catch (err) {
      if (generation !== this.loadGameGeneration) {
        return;
      }
      this.setGameData({ error: 'Failed to load game details' });
      logDebug('Error loading game:');
      logDebug(err);
    } finally {
      if (generation === this.loadGameGeneration) {
        this.setGameData({ isLoading: false });
      }
    }
  }

  async checkBunqIntegration(isAdmin: boolean): Promise<void> {
    const doCheck = async () => {
      if (isAdmin) {
        try {
          const status = await this.bunqApi.getStatus();
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
      await this.gamesApi.addParticipant(game.id, userId);
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
      await this.gamesApi.registerForGame(game.id, undefined, bringingTheBall);
      await this.loadGame(game.id);
    } catch (err: any) {
      logDebug('Error registering for game:');
      logDebug(err);
      if (err.response?.status === 403) {
        const errData = err.response?.data;
        if (typeof errData !== 'object' || errData === null) {
          this.prompts.showPopup({ title: 'Cannot register', message: 'You cannot register for this game. Please try again or contact the organizers.', buttons: [{ type: 'ok' }] });
        } else if (errData?.registrationOpensAt) {
          const openDate = new Date(errData.registrationOpensAt);
          alert(`Registration is only possible starting ${openDate.toLocaleDateString()} (X days before the game).`);
        } else if (errData?.code == 'TELEGRAM_GROUP_REQUIRED') {
          const message = errData?.error || 'To register for games you must join our Telegram group.';
          const link = import.meta.env.VITE_TELEGRAM_GROUP_INVITE_LINK;

          if (link) {
            this.prompts.showPopup({
              title: 'Join the group',
              message,
              buttons: [
                { type: 'ok', text: 'Join group', id: 'open_group' },
                { type: 'cancel', text: 'Close', id: 'close' }
              ]
            }, (id) => {
              if (id === 'open_group') {
                const wa = (window as any)?.Telegram?.WebApp;
                if (wa?.openLink) wa.openLink(link);
                else if (typeof window !== 'undefined') window.open(link, '_blank');
              }
            });
          } else {
            this.prompts.showPopup({ title: 'Join the group', message, buttons: [{ type: 'ok' }] });
          }
        } else if (errData?.error) {
          this.prompts.showPopup({ title: 'Cannot register', message: errData.error, buttons: [{ type: 'ok' }] });
        } else {
          this.prompts.showPopup({ title: 'Cannot register', message: 'You cannot register for this game. Please try again or contact the organizers.', buttons: [{ type: 'ok' }] });
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
    this.prompts.showPopup({
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
        await this.gamesApi.unregisterFromGame(game.id, guestName);
      } else {
        await this.gamesApi.unregisterFromGame(game.id);
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
          this.prompts.showPopup({
            title: guestName ? 'Cannot Unregister Guest' : 'Cannot Leave Game',
            message: `You can only unregister up to ${deadline.toLocaleTimeString()} (${deadlineHours} hours before the game starts).`,
            buttons: [{ type: 'ok' }]
          });
        } else {
          this.prompts.showPopup({
            title: 'Error',
            message: typeof err === 'string' ? err : err.message || (guestName ? 'Failed to unregister guest' : 'Failed to leave the game'),
            buttons: [{ type: 'ok' }]
          });
        }
      } else {
        this.prompts.showPopup({
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
    this.prompts.showConfirm(`Remove ${displayName} from this game?`, async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setAction({ isActionLoading: true });
        await this.gamesApi.removeParticipant(game.id, userId, guestName);
        // Reload game to ensure only the targeted registration is removed
        await this.loadGame(game.id);
        this.prompts.showPopup({ title: 'Success', message: `${displayName} has been removed from the game`, buttons: [{ type: 'ok' }] });
      } catch (err) {
        logDebug('Error removing player:');
        logDebug(err);
        this.prompts.showPopup({ title: 'Error', message: 'Failed to remove player from the game', buttons: [{ type: 'ok' }] });
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
    this.prompts.showConfirm(`${newPaidStatus ? 'Mark' : 'Unmark'} ${name} as ${newPaidStatus ? 'paid' : 'unpaid'}?`, async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setAction({ isPaidUpdating: userId });
        await this.gamesApi.updatePlayerPaidStatus(game.id, userId, newPaidStatus);
        // Update game in state
        const updatedGame: Game = {
          ...game,
          registrations: game.registrations.map(reg => reg.userId === userId ? { ...reg, paid: newPaidStatus } : reg)
        };
        this.setGameData({ game: updatedGame });
      } catch (err) {
        logDebug('Error updating paid status:');
        logDebug(err);
        this.prompts.showPopup({ title: 'Error', message: 'Failed to update payment status', buttons: [{ type: 'ok' }] });
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
      const result = await this.gamesApi.createPaymentRequests(gameId, password);
      this.setPaymentRequest({ showPasswordDialog: false });
      this.prompts.showPopup({
        title: 'Payment requests sent',
        message: `${result.requestsCreated} payment requests sent successfully.${result.errors.length > 0 ? ` ${result.errors.length} errors occurred.` : ''}`,
        buttons: [{ type: 'ok' }]
      });
      await this.loadGame(gameId);
    } catch (error: any) {
      logDebug('Error sending payment requests: ' + error);
      // Extract error message from response data if available, otherwise use error message
      const errorMessage = error?.response?.data?.error || error?.message || 'Unknown error';
      
      // Check for "Invalid password" error - this should be a 400 error from the server
      if (errorMessage === 'Invalid password') {
        // Keep the password dialog open and show the error message
        this.setPaymentRequest({ passwordError: errorMessage });
      } else {
        this.setPaymentRequest({ showPasswordDialog: false });
        this.prompts.showPopup({ title: 'Error', message: errorMessage, buttons: [{ type: 'ok' }] });
      }
    } finally {
      this.setPaymentRequest({ isSendingPaymentRequests: false });
    }
  }

  private async deleteGame(gameId: number): Promise<void> {
    this.prompts.showConfirm('Are you sure you want to delete this game? This action cannot be undone.', async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setAction({ isActionLoading: true });
        await this.gamesApi.deleteGame(gameId);
        this.navigate('/');
      } catch (error) {
        logDebug('Error deleting game:');
        logDebug(error);
        this.prompts.showPopup({ title: 'Error', message: 'Failed to delete the game. Please try again.', buttons: [{ type: 'ok' }] });
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
      this.prompts.showPopup({
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

    const isGameAdmin = this.user.isAdmin || this.state.gameData.game.isAssignedAdmin;
    const canUnregister = this.canUnregister();
    if (isGameAdmin && (userId != this.user.id || !canUnregister)) {
      this.removePlayer(this.state.gameData.game, userId, guestName);
      return;
    }

    this.confirmAndUnregister(this.state.gameData.game, guestName);
  }

  handleRemovePlayerFromWaitingList(_userId: number, guestName?: string): void {
    if (!this.state.gameData.game || this.state.action.isActionLoading) return;

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
        const result = await this.gamesApi.checkPayments(password, this.state.gameData.game.id);
        this.setShowPasswordDialog(false);
        this.prompts.showPopup({
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
          this.prompts.showPopup({
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
      this.prompts.showPopup({
        title: "Guest registration blocked",
        message: `You cannot add guests because: ${this.user.blockReason}`,
        buttons: [{ type: 'ok' }]
      });
      return;
    }
    
    // Check if guest registration is allowed (detail API fields)
    const game = this.state.gameData.game;
    const isGameAdmin = this.user.isAdmin || game.isAssignedAdmin;
    const isReadonly = game.readonly;

    // Admins can add guests to readonly games, but regular users need the guest window
    if (!isReadonly && !isGameAdmin && !game.canRegisterGuest) {
      const opensAt = new Date(game.guestRegistrationOpensAt);
      this.prompts.showPopup({
        title: "Guest registration not available",
        message: `Guest registration opens ${opensAt.toLocaleDateString()} (${game.guestRegistrationOpenDays} days before the game).`,
        buttons: [{ type: 'ok' }]
      });
      return;
    }
    
    try {
      // Fetch the last used guest name as default
      const { lastGuestName } = await this.gamesApi.getLastGuestName(this.state.gameData.game.id);
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
      const isGameAdmin = this.user.isAdmin || this.state.gameData.game.isAssignedAdmin;
      const isReadonly = this.state.gameData.game.readonly;
      if (isGameAdmin && (isPastGame || isReadonly) && !hasPaymentRequests && inviterUserId) {
        await this.gamesApi.addParticipant(this.state.gameData.game.id, inviterUserId, guestName);
      } else {
        await this.gamesApi.registerGuestForGame(this.state.gameData.game.id, guestName);
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
    if (this.state.gameData.game.readonly) return false;
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
      if (!this.userMaySelfRegister()) {
        const game = this.state.gameData.game;
        if ((game.activeSpotOffers?.length ?? 0) > 0) {
          return 'Accept the offer to join the game';
        }
        const timingAllowsJoin = canJoinGame(game.registrationOpensAt);
        if (!game.canSelfRegister && timingAllowsJoin) {
          return 'You cannot register for this game at the moment.';
        }

        const gameDateTime = new Date(game.dateTime);
        const opensAt = new Date(game.registrationOpensAt);
        const opensDay = new Date(opensAt.getFullYear(), opensAt.getMonth(), opensAt.getDate());
        const gameDay = new Date(
          gameDateTime.getFullYear(),
          gameDateTime.getMonth(),
          gameDateTime.getDate(),
        );
        const daysBefore = Math.round(
          (gameDay.getTime() - opensDay.getTime()) / (24 * 60 * 60 * 1000),
        );

        let message = `You can register for this game starting from ${opensAt.toLocaleDateString()} (${daysBefore} days before the game).`;

        // Add disclaimer for non-priority users about priority players
        if (
          game.gameFormat === 'priority_players' &&
          !game.isPriorityPlayer &&
          isGameUpcoming(game.dateTime)
        ) {
          message += ' This game has priority players who can register ahead of others.';
        }

        return message;
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
      return this.user.isAdmin || game.isAssignedAdmin;
    }

    if (!this.userMaySelfRegister()) {
      return false;
    }

    return game.canRegisterGuest;
  }

  /** Backend-driven eligibility from detail payload. */
  userMaySelfRegister(): boolean {
    const game = this.state.gameData.game;
    if (!game) return false;
    return game.canSelfRegister;
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
    const mySelfOffer = (this.state.gameData.game.myOffers || []).find((o) => !o.guestName);

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

      // After leave deadline: Offer my spot (roster only, not waitlist, no existing self offer)
      if (
        !userRegistration.isWaitlist &&
        !mySelfOffer &&
        isGameUpcoming(this.state.gameData.game.dateTime)
      ) {
        return {
          show: true,
          text: "Offer my spot",
          onClick: () => {
            if (this.actionGuard.isAllowed()) {
              this.handleOfferSpot();
            }
          },
        };
      }
    } else {
      // Check if user can join the game (starting X days before)
      if (this.userMaySelfRegister()) {
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

    return { show: false };
  }

  canOfferSpot(guestName?: string | null): boolean {
    const game = this.state.gameData.game;
    if (!game || game.readonly || isGamePast(game.dateTime)) return false;
    const deadlineHours = game.unregisterDeadlineHours || 5;
    if (canLeaveGame(game.dateTime, false, deadlineHours)) return false;

    const match = game.registrations.find(
      (r) =>
        r.userId === this.user.id &&
        (guestName ? r.guestName === guestName : !r.guestName) &&
        !r.isWaitlist,
    );
    if (!match) return false;

    const alreadyOffering = (game.myOffers || []).some((o) =>
      guestName ? o.guestName === guestName : !o.guestName,
    );
    return !alreadyOffering;
  }

  async handleOfferSpot(guestName?: string): Promise<void> {
    const game = this.state.gameData.game;
    if (!game) return;

    const label = guestName ? `guest "${guestName}"` : 'your spot';
    this.prompts.showConfirm(
      `Offer ${label}? You'll stay registered until someone accepts. Once someone accepts your offer, you cannot take your spot back anymore.`,
      async (confirmed) => {
        if (!confirmed) return;
        this.setAction({ isActionLoading: true });
        try {
          await this.gamesApi.createSpotOffer(game.id, guestName);
          await this.loadGame(game.id);
          this.prompts.showPopup({
            title: 'Spot offered',
            message: 'Your spot is being offered. You can cancel it from this page.',
            buttons: [{ type: 'ok' }],
          });
        } catch (error: any) {
          const message =
            error?.response?.data?.error || error?.message || 'Failed to offer spot';
          this.prompts.showPopup({
            title: 'Error',
            message,
            buttons: [{ type: 'ok' }],
          });
        } finally {
          this.setAction({ isActionLoading: false });
        }
      },
    );
  }

  async handleCancelSpotOffer(guestName?: string | null): Promise<void> {
    const game = this.state.gameData.game;
    if (!game) return;

    this.prompts.showConfirm('Cancel this spot offer?', async (confirmed) => {
      if (!confirmed) return;
      this.setAction({ isActionLoading: true });
      try {
        await this.gamesApi.cancelMySpotOffer(game.id, guestName || undefined);
        await this.loadGame(game.id);
      } catch (error: any) {
        const message =
          error?.response?.data?.error || error?.message || 'Failed to cancel offer';
        this.prompts.showPopup({
          title: 'Error',
          message,
          buttons: [{ type: 'ok' }],
        });
      } finally {
        this.setAction({ isActionLoading: false });
      }
    });
  }

  async handleAcceptSpotOffer(offerId: number): Promise<void> {
    const game = this.state.gameData.game;
    if (!game) return;

    this.prompts.showConfirm(
      'Accept this offered spot? You will take their place for the game.',
      async (confirmed) => {
        if (!confirmed) return;
        this.setAction({ isActionLoading: true });
        try {
          await this.gamesApi.acceptSpotOffer(game.id, offerId);
          await this.loadGame(game.id);
          this.prompts.showPopup({
            title: 'Spot accepted',
            message: "You're in! Spot accepted.",
            buttons: [{ type: 'ok' }],
          });
        } catch (error: any) {
          const message =
            error?.response?.data?.error || error?.message || 'Failed to accept spot';
          this.prompts.showPopup({
            title: 'Error',
            message,
            buttons: [{ type: 'ok' }],
          });
        } finally {
          this.setAction({ isActionLoading: false });
        }
      },
    );
  }

  /** Whether the caller may Accept an open offer (button only; banner is always shown). */
  canAcceptOffer(offer: { offererUserId: number }): boolean {
    const game = this.state.gameData.game;
    if (!game || game.readonly || isGamePast(game.dateTime)) return false;
    if (offer.offererUserId === this.user.id) return false;
    if (game.canAcceptSpotOffer === false) return false;

    const onRoster = game.registrations.some(
      (r) => r.userId === this.user.id && !r.isWaitlist,
    );
    return !onRoster;
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
