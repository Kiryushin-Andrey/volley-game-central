import { createContext, useContext, useState, useEffect } from 'react';
import { userApi, type User } from '../services/api';

interface ExtendedUser extends User {
  id: number;
  telegramId: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import type { FC, ReactNode } from 'react';

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = () => {
    // Open Telegram login window
    window.open('http://localhost:3000/auth/telegram', '_blank');
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  // Listen for messages from Telegram login window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin === 'http://localhost:3000' && event.data.type === 'TELEGRAM_LOGIN') {
        const telegramData = event.data.user;
        try {
          // Try to get existing user
          let userData = await userApi.getByTelegramId(telegramData.telegramId);
          
          // If user doesn't exist, create new user
          if (!userData) {
            userData = await userApi.create(telegramData.telegramId, telegramData.username);
          }
          
          // Add Telegram-specific fields
          const extendedUserData = {
            ...userData,
            firstName: telegramData.firstName,
            lastName: telegramData.lastName
          };
          
          localStorage.setItem('user', JSON.stringify(extendedUserData));
          setUser(extendedUserData);
        } catch (error) {
          console.error('Error handling Telegram login:', error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
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
