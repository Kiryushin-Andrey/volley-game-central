import { useState, useEffect } from 'react';
import { User } from '../types';
import { userApi } from '../services/api';
import { logDebug, isDebugMode } from '../debug';

export const useTelegramWebApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webApp, setWebApp] = useState<any>(null);
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(false);

  useEffect(() => {
    logDebug('Initializing Telegram WebApp hook...');
    const tg = window.Telegram?.WebApp;
    
    // Check if this is a legitimate Telegram WebApp session
    const isTgApp = Boolean(tg);
    setIsTelegramWebApp(isTgApp);
    logDebug('Is Telegram WebApp available: ' + isTgApp);
    
    if (isTgApp) {
      tg.ready();
      tg.expand();
      setWebApp(tg);
      logDebug('Telegram WebApp initialized');

      // Apply Telegram theme
      document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
      document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
      document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
      document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#2481cc');
      document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');
      document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');

      // Check if we have init data
      logDebug('Telegram user data available: ' + Boolean(tg.initDataUnsafe?.user));
      logDebug('InitData string: ' + tg.initData);
      logDebug('InitDataUnsafe object:');
      logDebug(tg.initDataUnsafe || 'null');
      
      // Only proceed with authenticated Telegram users
      if (tg.initDataUnsafe?.user) {
        authenticateUser(tg.initDataUnsafe.user);
      } else {
        logDebug('No Telegram user data available');
        setIsLoading(false);
      }
    } else {
      logDebug('Not running in Telegram WebApp environment');
      setIsLoading(false);
    }
  }, []);

  const authenticateUser = async (telegramUser: any) => {
    try {
      logDebug('Authenticating Telegram user:');
      logDebug(telegramUser);

      // Get the full initData from Telegram WebApp - this is the secure way to authenticate
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        throw new Error('Telegram WebApp is not available');
      }
      
      const initData = tg.initData;
      if (!initData || initData === '') {
        logDebug('No initData available from Telegram WebApp');
        if (isDebugMode()) {
          logDebug('WARNING: Debug mode is enabled. Would skip authentication in production!');
        } else {
          throw new Error('No authentication data available from Telegram');
        }
      }
      
      logDebug('Telegram WebApp initData will be sent with API requests:');
      logDebug(initData);
      
      // With our new approach, the authentication happens via middleware
      // Just fetch the current user which will use the initData header
      const authenticatedUser = await userApi.getCurrentUser();
      
      setUser(authenticatedUser);
      logDebug('Authentication successful:');
      logDebug(authenticatedUser);
    } catch (error: any) {
      logDebug('Authentication failed:');
      logDebug(error?.message || 'Unknown error');
      if (error?.response) {
        logDebug('Error response:');
        logDebug({
          status: error.response.status,
          data: error.response.data
        });
      }
      
      if (isDebugMode()) {
        // In debug mode, we could use a mock user for development purposes
        logDebug('Debug mode is enabled, but still enforcing authentication');
      }
      
      // No fallback user - strict authentication required
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const showMainButton = (text: string, onClick: () => void) => {
    if (webApp?.MainButton) {
      webApp.MainButton.setText(text);
      webApp.MainButton.show();
      webApp.MainButton.onClick(onClick);
    }
  };

  const hideMainButton = () => {
    if (webApp?.MainButton) {
      webApp.MainButton.hide();
    }
  };

  const showBackButton = (onClick: () => void) => {
    if (webApp?.BackButton) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(onClick);
    }
  };

  const hideBackButton = () => {
    if (webApp?.BackButton) {
      webApp.BackButton.hide();
    }
  };

  return {
    user,
    isLoading,
    webApp,
    isTelegramWebApp,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
  };
};
