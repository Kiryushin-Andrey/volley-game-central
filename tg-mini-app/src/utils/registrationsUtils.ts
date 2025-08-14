import { Game, GameRegistration } from '../types';

export const getActiveRegistrations = (game: Game): GameRegistration[] => {
  return game.registrations.filter(reg => !reg.isWaitlist);
};

export const getWaitlistRegistrations = (game: Game): GameRegistration[] => {
  return game.registrations.filter(reg => reg.isWaitlist);
};

export const getUserRegistration = (game: Game, userId: number): GameRegistration | undefined => {
  return game.registrations.find(reg => reg.userId === userId);
};

export const hasAnyPaid = (game: Game): boolean => {
  return game.registrations.some(reg => reg.paid);
};


