import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface User {
  id: number;
  telegramId: string;
  username: string;
  createdAt: string;
}

export interface Game {
  id: number;
  dateTime: string;
  maxPlayers: number;
  createdById: number;
  createdAt: string;
}

export interface GameRegistration {
  id: number;
  gameId: number;
  userId: number;
  paid: boolean;
  isWaitlist: boolean;
  createdAt: string;
}

export const userApi = {
  create: async (telegramId: string, username: string): Promise<User> => {
    const response = await api.post('/users', { telegramId, username });
    return response.data;
  },
  getByTelegramId: async (telegramId: string): Promise<User> => {
    const response = await api.get(`/users/${telegramId}`);
    return response.data;
  },
};

export const gameApi = {
  create: async (dateTime: string, maxPlayers: number, createdById: number): Promise<Game> => {
    const response = await api.post('/games', { dateTime, maxPlayers, createdById });
    return response.data;
  },
  getById: async (gameId: number): Promise<Game & { registrations: GameRegistration[] }> => {
    const response = await api.get(`/games/${gameId}`);
    return response.data;
  },
  register: async (gameId: number, userId: number): Promise<GameRegistration> => {
    const response = await api.post(`/games/${gameId}/register`, { userId });
    return response.data;
  },
  unregister: async (gameId: number, userId: number): Promise<void> => {
    await api.delete(`/games/${gameId}/register/${userId}`);
  },
};
