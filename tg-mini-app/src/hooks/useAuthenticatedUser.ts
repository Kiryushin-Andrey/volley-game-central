import { useState, useEffect } from 'react';
import { User } from '../types';
import { userApi } from '../services/api';
import { logDebug, isDebugMode } from '../debug';
import { withRetry } from '../utils/retry';

export const useAuthenticatedUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    logDebug('Initializing Telegram WebApp hook...');
    
    // Check if this is a legitimate Telegram WebApp session
    const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const isTelegramApp = Boolean(telegramUser);
    logDebug('Is Telegram WebApp available: ' + isTelegramApp);
    
    if (isTelegramApp) {
      const telegramWebApp = window.Telegram.WebApp;
      telegramWebApp.ready();
      telegramWebApp.expand();
      logDebug('Telegram WebApp initialized');

      // Check if we have init data
      logDebug('InitData string: ' + telegramWebApp.initData);
      logDebug('InitDataUnsafe object:');
      logDebug(telegramWebApp.initDataUnsafe || 'null');
      
      getAuthenticateUserForTelegramUser(telegramUser);
    } else {
      logDebug('Not running in Telegram WebApp environment');

      // Attempt JWT cookie-based authentication (e.g., after PhoneAuth)
      (async () => {
        try {
          const authenticatedUser = await withRetry(() => userApi.getCurrentUser(), { retries: 3, delayMs: 700 });
          setUser(authenticatedUser);
          logDebug('Authenticated via JWT cookie session');
        } catch (e) {
          logDebug('No JWT session found or authentication failed');
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, []);

  const getAuthenticateUserForTelegramUser = async (telegramUser: any) => {
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
      const authenticatedUser = await withRetry(() => userApi.getCurrentUser(), { retries: 3, delayMs: 700 });
      
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

  return { user, isLoading };
};
