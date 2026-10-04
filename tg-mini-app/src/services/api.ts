import axios, { type AxiosRequestConfig } from 'axios';
import { Game, User, GameWithStats, PricingMode, UserPublicInfo, UserWithPlayerLevel, PlayerLevel } from '../types';
import { logDebug } from '../debug';

/** Minimal HTTP port so tests can supply a fake without axios / Telegram. */
export interface HttpTransport {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<{ data: T; status?: number }>;
  post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T; status?: number }>;
  put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T; status?: number }>;
  patch<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T; status?: number }>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<{ data: T; status?: number }>;
}

export type CreateAxiosTransportOptions = {
  baseURL?: string;
  /** Defaults to reading `window.Telegram.WebApp.initData` when available. */
  getTelegramInitData?: () => string | undefined;
};

/**
 * Axios adapter: base URL, Telegram auth header, debug interceptors.
 * Pass `getTelegramInitData` (or a full custom `HttpTransport`) to avoid `window.Telegram` in tests.
 */
export function createAxiosTransport(options: CreateAxiosTransportOptions = {}): HttpTransport {
  const baseURL = options.baseURL ?? (import.meta.env?.VITE_API_BASE_URL || '/api');
  const getTelegramInitData =
    options.getTelegramInitData ??
    (() => {
      if (typeof window === 'undefined') return undefined;
      return window.Telegram?.WebApp?.initData;
    });

  logDebug(`API_BASE_URL: ${baseURL}`);

  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  });

  client.interceptors.request.use((config) => {
    logDebug(`Making API request to: ${(config.baseURL || '') + (config.url || '')}`);

    const telegramInitData = getTelegramInitData();

    if (telegramInitData) {
      logDebug('Adding Telegram WebApp initData to request headers');
      config.headers.Authorization = `TelegramWebApp ${telegramInitData}`;
    } else {
      logDebug('No Telegram WebApp initData available');
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => {
      logDebug(`API response success: ${response.status} ${JSON.stringify(response.data)}`);
      return response;
    },
    (error) => {
      logDebug(`API response error: ${error.response?.status} ${JSON.stringify(error.response?.data)} ${error.message}`);
      console.error('API response error:', error.response?.status, error.response?.data, error.message);
      return Promise.reject(error);
    }
  );

  return client;
}

/** Build domain API objects against any HttpTransport (real axios or test fake). */
export function createApiClients(http: HttpTransport) {
/** Public endpoint: server build timestamp for reload-on-deploy detection */
const getBuildInfo = async (): Promise<{ buildTimestamp: string }> => {
  const response = await http.get<{ buildTimestamp: string }>('/build-info');
  return response.data;
};

// User-related API endpoints
const userApi = {
  /**
   * Get current authenticated user details
   * Authentication happens automatically via request interceptor above
   */
  getCurrentUser: async (): Promise<{ user: User | null; isDevMode: boolean }> => {
    const response = await http.get('/users/me');
    return response.data;
  },
  
  /**
   * Update user profile
   */
  updateProfile: async (userData: Partial<User>): Promise<User> => {
    const response = await http.put('/users/me', userData);
    return response.data;
  },
  
  /**
   * Admin: Get unpaid games for a specific user by ID
   */
  getUserUnpaidGames: async (userId: number): Promise<UnpaidRegistration[]> => {
    const response = await http.get(`/users/admin/id/${userId}/unpaid-games`);
    return response.data;
  },

  /**
   * Current user: Get unpaid games (grouped per game)
   * Reuses backend endpoint GET /users/me/unpaid-games
   */
  getMyUnpaidGames: async (): Promise<UnpaidRegistration[]> => {
    const response = await http.get('/users/me/unpaid-games');
    return response.data;
  },

  /**
   * Admin: Block a user by ID with a reason
   */
  blockUser: async (userId: number, reason: string): Promise<{ success: boolean; message: string; user: User }> => {
    const response = await http.post(`/users/admin/id/${userId}/block`, { reason });
    return response.data;
  },

  /**
   * Admin: Unblock a user by ID
   */
  unblockUser: async (userId: number): Promise<{ success: boolean; message: string; user: User }> => {
    const response = await http.delete(`/users/admin/id/${userId}/block`);
    return response.data;
  },

  /**
   * Admin: Send a payment reminder to a user with unpaid requests
   */
  sendPaymentReminder: async (userId: number): Promise<{ success: boolean; message: string }> => {
    const response = await http.post(`/users/admin/id/${userId}/payment-reminder`);
    return response.data;
  },

  /**
   * Admin: Get user information by ID
   */
  getUserById: async (userId: number): Promise<User> => {
    const response = await http.get(`/users/admin/id/${userId}`);
    return response.data;
  },
};

const gamesApi = {
  getDefaultGameSettings: async (): Promise<{ 
    date: Date; 
    locationName?: string | null; 
    locationLink?: string | null;
    paymentAmount?: number | null; // cents
    pricingMode?: PricingMode | null;
    gameFormat?: import('../types').GameFormat | null;
  }> => {
    const response = await http.get('/games/admin/defaults');
    return {
      date: new Date(response.data.defaultDateTime),
      locationName: response.data.defaultLocationName ?? null,
      locationLink: response.data.defaultLocationLink ?? null,
      paymentAmount: response.data.defaultPaymentAmount ?? null,
      pricingMode: (response.data.defaultPricingMode as PricingMode | undefined) ?? null,
      gameFormat: response.data.defaultGameFormat ?? null,
    };
  },

  getAllGames(showPast: boolean = false, showAll: boolean = false, categories?: string[]): Promise<GameWithStats[]> {
    const params: { showPast: boolean; showAll: boolean; categories?: string[] } = { 
      showPast,
      showAll
    };
    if (categories && categories.length > 0) {
      params.categories = categories;
    }
    return http.get<GameWithStats[]>('/games', { params }).then(res => res.data);
  },

  getGame: async (gameId: number): Promise<Game> => {
    const response = await http.get(`/games/${gameId}`);
    return response.data;
  },

  createGame(gameData: {
    dateTime: string;
    maxPlayers: number;
    unregisterDeadlineHours: number;
    paymentAmount: number;
    pricingMode?: PricingMode;
    gameFormat: import('../types').GameFormat;
    readonly?: boolean;
    locationName?: string | null;
    locationLink?: string | null;
    title?: string | null;
  }): Promise<{ id: number }> {
    // Admin create returns the raw DB row (no detail policy fields).
    return http.post('/games/admin', gameData).then(res => res.data);
  },

  registerForGame: async (gameId: number, guestName?: string, bringingTheBall?: boolean): Promise<void> => {
    const payload: any = {};
    if (guestName) {
      payload.guestName = guestName;
    }
    if (bringingTheBall !== undefined) {
      payload.bringingTheBall = bringingTheBall;
    }
    await http.post(`/games/${gameId}/register`, payload);
  },

  /**
   * Register a guest for a game
   */
  registerGuestForGame: async (gameId: number, guestName: string): Promise<void> => {
    await http.post(`/games/${gameId}/register`, { guestName });
  },

  /**
   * Get the last used guest name for a user (excluding current game)
   */
  getLastGuestName: async (gameId: number): Promise<{ lastGuestName: string | null }> => {
    const response = await http.get(`/games/${gameId}/last-guest-name`);
    return response.data;
  },

  unregisterFromGame: async (gameId: number, guestName?: string): Promise<void> => {
    if (guestName && guestName.trim()) {
      await http.delete(`/games/${gameId}/register`, { data: { guestName } });
    } else {
      await http.delete(`/games/${gameId}/register`);
    }
  },

  deleteGame: async (gameId: number): Promise<void> => {
    await http.delete(`/games/admin/${gameId}`);
  },

  updateGame(gameId: number, gameData: {
    dateTime: string;
    maxPlayers: number;
    unregisterDeadlineHours: number;
    paymentAmount: number;
    pricingMode?: PricingMode;
    gameFormat: import('../types').GameFormat;
    readonly?: boolean;
    locationName?: string | null;
    locationLink?: string | null;
    title?: string | null;
  }): Promise<{ id: number }> {
    // Admin update returns the raw DB row (no detail policy fields).
    return http.put(`/games/admin/${gameId}`, gameData).then(res => res.data);
  },

  /**
   * Create payment requests for all unpaid players in a game
   */
  createPaymentRequests: async (gameId: number, password: string): Promise<{ message: string; requestsCreated: number; errors: string[] }> => {
    const response = await http.post(`/games/admin/${gameId}/payment-requests`, { password });
    return response.data;
  },

  /**
   * Update a player's paid status for a game
   * @param gameId The game ID
   * @param userId The user ID
   * @param paid Whether the player has paid (true) or not (false)
   */
  updatePlayerPaidStatus(gameId: number, userId: number, paid: boolean = true): Promise<{ message: string }> {
    return http
      .put(`/games/admin/${gameId}/players/${userId}/paid`, { paid })
      .then((res) => res.data);
  },

  /**
   * Add a participant to a game (admin only)
   * Optionally specify guestName to add a guest under the given user
   */
  addParticipant: async (
    gameId: number,
    userId: number,
    guestName?: string
  ): Promise<{ message: string }> => {
    const payload = guestName && guestName.trim()
      ? { userId, guestName }
      : { userId };
    const response = await http.post(`/games/admin/${gameId}/participants`, payload);
    return response.data;
  },

  /**
   * Remove a participant from a game (admin only)
   * If guestName is provided, only that guest registration will be removed.
   * Otherwise, removes the user's own registration (guestName null).
   */
  removeParticipant: async (gameId: number, userId: number, guestName?: string): Promise<{ message: string }> => {
    const config = guestName && guestName.trim()
      ? { data: { guestName } }
      : undefined;
    const response = await http.delete(`/games/admin/${gameId}/participants/${userId}`, config);
    return response.data;
  },

  /**
   * Search users by query (for admin participant management)
   */
  searchUsers: async (query: string): Promise<UserPublicInfo[]> => {
    const logData = (data: unknown) => logDebug(JSON.stringify(data, null, 2));
    
    logData(`Searching users with query: "${query}"`);
    try {
      const response = await http.get('/users/admin/search', { 
        params: { q: query },
        paramsSerializer: (params: Record<string, string>) => {
          const serialized = new URLSearchParams(params).toString();
          logData(`Serialized search params: ${serialized}`);
          return serialized;
        }
      });
      logData(`Search results for "${query}": ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logData(`Search API error: ${errorMessage}`);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          logData(`Error response: ${JSON.stringify({
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers
          }, null, 2)}`);
        } else if (error.request) {
          logData(`No response received: ${JSON.stringify(error.request, null, 2)}`);
        }
      }
      
      throw error;
    }
  },
  
  /**
   * Check payment status of unpaid games and update the database
   * @param password The Bunq API password
   * @param gameId Optional specific game ID to check (if not provided, checks all unpaid games)
   */
  checkPayments(password: string, gameId?: number): Promise<{ message: string; updatedGames: number; updatedPlayers: number }> {
    return http
      .post('/games/admin/check-payments', { password, gameId })
      .then((res) => res.data);
  },
};

// Player levels (global admin or TC)
const playerLevelsApi = {
  listUsers: async (): Promise<UserWithPlayerLevel[]> => {
    const response = await http.get('/player-levels/users');
    return response.data;
  },

  getUser: async (userId: number): Promise<UserWithPlayerLevel> => {
    const response = await http.get(`/player-levels/users/${userId}`);
    return response.data;
  },

  updateUserLevel: async (userId: number, playerLevel: PlayerLevel): Promise<UserWithPlayerLevel> => {
    const response = await http.patch(`/player-levels/users/${userId}`, { playerLevel });
    return response.data;
  },
};

// Game administrators API endpoints
const gameAdministratorsApi = {
  /**
   * Get all game administrator assignments
   */
  getAll: async (): Promise<GameAdministrator[]> => {
    const response = await http.get('/game-administrators');
    return response.data;
  },

  /**
   * Create a new game administrator assignment
   */
  create: async (data: { dayOfWeek: number; withPositions: boolean; userId: number }): Promise<GameAdministrator> => {
    const response = await http.post('/game-administrators', data);
    return response.data;
  },

  /**
   * Get current user's administrator assignments
   */
  getMyAssignments: async (): Promise<GameAdministrator[]> => {
    const response = await http.get('/game-administrators/me');
    return response.data;
  },

  /**
   * Delete a game administrator assignment
   */
  delete: async (id: number): Promise<void> => {
    await http.delete(`/game-administrators/${id}`);
  },
};

// Priority players API endpoints
const priorityPlayersApi = {
  /**
   * Get all priority players (optionally filtered by gameAdministratorId)
   */
  getAll: async (gameAdministratorId?: number): Promise<PriorityPlayer[]> => {
    const params = gameAdministratorId ? { gameAdministratorId } : {};
    const response = await http.get('/priority-players', { params });
    return response.data;
  },

  /**
   * Create a new priority player assignment
   */
  create: async (data: { gameAdministratorId: number; userId: number }): Promise<PriorityPlayer> => {
    const response = await http.post('/priority-players', data);
    return response.data;
  },

  /**
   * Delete a priority player assignment
   */
  delete: async (id: number): Promise<void> => {
    await http.delete(`/priority-players/${id}`);
  },
};

// Bunq-related API endpoints
const bunqApi = {
  /**
   * Check if Bunq integration is enabled for the current user or assigned user
   * @param assignedUserId Optional user ID to check (admin only)
   */
  getStatus: async (assignedUserId?: number): Promise<{ enabled: boolean }> => {
    const url = assignedUserId 
      ? `/users/admin/id/${assignedUserId}/bunq/status`
      : '/users/me/bunq/status';
    const response = await http.get(url);
    return response.data;
  },

  /**
   * Enable Bunq integration with API key and password
   * @param apiKey Bunq API key
   * @param password Bunq password
   * @param assignedUserId Optional user ID to enable for (admin only)
   * @param apiKeyName Optional API key name (used as User-Agent in Bunq API requests)
   */
  enable: async (apiKey: string, password: string, assignedUserId?: number, apiKeyName?: string): Promise<{ success: boolean; message: string }> => {
    const url = assignedUserId 
      ? `/users/admin/id/${assignedUserId}/bunq/enable`
      : '/users/me/bunq/enable';
    const response = await http.post(url, { apiKey, password, apiKeyName });
    return response.data;
  },

  /**
   * Disable Bunq integration
   * @param assignedUserId Optional user ID to disable for (admin only)
   */
  disable: async (assignedUserId?: number): Promise<{ success: boolean; message: string }> => {
    const url = assignedUserId 
      ? `/users/admin/id/${assignedUserId}/bunq/disable`
      : '/users/me/bunq/disable';
    const response = await http.delete(url);
    return response.data;
  },

  /**
   * Get available monetary accounts for Bunq integration
   * @param password Bunq password
   * @param assignedUserId Optional user ID to get accounts for (admin only)
   */
  getMonetaryAccounts: async (password: string, assignedUserId?: number): Promise<{ success: boolean; accounts: Array<{ id: number; description: string }> }> => {
    const url = assignedUserId 
      ? `/users/admin/id/${assignedUserId}/bunq/monetary-accounts`
      : '/users/me/bunq/monetary-accounts';
    const response = await http.post(url, { password });
    return response.data;
  },

  /**
   * Update the selected monetary account ID
   * @param monetaryAccountId The monetary account ID to select
   * @param assignedUserId Optional user ID to update for (admin only)
   */
  updateMonetaryAccount: async (monetaryAccountId: number, assignedUserId?: number): Promise<{ success: boolean; message: string }> => {
    const url = assignedUserId 
      ? `/users/admin/id/${assignedUserId}/bunq/monetary-account`
      : '/users/me/bunq/monetary-account';
    const response = await http.put(url, { monetaryAccountId });
    return response.data;
  },

  /**
   * Manually install webhook filters for Bunq
   * @param password Bunq password
   * @param assignedUserId Optional user ID to install webhook for (admin only)
   */
  installWebhook: async (password: string, assignedUserId?: number): Promise<{ success: boolean; message: string }> => {
    const url = assignedUserId 
      ? `/users/admin/id/${assignedUserId}/bunq/webhook/install`
      : '/users/me/bunq/webhook/install';
    const response = await http.post(url, { password });
    return response.data;
  },
};

// Phone authentication API endpoints
const authApi = {
  /**
   * Start phone authentication by sending an SMS code
   */
  startPhoneAuth: async (phoneNumber: string): Promise<{ success: boolean; sessionId: string }> => {
    const response = await http.post('/auth/start', { phoneNumber });
    return response.data;
  },

  /**
   * Verify the received SMS code
   */
  verifyPhoneAuth: async (
    sessionId: string,
    code: string
  ): Promise<{ success: boolean; userExists?: boolean; creatingNewUser?: boolean }> => {
    const response = await http.post('/auth/verify', { sessionId, code });
    return response.data;
  },

  /**
   * Create a new user for a verified session in user-creation mode
   */
  createUser: async (
    sessionId: string,
    displayName: string
  ): Promise<{ success: boolean; userCreated: boolean; userId: number }> => {
    const response = await http.post('/auth/create-user', { sessionId, displayName });
    return response.data;
  },

  /**
   * Optional helper: check if a display name is available during user creation
   */
  checkDisplayName: async (
    sessionId: string,
    displayName: string
  ): Promise<{ available: boolean }> => {
    const response = await http.post('/auth/check-display-name', { sessionId, displayName });
    return response.data;
  },

  /**
   * Dev mode login: authenticate with phone number and display name (no SMS verification)
   * Only available when server is running in dev mode
   */
  devLogin: async (
    phoneNumber: string,
    displayName: string,
    isAdmin?: boolean,
    isTc?: boolean
  ): Promise<{ success: boolean; user: User }> => {
    const response = await http.post('/auth/dev-login', { phoneNumber, displayName, isAdmin, isTc }, {
      withCredentials: true,
    });
    return response.data;
  },

  /**
   * Logout current browser session (clears JWT cookie)
   */
  logout: async (): Promise<{ success: boolean }> => {
    const response = await http.post('/auth/logout');
    return response.data;
  },
};


  return {
    getBuildInfo,
    userApi,
    gamesApi,
    playerLevelsApi,
    gameAdministratorsApi,
    priorityPlayersApi,
    bunqApi,
    authApi,
  };
}

const defaultTransport = createAxiosTransport();
const defaultClients = createApiClients(defaultTransport);

export const getBuildInfo = defaultClients.getBuildInfo;
export const userApi = defaultClients.userApi;
export const gamesApi = defaultClients.gamesApi;
export const playerLevelsApi = defaultClients.playerLevelsApi;
export const gameAdministratorsApi = defaultClients.gameAdministratorsApi;
export const priorityPlayersApi = defaultClients.priorityPlayersApi;
export const bunqApi = defaultClients.bunqApi;
export const authApi = defaultClients.authApi;

/** Underlying default axios transport (same shape as HttpTransport). */
export default defaultTransport;

// Types
export interface UnpaidRegistration {
  gameId: number;
  dateTime: string; // ISO string from backend
  locationName: string | null;
  totalAmountCents: number | null;
  paymentLink: string | null;
}

export interface GameAdministrator {
  id: number;
  dayOfWeek: number; // 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
  withPositions: boolean; // true for 5-1 games, false for regular games
  userId: number;
  createdAt: string; // ISO string from backend
  user: UserPublicInfo;
}

export interface PriorityPlayer {
  id: number;
  gameAdministratorId: number;
  userId: number;
  createdAt: string; // ISO string from backend
  user: UserPublicInfo;
}
