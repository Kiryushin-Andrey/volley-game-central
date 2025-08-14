type PopupButton = { type: 'ok' | 'cancel' | 'destructive'; id?: string; text?: string };

export const showPopup = (args: { title: string; message: string; buttons?: PopupButton[] }, cb?: (id?: string) => void) => {
  const wa = (window as any)?.Telegram?.WebApp;
  const buttons = args.buttons || [{ type: 'ok' }];
  if (wa?.showPopup) {
    return wa.showPopup({ title: args.title, message: args.message, buttons }, cb);
  }
  // Fallback
  alert(`${args.title}\n${args.message}`);
  if (cb) cb(buttons[0]?.id);
};

export const showConfirm = (message: string, cb: (confirmed: boolean) => void) => {
  const wa = (window as any)?.Telegram?.WebApp;
  if (wa?.showConfirm) return wa.showConfirm(message, cb);
  cb(window.confirm(message));
};


