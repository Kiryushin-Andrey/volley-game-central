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
// import WhatsAppAuth from './components/WhatsAppAuth';
import './App.scss';
import { logDebug, isDebugMode } from './debug';

// Using debug mode from the debug.ts module

function App() {
  const { user, isLoading, isTelegramWebApp } = useTelegramWebApp();
  // WhatsApp auth local UI state
  // const [whatsAppStep, setWhatsAppStep] = React.useState<'idle' | 'phone' | 'code'>('idle');
  // const [whatsAppPhone, setWhatsAppPhone] = React.useState('');
  // const [whatsAppCode, setWhatsAppCode] = React.useState('');

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
            className="landing-button whatsapp"
            type="button"
            onClick={() => {
              // setWhatsAppStep('phone');
            }}
          >
            <span className="icon" aria-hidden>
              {/* WhatsApp SVG icon */}
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M19.11 17.54c-.28-.14-1.63-.8-1.88-.9-.25-.09-.43-.14-.62.14-.18.28-.71.89-.87 1.07-.16.18-.32.21-.6.07-.28-.14-1.18-.43-2.25-1.38-.83-.74-1.39-1.65-1.56-1.93-.16-.28-.02-.43.12-.57.12-.12.28-.32.41-.48.14-.16.18-.28.28-.46.09-.18.05-.35-.02-.5-.07-.14-.62-1.49-.85-2.05-.22-.53-.44-.46-.62-.46-.16 0-.35 0-.55.01-.18.01-.5.07-.76.35-.26.28-1 1-1 2.43 0 1.43 1.03 2.8 1.18 2.99.14.18 2.03 3.1 4.9 4.34.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.12.56-.08 1.63-.66 1.86-1.31.23-.64.23-1.19.16-1.31-.07-.12-.25-.19-.53-.33zM16.02 3.2C9.49 3.2 4.2 8.48 4.2 15.02c0 2.08.54 4.03 1.49 5.73L4 28l7.44-1.53c1.63.89 3.51 1.4 5.49 1.4 6.54 0 11.82-5.28 11.82-11.82 0-6.55-5.28-11.85-11.73-11.85zm0 21.2c-1.88 0-3.63-.54-5.09-1.46l-.37-.22-4.41.9.92-4.3-.24-.39c-.91-1.5-1.42-3.25-1.42-5.09 0-5.43 4.42-9.85 9.85-9.85 5.43 0 9.85 4.42 9.85 9.85 0 5.43-4.42 9.85-9.85 9.85z"/>
              </svg>
            </span>
            <span>WhatsApp</span>
          </button>
        </div>
        {/* WhatsApp auth UI */}
        {/* <WhatsAppAuth
          step={whatsAppStep}
          phone={whatsAppPhone}
          code={whatsAppCode}
          onPhoneChange={setWhatsAppPhone}
          onCodeChange={setWhatsAppCode}
          onContinue={() => setWhatsAppStep('code')}
          onVerify={() => {
            // Placeholder for verify action
          }}
        /> */}
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
              You can register for any game via this website using your WhatsApp or Telegram account.
              Connecting via WhatsApp or Telegram lets us send you payment requests and important notifications (like time or venue changes).
            </p>
            <p>
              We only collect payments to cover the cost of the hall rental — we don’t make a profit.
              After each game, payment requests are sent via Telegram or WhatsApp to the people who registered for this game.
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
            <p className="how-secondary">
              For questions, contact me at <a href="mailto:kiryushin.andrey@gmail.com">kiryushin.andrey@gmail.com</a>
            </p>
          </div>
        </details>
      </div>
    );
  }
  
  // Authenticated user - show main app content
  else {
    content = (
      <Router>
        <Routes>
          <Route path="/" element={<GamesList user={user!} />} />
          <Route path="/game/:gameId" element={<GameDetails user={user!} />} />
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
