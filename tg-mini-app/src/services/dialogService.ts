export type PopupButton = { type: 'ok' | 'cancel' | 'destructive'; id?: string; text?: string };

// Imperative service wired by DialogProvider at runtime
let _showPopup: ((args: { title: string; message: string; buttons?: PopupButton[] }, cb?: (id?: string) => void) => void) | null = null;
let _showConfirm: ((message: string, cb: (confirmed: boolean) => void) => void) | null = null;

export const dialogService = {
  bind(showPopup: typeof _showPopup, showConfirm: typeof _showConfirm) {
    _showPopup = showPopup;
    _showConfirm = showConfirm;
  },
  unbind() {
    _showPopup = null;
    _showConfirm = null;
  },
  showPopup(args: { title: string; message: string; buttons?: PopupButton[] }, cb?: (id?: string) => void) {
    if (_showPopup) return _showPopup(args, cb);
    // No provider mounted; no-op fallback
    alert(`${args.title}\n${args.message}`);
    cb?.(args.buttons?.[0]?.id ?? args.buttons?.[0]?.type);
  },
  showConfirm(message: string, cb: (confirmed: boolean) => void) {
    if (_showConfirm) return _showConfirm(message, cb);
    // No provider mounted; browser fallback
    cb(window.confirm(message));
  },
};
