import { gamesApi, bunqApi } from '../services/api';
import { showPopup, showConfirm } from '../utils/uiPrompts';
import { logDebug } from '../debug';
import { Game } from '../types';
import type { Dispatch, SetStateAction } from 'react';

type Setter<T> = Dispatch<SetStateAction<T>>;

export class GameDetailsViewModel {
  private readonly setGame: Setter<Game | null>;
  private readonly setIsLoading: Setter<boolean>;
  private readonly setIsActionLoading: Setter<boolean>;
  private readonly setError: Setter<string | null>;
  private readonly setHasBunqIntegration: Setter<boolean>;
  private readonly setIsCheckingBunq: Setter<boolean>;
  private readonly setIsPaidUpdating: Setter<number | null>;
  private readonly setShowUserSearch: Setter<boolean>;
  private readonly setIsSendingPaymentRequests: Setter<boolean>;
  private readonly setShowPasswordDialog: Setter<boolean>;
  private readonly setPasswordError: Setter<string>;
  private readonly navigate: (url: string) => void;

  constructor(args: {
    setGame: Setter<Game | null>;
    setIsLoading: Setter<boolean>;
    setIsActionLoading: Setter<boolean>;
    setError: Setter<string | null>;
    setHasBunqIntegration: Setter<boolean>;
    setIsCheckingBunq: Setter<boolean>;
    setIsPaidUpdating: Setter<number | null>;
    setShowUserSearch: Setter<boolean>;
    setIsSendingPaymentRequests: Setter<boolean>;
    setShowPasswordDialog: Setter<boolean>;
    setPasswordError: Setter<string>;
    navigate: (url: string) => void;
  }) {
    this.setGame = args.setGame;
    this.setIsLoading = args.setIsLoading;
    this.setIsActionLoading = args.setIsActionLoading;
    this.setError = args.setError;
    this.setHasBunqIntegration = args.setHasBunqIntegration;
    this.setIsCheckingBunq = args.setIsCheckingBunq;
    this.setIsPaidUpdating = args.setIsPaidUpdating;
    this.setShowUserSearch = args.setShowUserSearch;
    this.setIsSendingPaymentRequests = args.setIsSendingPaymentRequests;
    this.setShowPasswordDialog = args.setShowPasswordDialog;
    this.setPasswordError = args.setPasswordError;
    this.navigate = args.navigate;
  }

  async loadGame(id: number): Promise<void> {
    try {
      this.setIsLoading(true);
      const fetchedGame = await gamesApi.getGame(id);
      this.setGame(fetchedGame);
    } catch (err) {
      this.setError('Failed to load game details');
      logDebug('Error loading game:');
      logDebug(err);
    } finally {
      this.setIsLoading(false);
    }
  }

  async checkBunqIntegration(isAdmin: boolean): Promise<void> {
    const doCheck = async () => {
      if (isAdmin) {
        try {
          const status = await bunqApi.getStatus();
          this.setHasBunqIntegration(status.enabled);
        } catch (error) {
          logDebug('Error checking Bunq integration status: ' + error);
          this.setHasBunqIntegration(false);
        }
      }
      this.setIsCheckingBunq(false);
    };
    await doCheck();
  }

  async addParticipant(game: Game, userId: number): Promise<void> {
    try {
      this.setIsActionLoading(true);
      await gamesApi.addParticipant(game.id, userId);
      await this.loadGame(game.id);
      this.setShowUserSearch(false);
    } catch (err: any) {
      logDebug('Error adding participant:');
      logDebug(err);
      alert('Failed to add participant. Please try again.');
    } finally {
      this.setIsActionLoading(false);
    }
  }

  async register(game: Game): Promise<void> {
    try {
      this.setIsActionLoading(true);
      await gamesApi.registerForGame(game.id);
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
      this.setIsActionLoading(false);
    }
  }

  confirmAndUnregister(game: Game): void {
    showPopup({
      title: 'Leave Game',
      message: 'Are you sure you want to leave this game?',
      buttons: [
        { id: 'cancel', type: 'cancel' },
        { id: 'leave', type: 'destructive', text: 'Leave Game' }
      ]
    }, (buttonId?: string) => {
      if (buttonId === 'leave') {
        this.performUnregistration(game);
      }
    });
  }

