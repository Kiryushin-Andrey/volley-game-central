import { Game, GameRegistration } from '../types';

export const getActiveRegistrations = (game: Game): GameRegistration[] => {
  return game.registrations.filter(reg => !reg.isWaitlist);
};

export const getWaitlistRegistrations = (game: Game): GameRegistration[] => {
  return game.registrations.filter(reg => reg.isWaitlist);
};

export const getUserRegistration = (game: Game, userId: number): GameRegistration | undefined => {
  // Only consider the user's own registration (exclude their guests)
  return game.registrations.find(reg => reg.userId === userId && (reg.guestName === null || reg.guestName === undefined));
};

export const hasAnyPaid = (game: Game): boolean => {
  return game.registrations.some(reg => reg.paid);
};


