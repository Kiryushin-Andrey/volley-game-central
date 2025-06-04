export interface User {
  id: number;
  telegramId: string;
  username: string;
  isAdmin: boolean;
  createdAt: Date | null;
}

export interface Game {
  id: number;
  dateTime: string;
  maxPlayers: number;
  createdAt: Date | null;
  createdById: number;
  registrations: GameRegistration[];
}

export interface GameRegistration {
  id: number;
  gameId: number;
  userId: number;
  paid: boolean;
  isWaitlist: boolean;
  createdAt: Date | null;
}

export interface GameWithStats extends Game {
  activePlayersCount: number;
  waitlistCount: number;
  isUserRegistered: boolean;
  userRegistration?: GameRegistration;
}

// Telegram WebApp types
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        themeParams: {
          bg_color: string;
          text_color: string;
          hint_color: string;
          link_color: string;
          button_color: string;
          button_text_color: string;
        };
      };
    };
  }
}
