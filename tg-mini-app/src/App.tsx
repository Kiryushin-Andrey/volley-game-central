import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useAuthenticatedUser } from './hooks/useAuthenticatedUser';
import GamesList from './pages/GamesList';
import GameDetails from './pages/GameDetails';
import CreateGame from './pages/CreateGame';
import EditGameSettings from './pages/EditGameSettings';
import BunqSettings from './pages/BunqSettings';
import CheckPayments from './pages/CheckPayments';
import GameAdministrators from './pages/GameAdministrators';
import LoadingSpinner from './components/LoadingSpinner';
import PhoneAuth from './components/auth/PhoneAuth';
import './App.scss';
import { logDebug, isDebugMode } from './debug';
import { initAppTheme } from './utils/theme';
import { authApi, userApi } from './services/api';
import EditDisplayNameDialog from './components/EditDisplayNameDialog';

function App() {
  const { user, isDevMode, isLoading } = useAuthenticatedUser();
  const [isPhoneAuthOpen, setIsPhoneAuthOpen] = React.useState(false);
  const isTelegramApp = Boolean(window.Telegram?.WebApp?.initDataUnsafe?.user);

  // Local header display name state so we can reflect updates immediately
  const [headerName, setHeaderName] = React.useState<string | null>(null);
  const [isEditNameOpen, setIsEditNameOpen] = React.useState(false);

  React.useEffect(() => {
    if (user?.displayName) {
      setHeaderName(user.displayName);
    } else if (user) {
      // fallback to something stable if displayName missing
      setHeaderName(user.displayName || '');
    } else {
      setHeaderName(null);
    }
  }, [user?.id, user?.displayName]);

  const handleLogout = async () => {
    await authApi.logout();
    window.location.href = '/';
  };

  const handleOpenEditName = () => {
    setIsEditNameOpen(true);
  };

  const handleSaveDisplayName = async (newName: string) => {
    await userApi.updateProfile({ displayName: newName });
    setHeaderName(newName);
    setIsEditNameOpen(false);
  };

  // Initialize app theming (Telegram vs browser system theme)
  React.useEffect(() => {
    const cleanup = initAppTheme();
    return cleanup;
  }, []);

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
  
  // If no authenticated user at all (neither Telegram nor JWT), show auth choice
  else if (!user) {
    const botName = (import.meta.env.VITE_TELEGRAM_BOT_NAME as string | undefined);
    const telegramUrl = botName ? `https://t.me/${botName}` : undefined;
    content = (
      <div className="landing-container">
        <h1 className="landing-title">Welcome</h1>
        <p className="landing-subtitle">Choose how you want to continue:</p>
        <div className="landing-buttons">
          <a
            className={`landing-button telegram${telegramUrl ? '' : ' disabled'}`}
            href={telegramUrl || undefined}
            {...(telegramUrl ? { rel: 'noopener noreferrer' } : {})}
          >
            <span className="icon" aria-hidden>
              {/* Telegram SVG icon */}
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M9.036 15.592l-.376 5.305c.539 0 .771-.232 1.049-.51l2.52-2.412 5.223 3.83c.958.529 1.64.252 1.901-.888l3.445-16.148h.001c.305-1.421-.513-1.976-1.45-1.628L1.13 9.304C-.256 9.84-.235 10.61.896 10.96l5.23 1.63 12.145-7.656c.571-.375 1.09-.168.662.207L9.036 15.592z"/>
              </svg>
            </span>
            <span>Telegram</span>
          </a>
          <button
            className="landing-button phone"
            type="button"
            style={{ background: '#0ea5e9', color: '#fff' }}
            onClick={() => setIsPhoneAuthOpen(true)}
          >
            <span className="icon" aria-hidden>
              {/* Phone SVG icon */}
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M6.62 10.79a15.464 15.464 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V21a1 1 0 01-1 1C10.07 22 2 13.93 2 3a1 1 0 011-1h3.49a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.24 1.02l-2.2 2.2z"/>
              </svg>
            </span>
            <span>Phone number</span>
          </button>
        </div>
        {/* Phone Number auth UI */}
        {isPhoneAuthOpen && (
          <PhoneAuth onClose={() => setIsPhoneAuthOpen(false)} isDevMode={isDevMode} />
        )}
        {!telegramUrl && (
          <p className="landing-hint">Telegram bot name is not configured.</p>
        )}

        {/* How it works (expandable) */}
        <details className="how-it-works" role="group">
          <summary className="how-summary" aria-label="Toggle how it works">
            <span className="how-title">How it works</span>
            <span className="chevron" aria-hidden>
              {/* Chevron down icon */}
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
                <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
              </svg>
            </span>
          </summary>
          <div className="how-content">
            <p>
              We are a non-profit, recreational volleyball community based in Haarlem. We organize regular
              volleyball games and everyone is welcome to join.
            </p>
            <p>
              You can register for any game via this website using your Telegram account or phone number.
              Connecting via Telegram or phone number lets us send you payment requests and important notifications (like time or venue changes).
            </p>
            <p>
              We only collect payments to cover the cost of the hall rental — we don’t make a profit.
              After each game, payment requests are sent via Telegram or SMS to the people who registered for this game.
            </p>
            <p className="how-secondary">
              <a href="https://github.com/Kiryushin-Andrey/volley-game-central" target="_blank" rel="noopener noreferrer">
                <span className="icon" aria-hidden>
                  {/* GitHub icon */}
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.238-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.004.07 1.532 1.031 1.532 1.031.892 1.529 2.341 1.087 2.91.832.091-.647.35-1.087.636-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.985 1.029-2.685-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.503.337 1.909-1.294 2.748-1.025 2.748-1.025.546 1.378.203 2.397.1 2.65.64.7 1.028 1.594 1.028 2.685 0 3.842-2.339 4.687-4.566 4.936.359.309.679.92.679 1.855 0 1.338-.012 2.418-.012 2.747 0 .268.18.58.688.481C19.138 20.162 22 16.416 22 12 22 6.477 17.523 2 12 2z"/>
                  </svg>
                </span>
                Source code at GitHub
              </a>
            </p>
          </div>
        </details>
      </div>
    );
  }
  
  // Authenticated user - show main app content
  else {
    content = (
      <Routes>
        <Route path="/" element={<GamesList user={user!} />} />
        <Route path="/game/:gameId" element={<GameDetails user={user!} />} />
        <Route path="/games/new" element={<CreateGame />} />
        <Route path="/game/:gameId/edit" element={<EditGameSettings />} />
        <Route path="/bunq-settings" element={<BunqSettings />} />
        <Route path="/bunq-settings/user/:assignedUserId" element={<BunqSettings />} />
        <Route path="/check-payments" element={<CheckPayments />} />
        <Route path="/game-administrators" element={<GameAdministrators />} />
      </Routes>
    );
  }

  // Log app state for debugging
  React.useEffect(() => {
    if (isDebugMode()) {
      logDebug('App state:');
      logDebug({ user, isLoading });
      logDebug(`Telegram WebApp availability: ${Boolean(window.Telegram?.WebApp)}`);
      logDebug(`InitData: ${window.Telegram?.WebApp?.initData || 'none'}`);
      
      if (window.Telegram?.WebApp?.initDataUnsafe) {
        logDebug('InitDataUnsafe:');
        logDebug(window.Telegram.WebApp.initDataUnsafe);
      }
    }
  }, [user, isLoading]);
  
  // Always render the app container with content
  return (
    <Router>
      <div className="app-container">
        {/* Browser-only header */}
        {!isTelegramApp && (
          <header className="app-header" role="banner">
            <div className="header-inner">
              <Link className="brand" to="/" aria-label="Go to home">Haarlem Volley Bot</Link>
              <div className="spacer" />
              {user && (
                <div className="user-controls">
                  <div
                    className="user-id"
                    role="button"
                    tabIndex={0}
                    aria-label="Edit display name"
                    title="Edit display name"
                    onClick={handleOpenEditName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenEditName();
                      }
                    }}
                  >
                    <span className="user-icon-btn" aria-hidden>
                      {/* Person/user icon */}
                      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path fill="currentColor" d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 3.134-7 7 0 .552.448 1 1 1h12c.552 0 1-.448 1-1 0-3.866-3.134-7-7-7z"/>
                      </svg>
                    </span>
                    <span className="user-badge" title={headerName || user.displayName}>
                      {headerName || user.displayName}
                    </span>
                  </div>
                  <button className="logout-btn" type="button" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </header>
        )}

        {/* Content area: constrain width in browser mode */}
        <main className={!isTelegramApp ? 'page-content' : undefined} role="main">
          {content}
        </main>
        {/* Edit display name dialog (browser mode only) */}
        {!isTelegramApp && user && (
          <EditDisplayNameDialog
            isOpen={isEditNameOpen}
            initialName={headerName || user.displayName || ''}
            onCancel={() => setIsEditNameOpen(false)}
            save={handleSaveDisplayName}
          />
        )}
      </div>
    </Router>
  );
}

export default App;
