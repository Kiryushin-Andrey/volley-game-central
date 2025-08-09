# Volleyball Game Central - Telegram Mini App

A Telegram Mini App for managing volleyball game registrations, built with React + TypeScript + Vite.

## Features

- **Games List**: View all upcoming volleyball games with player counts
- **Game Details**: See registered players and waitlist for each game
- **Join/Leave Games**: Register or unregister for games directly in Telegram
- **Real-time Updates**: Live player counts and registration status
- **Telegram Integration**: Native Telegram WebApp UI and controls

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment (dev vs prod):**
   - Dev: No env is required. The app uses Vite proxy to `http://localhost:3000` via the `/api` prefix.
   - Prod/preview builds: Optionally set `VITE_API_BASE_URL` to your backend URL.
     ```
     VITE_API_BASE_URL=https://your-backend.example.com
     ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

## Backend Integration

Key API calls (the frontend automatically adds Telegram WebApp initData in `Authorization: TelegramWebApp ...` header):

- `GET /users/me` – Current user (auth via Telegram WebApp initData)
- `GET /games/default-datetime` – Suggested date/location for creation
- `GET /games` – Games list (supports `showPast`, `showAll`)
- `GET /games/:id` – Game details with registrations
- `POST /games` – Create new game (admin only)
- `PUT /games/:id` – Update game (admin only)
- `POST /games/:id/register` – Register for a game
- `DELETE /games/:id/register` – Unregister from a game

## Telegram Bot Setup (local)

1. Create a bot with [@BotFather](https://t.me/botfather) and copy the token.
2. Run this app on port 3001: `npm run dev`.
3. Expose port 3001 via HTTPS (ngrok or Pinggy) and get the public URL.
4. In BotFather, set the Web App URL and Domain to your public URL/domain.
5. Configure the backend with your bot token and the same Mini App URL.
   See the root `README.md` for step-by-step instructions.

## Development

- **Development server**: `npm run dev` (runs on port 3001)
- **Build**: `npm run build`
- **Preview build**: `npm run preview`

## Project Structure

```
src/
├── components/        # Reusable components
├── hooks/            # Custom React hooks
├── pages/            # Page components
├── services/         # API services
├── types/            # TypeScript type definitions
└── App.tsx           # Main app component
```

## Key Components

- **GamesList**: Main screen showing all upcoming games
- **GameDetails**: Individual game screen with player lists and join/leave actions
- **useTelegramWebApp**: Hook for Telegram WebApp integration and authentication

## Creating a game

- Game creation is admin-only. If you don't see the "Create New Game" button on the Games screen, promote your user to admin in the DB. See the root `README.md` → "Creating a game (admin only)" for details.

## Telegram WebApp Features Used

- **Main Button**: Join/Leave game actions
- **Back Button**: Navigation between screens
- **Theme Integration**: Adapts to user's Telegram theme
- **User Authentication**: Uses Telegram user data for auth
