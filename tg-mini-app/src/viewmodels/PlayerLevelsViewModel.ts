import { playerLevelsApi } from '../services/api';
import type { PlayerLevel, UserWithPlayerLevel } from '../types';
import type { PlayerLevelFilter } from '../utils/playerLevel';

export interface PlayerLevelsState {
  users: import('../types').UserWithPlayerLevel[];
  filterQuery: string;
  levelFilter: PlayerLevelFilter;
  isLoading: boolean;
  error: string | null;
  savingUserId: number | null;
}

export type PlayerLevelsStateUpdater = (updates: Partial<PlayerLevelsState>) => void;

export class PlayerLevelsViewModel {
  constructor(private updateState: PlayerLevelsStateUpdater) {}

  static getInitialState(): PlayerLevelsState {
    return {
      users: [],
      filterQuery: '',
      levelFilter: 'all',
      isLoading: true,
      error: null,
      savingUserId: null,
    };
  }

  async loadUsers(): Promise<void> {
    this.updateState({ isLoading: true, error: null });
    try {
      const users = await playerLevelsApi.listUsers();
      this.updateState({ users, isLoading: false });
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load players';
      this.updateState({ error: message, isLoading: false });
    }
  }

  setFilterQuery(filterQuery: string): void {
    this.updateState({ filterQuery });
  }

  setLevelFilter(levelFilter: PlayerLevelFilter): void {
    this.updateState({ levelFilter });
  }

  filterUsers(state: PlayerLevelsState): import('../types').UserWithPlayerLevel[] {
    let users = state.users;

    if (state.levelFilter === 'unassigned') {
      users = users.filter((u) => !u.playerLevel);
    } else if (state.levelFilter !== 'all') {
      users = users.filter((u) => u.playerLevel === state.levelFilter);
    }

    const q = state.filterQuery.trim().toLowerCase();
    if (!q) {
      return users;
    }
    return users.filter((u) => {
      const name = (u.displayName || u.telegramUsername || '').toLowerCase();
      return name.includes(q);
    });
  }

  async updatePlayerLevel(userId: number, playerLevel: PlayerLevel): Promise<UserWithPlayerLevel | null> {
    this.updateState({ savingUserId: userId, error: null });
    try {
      const updated = await playerLevelsApi.updateUserLevel(userId, playerLevel);
      await this.loadUsers();
      this.updateState({ savingUserId: null });
      return updated;
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update player level';
      this.updateState({ error: message, savingUserId: null });
      return null;
    }
  }
}
