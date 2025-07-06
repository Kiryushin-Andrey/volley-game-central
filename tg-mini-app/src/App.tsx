import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useTelegramWebApp } from './hooks/useTelegramWebApp';
import GamesList from './pages/GamesList';
import GameDetails from './pages/GameDetails';
import CreateGame from './pages/CreateGame';
import EditGameSettings from './pages/EditGameSettings';
import BunqSettings from './pages/BunqSettings';
import CheckPayments from './pages/CheckPayments';
import LoadingSpinner from './components/LoadingSpinner';
import './App.scss';
import { logDebug, isDebugMode } from './debug';

// Using debug mode from the debug.ts module

function App() {
  const { user, isLoading, isTelegramWebApp } = useTelegramWebApp();

  // Define content based on app state
  let content;

  // Show loading state
  if (isLoading) {
    content = (
      <div className="container">
        <LoadingSpinner />
        <div>Loading...</div>
      </div>
    );
  }
  
  // If not in Telegram WebApp or no authenticated user, show message
  else if (!isTelegramWebApp || !user) {
    content = (
      <div className="container">
        <h1>Authentication Required</h1>
        <p>Please open this app from Telegram</p>
      </div>
    );
  }
  
  // Authenticated user - show main app content
  else {
    content = (
      <Router>
        <Routes>
          <Route path="/" element={<GamesList user={user} />} />
          <Route path="/game/:gameId" element={<GameDetails user={user} />} />
          <Route path="/games/new" element={<CreateGame />} />
          <Route path="/game/:gameId/edit" element={<EditGameSettings />} />
          <Route path="/bunq-settings" element={<BunqSettings />} />
          <Route path="/check-payments" element={<CheckPayments />} />
        </Routes>
      </Router>
    );
  }

  // Log app state for debugging
  React.useEffect(() => {
    if (isDebugMode()) {
      logDebug('App state:');
      logDebug({ user, isLoading, isTelegramWebApp });
      logDebug(`Telegram WebApp availability: ${Boolean(window.Telegram?.WebApp)}`);
      logDebug(`InitData: ${window.Telegram?.WebApp?.initData || 'none'}`);
      
      if (window.Telegram?.WebApp?.initDataUnsafe) {
        logDebug('InitDataUnsafe:');
        logDebug(window.Telegram.WebApp.initDataUnsafe);
      }
    }
  }, [user, isLoading, isTelegramWebApp]);
  
  // Always render the app container with content
  return (
    <div className="app-container">
      {content}
    </div>
  );
}

export default App;
