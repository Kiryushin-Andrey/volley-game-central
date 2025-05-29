
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Participant {
  id: string;
  telegramUsername: string;
  displayName: string;
  createdAt: string;
}

export interface Game {
  id: string;
  date: string;
  maxParticipants: number;
  participants: string[]; // participant IDs
  waitingList: string[]; // participant IDs
  createdAt: string;
  createdBy: string;
}

interface GameStore {
  games: Game[];
  participants: Participant[];
  addGame: (game: Game) => void;
  addParticipant: (participant: Participant) => void;
  updateParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  addParticipantToGame: (gameId: string, participantId: string) => void;
  removeParticipantFromGame: (gameId: string, participantId: string, fromWaiting?: boolean) => void;
  moveParticipantToWaiting: (gameId: string, participantId: string) => void;
  moveParticipantToActive: (gameId: string, participantId: string) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      games: [],
      participants: [],

      addGame: (game) => set((state) => ({ 
        games: [...state.games, game] 
      })),

      addParticipant: (participant) => set((state) => ({
        participants: [...state.participants, participant]
      })),

      updateParticipant: (updatedParticipant) => set((state) => ({
        participants: state.participants.map(participant =>
          participant.id === updatedParticipant.id ? updatedParticipant : participant
        )
      })),

      removeParticipant: (participantId) => set((state) => ({
        participants: state.participants.filter(participant => participant.id !== participantId),
        games: state.games.map(game => ({
          ...game,
          participants: game.participants.filter(id => id !== participantId),
          waitingList: game.waitingList.filter(id => id !== participantId)
        }))
      })),

      addParticipantToGame: (gameId, participantId) => set((state) => ({
        games: state.games.map(game => {
          if (game.id === gameId) {
            // If game is not full, add to participants, otherwise add to waiting list
            if (game.participants.length < game.maxParticipants) {
              return {
                ...game,
                participants: [...game.participants, participantId]
              };
            } else {
              return {
                ...game,
                waitingList: [...game.waitingList, participantId]
              };
            }
          }
          return game;
        })
      })),

      removeParticipantFromGame: (gameId, participantId, fromWaiting = false) => set((state) => ({
        games: state.games.map(game => {
          if (game.id === gameId) {
            if (fromWaiting) {
              return {
                ...game,
                waitingList: game.waitingList.filter(id => id !== participantId)
              };
            } else {
              const updatedGame = {
                ...game,
                participants: game.participants.filter(id => id !== participantId)
              };
              
              // If there's space and someone is waiting, move them up
              if (updatedGame.participants.length < game.maxParticipants && game.waitingList.length > 0) {
                const nextParticipant = game.waitingList[0];
                updatedGame.participants.push(nextParticipant);
                updatedGame.waitingList = game.waitingList.slice(1);
              }
              
              return updatedGame;
            }
          }
          return game;
        })
      })),

      moveParticipantToWaiting: (gameId, participantId) => set((state) => ({
        games: state.games.map(game => {
          if (game.id === gameId) {
            return {
              ...game,
              participants: game.participants.filter(id => id !== participantId),
              waitingList: [...game.waitingList, participantId]
            };
          }
          return game;
        })
      })),

      moveParticipantToActive: (gameId, participantId) => set((state) => ({
        games: state.games.map(game => {
          if (game.id === gameId && game.participants.length < game.maxParticipants) {
            return {
              ...game,
              participants: [...game.participants, participantId],
              waitingList: game.waitingList.filter(id => id !== participantId)
            };
          }
          return game;
        })
      })),
    }),
    {
      name: 'volleyball-game-store',
    }
  )
);
