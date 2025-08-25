export enum PricingMode {
  PER_PARTICIPANT = 'per_participant',
  TOTAL_COST = 'total_cost'
}

// Minimal user info used across UI for player dialogs and click handlers
export interface UserPublicInfo {
  id: number;
  displayName: string;
  telegramUsername?: string | null;
  telegramId: string;
  avatarUrl?: string | null;
  blockReason?: string | null;
}

export interface User {
  id: number;
  telegramId: string;
  displayName: string;
  telegramUsername?: string | null;
  isAdmin: boolean;
  createdAt: Date | null;
  blockReason?: string | null;
}

export interface Game {
  id: number;
  dateTime: string;
  maxPlayers: number;
  unregisterDeadlineHours: number;
  paymentAmount: number;
  pricingMode: PricingMode;
  fullyPaid: boolean;
  withPositions: boolean;
  locationName?: string | null;
  locationLink?: string | null;
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
  guestName?: string | null;
  user?: UserPublicInfo;
}

export interface GameWithStats extends Game {
  // Fields from optimized API
  totalRegisteredCount: number;
  paidCount?: number;         // For past games
  registeredCount?: number;   // For upcoming games within X days
  
  // User registration status (for upcoming games within X days)
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
            photo_url?: string;
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
