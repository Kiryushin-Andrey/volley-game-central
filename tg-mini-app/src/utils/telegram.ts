export const isTelegramApp = (): boolean => {
  return Boolean(window.Telegram?.WebApp?.initDataUnsafe?.user);
};
