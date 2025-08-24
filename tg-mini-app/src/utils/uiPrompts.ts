import { isTelegramApp } from './telegram';
import { dialogService, type PopupButton } from '../services/dialogService';

export const showPopup = (args: { title: string; message: string; buttons?: PopupButton[] }, cb?: (id?: string) => void) => {
  const wa = (window as any)?.Telegram?.WebApp;
  const buttons = args.buttons || [{ type: 'ok' }];
  if (isTelegramApp() && wa?.showPopup) {
    return wa.showPopup({ title: args.title, message: args.message, buttons }, cb);
  }
  // Fallback: React-based modal via service
  dialogService.showPopup({ title: args.title, message: args.message, buttons }, cb);
};

export const showConfirm = (message: string, cb: (confirmed: boolean) => void) => {
  const wa = (window as any)?.Telegram?.WebApp;
  if (isTelegramApp() && wa?.showConfirm) return wa.showConfirm(message, cb);
  // Fallback: React-based modal via service
  dialogService.showConfirm(message, cb);
};
