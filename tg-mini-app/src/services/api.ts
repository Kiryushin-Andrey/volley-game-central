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

  getAllGames: async (includeInactiveGames: boolean = false): Promise<GameWithStats[]> => {
    const response = await api.get(`/games?includeInactiveGames=${includeInactiveGames}`);
    return response.data;
  },

  getGame: async (gameId: number): Promise<Game> => {
    const response = await api.get(`/games/${gameId}`);
    return response.data;
  },

  createGame: async (gameData: { dateTime: string; maxPlayers: number }): Promise<Game> => {
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

  updateGame: async (gameId: number, gameData: { dateTime: string; maxPlayers: number }): Promise<Game> => {
    const response = await api.put(`/games/${gameId}`, gameData);
    return response.data;
  },
};

export default api;
