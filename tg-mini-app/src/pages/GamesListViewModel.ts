import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamesApi, bunqApi, userApi } from '../services/api';
import type { UnpaidRegistration } from '../services/api';
import { GameWithStats, User } from '../types';
import { logDebug } from '../debug';

export type GameFilter = 'upcoming' | 'past';

// ViewModel to encapsulate all state and logic for GamesList
export class GamesListViewModel {
  private listeners: Array<() => void> = [];
  private isLoadingRef = { current: false } as { current: boolean };

  // state
  games: GameWithStats[] = [];
  allGames: GameWithStats[] = [];
  error: string | null = null;
  gameFilter: GameFilter = 'upcoming';
  showAll = false;
  showPositions = false;
  hasBunqIntegration = false;
  unpaidItems: UnpaidRegistration[] = [];
  loadingUnpaid = false;
  loadingGames = false;
  showPageContent = false;

  constructor(
    private user: User,
    private deps: {
      gamesApi: typeof gamesApi;
      bunqApi: typeof bunqApi;
      userApi: typeof userApi;
      navigate: ReturnType<typeof useNavigate>;
      logDebug: typeof logDebug;
    }
  ) {
    // initialize showPositions from localStorage
    try {
      const saved = localStorage.getItem('showPositions');
      this.showPositions = saved === 'true';
    } catch {}
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emitChange() {
    for (const l of this.listeners) l();
  }

  // setters
  setShowPositions(val: boolean) {
    this.showPositions = val;
    try {
      localStorage.setItem('showPositions', val ? 'true' : 'false');
    } catch {}
    // re-filter games locally if already loaded
    this.applyPositionFilter();
    this.emitChange();
  }

  setGameFilter(filter: GameFilter) {
    if (this.gameFilter === filter) return;
    this.gameFilter = filter;
    this.emitChange();
    // reload unpaid on filter change (as in original code)
    this.loadUnpaid();
    // reload games to respect filter-dependent API call for past/upcoming
    this.loadGames();
  }

  setShowAll(val: boolean) {
    if (this.showAll === val) return;
    this.showAll = val;
    this.emitChange();
    this.loadGames();
  }

  setShowPageContent(val: boolean) {
    this.showPageContent = val;
    this.emitChange();
  }

  async init() {
    // bunq status for admins
    if (this.user.isAdmin) {
      try {
        const status = await this.deps.bunqApi.getStatus();
        this.hasBunqIntegration = !!status.enabled;
      } catch (e) {
        this.deps.logDebug('Failed to load bunq status');
        this.hasBunqIntegration = false;
      } finally {
        this.emitChange();
      }
    }
    // initial data
    await Promise.all([this.loadGames(), this.loadUnpaid()]);
  }

  private applyPositionFilter() {
    if (this.allGames.length === 0) {
      this.games = [];
      return;
    }
    let filtered = [...this.allGames];
    // Asymmetric behavior: when toggle is OFF -> hide 5-1 games; when ON -> show all
    if (!this.showPositions) {
      filtered = filtered.filter((g) => !g.withPositions);
    }
    this.games = filtered;
  }

  async loadGames() {
    if (this.isLoadingRef.current) return;
    try {
      this.isLoadingRef.current = true;
      this.loadingGames = true;
      this.emitChange();

      const showPast = this.gameFilter === 'past';
      const fetchedGames = await this.deps.gamesApi.getAllGames(showPast, this.showAll);

      const gamesWithRequiredProps: GameWithStats[] = fetchedGames.map((game: any) => ({
        ...game,
        totalRegisteredCount: game.totalRegisteredCount || 0,
        paidCount: game.paidCount,
        registeredCount: game.registeredCount,
        isUserRegistered: game.isUserRegistered || false,
        userRegistration: game.userRegistration || undefined,
      }));

      this.allGames = gamesWithRequiredProps;
      this.error = null;

      // apply position filter
      this.applyPositionFilter();
    } catch (err) {
      this.error = 'Failed to load games';
      this.deps.logDebug('Error loading games:');
      this.deps.logDebug(err);
    } finally {
      this.isLoadingRef.current = false;
      this.loadingGames = false;
      this.emitChange();
    }
  }

  async loadUnpaid() {
    try {
      this.loadingUnpaid = true;
      this.emitChange();
      const items = await this.deps.userApi.getMyUnpaidGames();
      this.unpaidItems = items || [];
      this.setShowPageContent(this.unpaidItems.length === 0);
    } catch (e) {
      this.deps.logDebug('Error loading unpaid games:');
      this.deps.logDebug(e);
      this.unpaidItems = [];
    } finally {
      this.loadingUnpaid = false;
      this.emitChange();
    }
  }

  // navigation and helpers
  navigateTo(path: string) {
    this.deps.navigate(path);
  }

  handleGameClick = (gameId: number) => {
    this.deps.navigate(`/game/${gameId}`);
  };

  formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today, ${timeString}`;
    if (isTomorrow) return `Tomorrow, ${timeString}`;

    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const weekday = date.toLocaleString('en-US', { weekday: 'long' });
    return `${day} ${month}, ${weekday}, ${timeString}`;
  };
}

export function useGamesListViewModel(user: User) {
  const navigate = useNavigate();
  const vmRef = useRef<GamesListViewModel | null>(null);
  if (!vmRef.current) {
    vmRef.current = new GamesListViewModel(user, {
      gamesApi,
      bunqApi,
      userApi,
      navigate,
      logDebug,
    });
  }
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = vmRef.current!.subscribe(() => setTick((t) => t + 1));
    vmRef.current!.init();
    return () => {
      unsub();
    };
  }, []);
  return vmRef.current!;
}
