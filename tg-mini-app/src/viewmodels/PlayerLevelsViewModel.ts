import { playerLevelsApi } from '../services/api';
import type { PlayerLevel, UserWithPlayerLevel } from '../types';
import {
  ALL_PLAYER_LEVEL_FILTER_OPTIONS,
  comparePlayersForLevelsList,
  isShowingAllPlayerLevels,
  type PlayerLevelFilterOption,
} from '../utils/playerLevel';

export interface PlayerLevelsState {
  users: import('../types').UserWithPlayerLevel[];
  filterQuery: string;
  selectedLevelFilters: PlayerLevelFilterOption[];
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
      selectedLevelFilters: [...ALL_PLAYER_LEVEL_FILTER_OPTIONS],
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

  toggleLevelFilter(
    currentSelected: PlayerLevelFilterOption[],
    level: PlayerLevelFilterOption,
  ): void {
    const index = currentSelected.indexOf(level);
    const selectedLevelFilters =
      index === -1
        ? [...currentSelected, level]
        : currentSelected.filter((l) => l !== level);
    this.updateState({ selectedLevelFilters });
  }

  filterUsers(state: PlayerLevelsState): import('../types').UserWithPlayerLevel[] {
    let users = state.users;

    if (state.selectedLevelFilters.length === 0) {
      return [];
    }

    if (!isShowingAllPlayerLevels(state.selectedLevelFilters)) {
      users = users.filter((u) => {
        if (!u.playerLevel) {
          return state.selectedLevelFilters.includes('unassigned');
        }
        return state.selectedLevelFilters.includes(u.playerLevel);
      });
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

  async updatePlayerLevel(
    userId: number,
    playerLevel: PlayerLevel,
    currentUsers: UserWithPlayerLevel[],
  ): Promise<UserWithPlayerLevel | null> {
    this.updateState({ savingUserId: userId, error: null });
    try {
      const updated = await playerLevelsApi.updateUserLevel(userId, playerLevel);
      const users = currentUsers
        .map((u) => (u.id === userId ? updated : u))
        .sort(comparePlayersForLevelsList);
      this.updateState({ users, savingUserId: null });
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
