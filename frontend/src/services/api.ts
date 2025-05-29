import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

export interface Registration {
  id: number;
  gameId: number;
  userId: number;
  isWaitlist: boolean;
  user: User;
}

export interface Game {
  id: number;
  dateTime: string;
  maxPlayers: number;
  createdById: number;
  registrations: Registration[];
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
    const response = await api.get(`/users/telegram/${telegramId}`);
    return response.data;
  },

  getAll: async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data;
  },

  getById: async (userId: number): Promise<User> => {
    const response = await api.get(`/users/id/${userId}`);
    return response.data;
  },

  update: async (userId: number, data: { telegramId: string; username: string }): Promise<User> => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },

  remove: async (userId: number): Promise<void> => {
    await api.delete(`/users/${userId}`);
  },
};

export const gameApi = {
  create: async (dateTime: string, maxPlayers: number, createdById: number): Promise<Game> => {
    const response = await api.post('/games', { dateTime, maxPlayers, createdById });
    return response.data;
  },

  getAll: async (): Promise<Game[]> => {
    const response = await api.get('/games');
    return response.data;
  },

  getById: async (gameId: number): Promise<Game> => {
    const response = await api.get(`/games/${gameId}`);
    return response.data;
  },

  update: async (gameId: number, data: Partial<Game>): Promise<Game> => {
    const response = await api.put(`/games/${gameId}`, data);
    return response.data;
  },

  remove: async (gameId: number): Promise<void> => {
    await api.delete(`/games/${gameId}`);
  },

  register: async (gameId: number, userId: number): Promise<void> => {
    await api.post(`/games/${gameId}/register/${userId}`);
  },

  unregister: async (gameId: number, userId: number): Promise<void> => {
    await api.delete(`/games/${gameId}/register/${userId}`);
  },

  moveToWaitlist: async (gameId: number, userId: number): Promise<void> => {
    await api.put(`/games/${gameId}/register/${userId}/waitlist`);
  },

  moveToActive: async (gameId: number, userId: number): Promise<void> => {
    await api.put(`/games/${gameId}/register/${userId}/active`);
  },

  updateRegistrationStatus: async (gameId: number, userId: number, isWaitlist: boolean): Promise<GameRegistration> => {
    const response = await api.patch(`/games/${gameId}/register/${userId}`, { isWaitlist });
    return response.data;
  },
};
