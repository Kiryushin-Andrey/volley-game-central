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

  // Central state for the main button
  const [mainButtonAction, setMainButtonAction] = useState<(() => void) | null>(null);
  const [mainButtonText, setMainButtonText] = useState<string | null>(null);
  
  // Single event handler for all button actions
  useEffect(() => {
    if (!webApp?.MainButton) return;
    
    // Set up a single click handler that will dispatch to the current action
    const handleMainButtonClick = () => {
      logDebug(`Main button clicked: ${mainButtonText || '(no text)'}`);
      if (mainButtonAction) {
        mainButtonAction();
      } else {
        logDebug('No action defined for main button');
      }
    };
    
    // Configure the button once with our single handler
    webApp.MainButton.onClick(handleMainButtonClick);
    
    return () => {
      // Clean up on unmount
      if (webApp?.MainButton) {
        // According to docs, we should pass the specific handler to remove
        webApp.MainButton.offClick(handleMainButtonClick);
      }
    };
  }, [webApp, mainButtonText, mainButtonAction]);
  
  // Update button text and visibility whenever state changes
  useEffect(() => {
    if (!webApp?.MainButton) return;
    
    if (mainButtonText && mainButtonAction) {
      webApp.MainButton.setText(mainButtonText);
      webApp.MainButton.show();
      logDebug(`Main button configured: ${mainButtonText}`);
    } else {
      webApp.MainButton.hide();
      logDebug('Main button hidden');
    }
  }, [mainButtonText, mainButtonAction, webApp]);
  
  // API for components to control the button
  const showMainButton = (text: string, onClick: () => void) => {
    logDebug(`Setting main button: ${text}`);
    setMainButtonText(text);
    setMainButtonAction(() => onClick);
  };

  const hideMainButton = () => {
    logDebug('Hiding main button');
    setMainButtonText(null);
    setMainButtonAction(null);
  };

  // Similar to main button, manage back button with state
  const [backButtonAction, setBackButtonAction] = useState<(() => void) | null>(null);
  
  // Single event handler for back button
  useEffect(() => {
    if (!webApp?.BackButton) return;
    
    const handleBackButtonClick = () => {
      logDebug('Back button clicked');
      if (backButtonAction) {
        backButtonAction();
      } else {
        logDebug('No action defined for back button');
      }
    };
    
    // Configure the back button with our single handler
    webApp.BackButton.onClick(handleBackButtonClick);
    
    return () => {
      // Clean up on unmount
      if (webApp?.BackButton) {
        webApp.BackButton.offClick(handleBackButtonClick);
      }
    };
  }, [webApp]);
  
  // Update back button visibility when state changes
  useEffect(() => {
    if (!webApp?.BackButton) return;
    
    if (backButtonAction) {
      webApp.BackButton.show();
      logDebug('Back button shown');
    } else {
      webApp.BackButton.hide();
      logDebug('Back button hidden');
    }
  }, [backButtonAction, webApp]);
  
  const showBackButton = (onClick: () => void) => {
    logDebug('Setting back button handler');
    setBackButtonAction(() => onClick);
  };

  const hideBackButton = () => {
    logDebug('Removing back button handler');
    setBackButtonAction(null);
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
