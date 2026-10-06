import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Accordion, Button, Caption, List, Placeholder, Section, Text, Title } from '@telegram-apps/telegram-ui';
import { useAuthenticatedUser } from './hooks/useAuthenticatedUser';
import GamesList from './pages/GamesList';
import GameDetails from './pages/GameDetails';
import CreateGame from './pages/CreateGame';
import EditGameSettings from './pages/EditGameSettings';
import BunqSettings from './pages/BunqSettings';
import CheckPayments from './pages/CheckPayments';
import GameAdministrators from './pages/GameAdministrators';
import PlayersHub from './pages/PlayersHub';
import PlayerLevels from './pages/PlayerLevels';
import PriorityPlayers from './pages/PriorityPlayers';
import LoadingSpinner from './components/LoadingSpinner';
import PhoneAuth from './components/auth/PhoneAuth';
import './App.scss';
import { logDebug, isDebugMode } from './debug';
import { initAppTheme } from './utils/theme';
import { authApi, userApi, getBuildInfo } from './services/api';
import EditDisplayNameDialog from './components/EditDisplayNameDialog';
import { getTelegramStartParam, parseGameIdFromStartParam } from './utils/telegram';

/**
 * Component to handle deep linking from Telegram start parameter
 * Must be inside Router context to use useNavigate
 */
function DeepLinkHandler({ user }: { user: any }) {
  const navigate = useNavigate();
  const [hasHandledDeepLink, setHasHandledDeepLink] = React.useState(false);

  React.useEffect(() => {
    // Only process deep link once when user is authenticated and we haven't handled it yet
    if (!user || hasHandledDeepLink) {
      return;
    }

    const startParam = getTelegramStartParam();
    if (startParam) {
      const gameId = parseGameIdFromStartParam(startParam);

      if (gameId) {
        logDebug(`Deep linking to game ${gameId} from Telegram start parameter: ${startParam}`);
        navigate(`/game/${gameId}`);
        setHasHandledDeepLink(true);
      }
    }
  }, [user, hasHandledDeepLink, navigate]);

  return null;
}

function App() {
  const { user, isDevMode, isLoading } = useAuthenticatedUser();
  const [isPhoneAuthOpen, setIsPhoneAuthOpen] = React.useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = React.useState(false);
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

  // Poll server build info every minute; reload if backend was redeployed (new build timestamp)
  React.useEffect(() => {
    const initialBuildTimestampRef = { current: null as string | null };
    const pollIntervalMs = 60 * 1000;

    const checkBuildInfo = async () => {
      try {
        const { buildTimestamp } = await getBuildInfo();
        if (initialBuildTimestampRef.current === null) {
          initialBuildTimestampRef.current = buildTimestamp;
          return;
        }
        if (initialBuildTimestampRef.current !== buildTimestamp) {
          window.location.reload();
        }
      } catch {
        // Ignore errors (e.g. offline); keep polling
      }
    };

    void checkBuildInfo();
    const intervalId = setInterval(() => void checkBuildInfo(), pollIntervalMs);
    return () => clearInterval(intervalId);
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
    const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME;
    const telegramUrl = botName ? `https://t.me/${botName}` : undefined;
    content = (
      <List>
        <Placeholder
          header={<Title Component="h1" weight="1">Welcome</Title>}
          description="Choose how you want to continue:"
          action={
            <div className="landing-buttons">
              <Button
                Component="a"
                className={`landing-button telegram${telegramUrl ? '' : ' disabled'}`}
                href={telegramUrl || undefined}
                stretched
                size="l"
                disabled={!telegramUrl}
                {...(telegramUrl ? { rel: 'noopener noreferrer' } : {})}
              >
                Telegram
              </Button>
              <Button
                className="landing-button phone"
                type="button"
                stretched
                size="l"
                mode="bezeled"
                onClick={() => setIsPhoneAuthOpen(true)}
              >
                Phone number
              </Button>
            </div>
          }
        />
        {isPhoneAuthOpen && (
          <PhoneAuth onClose={() => setIsPhoneAuthOpen(false)} isDevMode={isDevMode} />
        )}
        {!telegramUrl && (
          <Caption className="landing-hint">Telegram bot name is not configured.</Caption>
        )}
        <Section>
          <Accordion expanded={howItWorksOpen} onChange={setHowItWorksOpen}>
            <Accordion.Summary>How it works</Accordion.Summary>
            <Accordion.Content>
              <div className="how-content">
                <Text>
                  We are a non-profit, recreational volleyball community based in Haarlem. We organize regular
                  volleyball games and everyone is welcome to join.
                </Text>
                <Text>
                  You can register for any game via this website using your Telegram account or phone number.
                  Connecting via Telegram or phone number lets us send you payment requests and important notifications (like time or venue changes).
                </Text>
                <Text>
                  We only collect payments to cover the cost of the hall rental — we don’t make a profit.
                  After each game, payment requests are sent via Telegram or SMS to the people who registered for this game.
                </Text>
                <p className="how-secondary">
                  <a href="https://github.com/Kiryushin-Andrey/volley-game-central" target="_blank" rel="noopener noreferrer">
                    Source code at GitHub
                  </a>
                </p>
              </div>
            </Accordion.Content>
          </Accordion>
        </Section>
      </List>
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
        <Route path="/players" element={<PlayersHub />} />
        <Route path="/game-administrators" element={<GameAdministrators />} />
        <Route path="/player-levels" element={<PlayerLevels />} />
        <Route path="/priority-players/:gameAdministratorId" element={<PriorityPlayers />} />
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

      const startParam = getTelegramStartParam();
      if (startParam) {
        logDebug(`Telegram start parameter: ${startParam}`);
        const gameId = parseGameIdFromStartParam(startParam);
        if (gameId) {
          logDebug(`Parsed game ID: ${gameId}`);
        }
      }
    }
  }, [user, isLoading]);
  
  // Always render the app container with content
  return (
    <Router>
      {/* Handle deep linking from Telegram start parameter */}
      <DeepLinkHandler user={user} />
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
                  <Button size="s" mode="gray" type="button" onClick={handleLogout}>Logout</Button>
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
