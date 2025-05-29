import React, { createContext, useContext, useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

interface User {
  id: string;
  displayName: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const { participants } = useGameStore();

  // This is a temporary solution. In a real app, you would implement proper authentication
  useEffect(() => {
    // For demo purposes, use the first participant as the logged-in user
    if (participants.length > 0 && !user) {
      const firstParticipant = participants[0];
      setUser({
        id: firstParticipant.id,
        displayName: firstParticipant.displayName
      });
    }
  }, [participants, user]);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
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
