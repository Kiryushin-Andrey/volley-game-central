import axios from 'axios';
import { Game, User, GameWithStats } from '../types';
import { logDebug } from '../debug';

// Use /api prefix for proxy, fallback to environment variable for production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

logDebug(`API_BASE_URL: ${API_BASE_URL}`); // Debug log

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Telegram WebApp init data to requests
api.interceptors.request.use((config) => {
  logDebug(`Making API request to: ${(config.baseURL || '') + (config.url || '')}`); // Debug log

  // Get Telegram WebApp init data
  const telegramInitData = window.Telegram?.WebApp?.initData;
  
  if (telegramInitData) {
    logDebug('Adding Telegram WebApp initData to request headers');
    config.headers.Authorization = `TelegramWebApp ${telegramInitData}`;
  } else {
    logDebug('No Telegram WebApp initData available');
  }
  
  return config;
});

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    logDebug(`API response success: ${response.status} ${JSON.stringify(response.data)}`); // Debug log
    return response;
  },
  (error) => {
    logDebug(`API response error: ${error.response?.status} ${JSON.stringify(error.response?.data)} ${error.message}`); // Debug log
    console.error('API response error:', error.response?.status, error.response?.data, error.message); // Debug log
    return Promise.reject(error);
  }
);

// User-related API endpoints
export const userApi = {
  /**
   * Get current authenticated user details
   * Authentication happens automatically via request interceptor above
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/users/me');
    return response.data;
  },
  
  /**
   * Update user profile
   */
  updateProfile: async (userData: Partial<User>): Promise<User> => {
    const response = await api.put('/users/me', userData);
    return response.data;
  },
};

export const gamesApi = {
  getDefaultDateTime: async (): Promise<Date> => {
    const response = await api.get('/games/default-datetime');
    return new Date(response.data.defaultDateTime);
  },

  getAllGames(showPast: boolean = false, showAll: boolean = false): Promise<GameWithStats[]> {
    return api.get<GameWithStats[]>('/games', { 
      params: { 
        showPast,
        showAll
      } 
    }).then(res => res.data);
  },

  getGame: async (gameId: number): Promise<Game> => {
    const response = await api.get(`/games/${gameId}`);
    return response.data;
  },

  createGame: async (gameData: { dateTime: string; maxPlayers: number; unregisterDeadlineHours: number; paymentAmount: number }): Promise<Game> => {
    const response = await api.post('/games', gameData);
    return response.data;
  },

  registerForGame: async (gameId: number): Promise<void> => {
    await api.post(`/games/${gameId}/register`);
  },

  unregisterFromGame: async (gameId: number): Promise<void> => {
    await api.delete(`/games/${gameId}/register`);
  },

  deleteGame: async (gameId: number): Promise<void> => {
    await api.delete(`/games/${gameId}`);
  },

  updateGame: async (gameId: number, gameData: { dateTime: string; maxPlayers: number; unregisterDeadlineHours: number; paymentAmount: number }): Promise<Game> => {
    const response = await api.put(`/games/${gameId}`, gameData);
    return response.data;
  },

  /**
   * Create payment requests for all unpaid players in a game
   */
  createPaymentRequests: async (gameId: number, password: string): Promise<{ message: string; requestsCreated: number; errors: string[] }> => {
    const response = await api.post(`/games/${gameId}/payment-requests`, { password });
    return response.data;
  },

  /**
   * Update a player's paid status for a game
   * @param gameId The game ID
   * @param userId The user ID
   * @param paid Whether the player has paid (true) or not (false)
   */
  updatePlayerPaidStatus(gameId: number, userId: number, paid: boolean = true): Promise<{ message: string }> {
    return api
      .put(`/games/${gameId}/players/${userId}/paid`, { paid })
      .then((res) => res.data);
  },

  /**
   * Add a participant to a game (admin only)
   */
  addParticipant: async (gameId: number, userId: number): Promise<{ message: string }> => {
    const response = await api.post(`/games/${gameId}/participants`, { userId });
    return response.data;
  },

  /**
   * Remove a participant from a game (admin only)
   */
  removeParticipant: async (gameId: number, userId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/games/${gameId}/participants/${userId}`);
    return response.data;
  },

  /**
   * Search users by query (for admin participant management)
   */
  searchUsers: async (query: string): Promise<Array<{ id: number; username: string; telegramId: string | null; avatarUrl?: string | null }>> => {
    const logData = (data: unknown) => logDebug(JSON.stringify(data, null, 2));
    
    logData(`Searching users with query: "${query}"`);
    try {
      const response = await api.get('/users/search', { 
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
   * Check payment status of all unpaid games and update the database
   * @param password The Bunq API password
   */
  checkPayments(password: string): Promise<{ message: string; updatedGames: number; updatedPlayers: number }> {
    return api
      .post('/games/check-payments', { password })
      .then((res) => res.data);
  },
};

// Bunq-related API endpoints
export const bunqApi = {
  /**
   * Check if Bunq integration is enabled for the current user
   */
  getStatus: async (): Promise<{ enabled: boolean }> => {
    const response = await api.get('/users/me/bunq/status');
    return response.data;
  },

  /**
   * Enable Bunq integration with API key and password
   */
  enable: async (apiKey: string, password: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/users/me/bunq/enable', { apiKey, password });
    return response.data;
  },

  /**
   * Disable Bunq integration
   */
  disable: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete('/users/me/bunq/disable');
    return response.data;
  },

  /**
   * Get available monetary accounts for Bunq integration
   */
  getMonetaryAccounts: async (password: string): Promise<{ success: boolean; accounts: Array<{ id: number; description: string }> }> => {
    const response = await api.post('/users/me/bunq/monetary-accounts', { password });
    return response.data;
  },

  /**
   * Update the selected monetary account ID
   */
  updateMonetaryAccount: async (monetaryAccountId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.put('/users/me/bunq/monetary-account', { monetaryAccountId });
    return response.data;
  },
};

export default api;