  private async performUnregistration(game: Game): Promise<void> {
    try {
      this.setIsActionLoading(true);
      await gamesApi.unregisterFromGame(game.id);
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
            title: 'Cannot Leave Game',
            message: `You can only unregister up to ${deadline.toLocaleTimeString()} (${deadlineHours} hours before the game starts).`,
            buttons: [{ type: 'ok' }]
          });
        } else {
          showPopup({
            title: 'Error',
            message: typeof err === 'string' ? err : err.message || 'Failed to leave the game',
            buttons: [{ type: 'ok' }]
          });
        }
      } else {
        showPopup({
          title: 'Error',
          message: typeof err === 'string' ? err : err.message || 'Failed to leave the game',
          buttons: [{ type: 'ok' }]
        });
      }
    } finally {
      this.setIsActionLoading(false);
    }
  }

  removePlayer(game: Game, userId: number): void {
    const player = game.registrations.find(reg => reg.userId === userId);
    const username = player?.user?.username || `Player ${userId}`;
    showConfirm(`Remove ${username} from this game?`, async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setIsActionLoading(true);
        await gamesApi.removeParticipant(game.id, userId);
        this.setGame(prevGame => {
          if (!prevGame) return null;
          return {
            ...prevGame,
            registrations: prevGame.registrations.filter(reg => reg.userId !== userId)
          } as Game;
        });
        showPopup({ title: 'Success', message: `${username} has been removed from the game`, buttons: [{ type: 'ok' }] });
      } catch (err) {
        logDebug('Error removing player:');
        logDebug(err);
        showPopup({ title: 'Error', message: 'Failed to remove player from the game', buttons: [{ type: 'ok' }] });
      } finally {
        this.setIsActionLoading(false);
      }
    });
  }

  togglePaidStatus(game: Game, userId: number, currentPaidStatus: boolean): void {
    const newPaidStatus = !currentPaidStatus;
    const username = game.registrations.find(reg => reg.userId === userId)?.user?.username || `Player ${userId}`;
    showConfirm(`${newPaidStatus ? 'Mark' : 'Unmark'} ${username} as ${newPaidStatus ? 'paid' : 'unpaid'}?`, async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setIsPaidUpdating(userId);
        await gamesApi.updatePlayerPaidStatus(game.id, userId, newPaidStatus);
        this.setGame(prevGame => {
          if (!prevGame) return null;
          return {
            ...prevGame,
            registrations: prevGame.registrations.map(reg => reg.userId === userId ? { ...reg, paid: newPaidStatus } : reg)
          } as Game;
        });
      } catch (err) {
        logDebug('Error updating paid status:');
        logDebug(err);
        showPopup({ title: 'Error', message: 'Failed to update payment status', buttons: [{ type: 'ok' }] });
      } finally {
        this.setIsPaidUpdating(null);
      }
    });
  }

  startPaymentRequestsFlow(): void {
    this.setPasswordError('');
    this.setShowPasswordDialog(true);
  }

  async submitPassword(gameId: number, password: string): Promise<void> {
    try {
      this.setIsSendingPaymentRequests(true);
      this.setPasswordError('');
      const result = await gamesApi.createPaymentRequests(gameId, password);
      this.setShowPasswordDialog(false);
      showPopup({
        title: 'Payment requests sent',
        message: `${result.requestsCreated} payment requests sent successfully.${result.errors.length > 0 ? ` ${result.errors.length} errors occurred.` : ''}`,
        buttons: [{ type: 'ok' }]
      });
      await this.loadGame(gameId);
    } catch (error: any) {
      logDebug('Error sending payment requests: ' + error);
      if (error?.response?.data?.error == 'Invalid password') {
        this.setPasswordError(error.response?.data?.error);
      } else {
        this.setShowPasswordDialog(false);
        showPopup({ title: 'Error', message: error instanceof Error ? error.message : 'Unknown error', buttons: [{ type: 'ok' }] });
      }
    } finally {
      this.setIsSendingPaymentRequests(false);
    }
  }

  cancelPasswordFlow(): void {
    this.setShowPasswordDialog(false);
    this.setPasswordError('');
    this.setIsSendingPaymentRequests(false);
  }

  async deleteGame(gameId: number): Promise<void> {
    showConfirm('Are you sure you want to delete this game? This action cannot be undone.', async (confirmed) => {
      if (!confirmed) return;
      try {
        this.setIsActionLoading(true);
        await gamesApi.deleteGame(gameId);
        this.navigate('/');
      } catch (error) {
        logDebug('Error deleting game:');
        logDebug(error);
        showPopup({ title: 'Error', message: 'Failed to delete the game. Please try again.', buttons: [{ type: 'ok' }] });
        this.setIsActionLoading(false);
      }
    });
  }
}


