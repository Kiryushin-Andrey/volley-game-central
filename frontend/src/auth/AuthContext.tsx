import { createContext, useContext, useState, useEffect } from 'react';
import { userApi, type User } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

interface ExtendedUser extends User {
  id: number;
  telegramId: string;
  username: string;
  isAdmin: boolean;
  firstName?: string;
  lastName?: string;
  token?: string;
}

interface AuthContextType {
  user: ExtendedUser | null;
  setUser: (user: ExtendedUser | null) => void;
  login: () => void;
  logout: () => void;
  isAdmin: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import type { FC, ReactNode } from 'react';

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if user is already authenticated
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // Redirect based on admin status if at root path
      if (location.pathname === '/') {
        navigate(parsedUser.isAdmin ? '/admin' : '/dashboard');
      }
    } else if (location.pathname !== '/login') {
      // Redirect to login if not authenticated
      navigate('/login');
    }
  }, [navigate, location.pathname]);

  const login = () => {
    console.log('[Auth] Starting login process...');
    // Use 127.0.0.1 consistently and redirect in same tab
    const returnTo = `${window.location.origin}/telegram/callback`;
    const loginUrl = `http://127.0.0.1:3000/auth/telegram?return_to=${returnTo}`;
    console.log('[Auth] Redirecting to:', loginUrl);
    window.location.href = loginUrl;
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  // Listen for messages from Telegram login window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      console.log('[Auth] Received message:', {
        data: event.data,
        origin: event.origin,
        source: event.source ? 'window' : 'unknown'
      });
      if (event.data?.type === 'TELEGRAM_LOGIN') {
        console.log('[Auth] Processing Telegram login data...');
        const telegramData = event.data.user;
        try {
          console.log('[Auth] Telegram data received:', telegramData);
          
          // Try to get existing user
          console.log('[Auth] Looking up user by Telegram ID:', telegramData.telegramId);
          let userData = await userApi.getByTelegramId(telegramData.telegramId);
          
          // If user doesn't exist, create new user
          if (!userData) {
            console.log('[Auth] Creating new user...');
            userData = await userApi.create(telegramData.telegramId, telegramData.username);
          } else {
            console.log('[Auth] Existing user found:', userData);
          }
          
          // Add Telegram-specific fields and token
          const extendedUserData: ExtendedUser = {
            ...userData,
            id: userData.id,
            telegramId: userData.telegramId,
            username: userData.username,
            isAdmin: userData.isAdmin,
            firstName: telegramData.firstName,
            lastName: telegramData.lastName,
            token: event.data.token,
            createdAt: userData.createdAt
          };
          
          console.log('[Auth] Saving user data:', extendedUserData);
          localStorage.setItem('user', JSON.stringify(extendedUserData));
          setUser(extendedUserData);
          
          // Redirect based on admin status
          const redirectPath = extendedUserData.isAdmin ? '/admin' : '/dashboard';
          console.log('[Auth] Redirecting to:', redirectPath);
          navigate(redirectPath);
        } catch (error) {
          console.error('Error handling Telegram login:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      login,
      logout,
      isAdmin: user?.isAdmin || false,
      token: user?.token || null
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
