import { isTelegramApp } from './telegram';
import { dialogService, type ShowPopupArgs } from '../services/dialogService';

export type { ShowPopupArgs };

/** Host-facing prompt port for class view models (Telegram native vs in-app dialog). */
export type UiPrompts = {
  showPopup: (args: ShowPopupArgs, cb?: (id?: string) => void) => void;
  showConfirm: (message: string, cb: (confirmed: boolean) => void) => void;
};

export const showPopup = (args: ShowPopupArgs, cb?: (id?: string) => void) => {
  const wa = (window as any)?.Telegram?.WebApp;
  const buttons = args.buttons || [{ type: 'ok' }];
  const hasCustomButtonText = args.buttons?.some((b) => b.text);
  if (isTelegramApp() && wa?.showPopup && !hasCustomButtonText) {
    return wa.showPopup({ title: args.title, message: args.message, buttons }, cb);
  }
  dialogService.showPopup(args, cb);
};

export const showConfirm = (message: string, cb: (confirmed: boolean) => void) => {
  const wa = (window as any)?.Telegram?.WebApp;
  if (isTelegramApp() && wa?.showConfirm) return wa.showConfirm(message, cb);
  // Fallback: React-based modal via service
  dialogService.showConfirm(message, cb);
};

/** Default adapter: Telegram WebApp dialogs when available, otherwise DialogProvider-backed service. */
export const uiPrompts: UiPrompts = { showPopup, showConfirm };
