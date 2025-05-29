import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui/button';

export const Header = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-orange-600">Volleyball Central</h1>
            </div>
            <nav className="ml-6 flex space-x-8">
              <Link
                to="/games"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  pathname === '/games'
                    ? 'border-b-2 border-orange-500 text-gray-900'
                    : 'text-gray-500 hover:border-b-2 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Games
              </Link>
              <Link
                to="/participants"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  pathname === '/participants'
                    ? 'border-b-2 border-orange-500 text-gray-900'
                    : 'text-gray-500 hover:border-b-2 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Participants
              </Link>
            </nav>
          </div>
          <div className="flex items-center">
            {user ? (
              <span className="text-sm text-gray-700">Welcome, {user.displayName}</span>
            ) : (
              <Button variant="ghost">Sign In</Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
