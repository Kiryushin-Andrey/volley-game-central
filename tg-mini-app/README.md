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

2. **Configure environment:**
   Copy `.env.example` to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```
   
   Update the API URL to match your backend:
   ```
   VITE_API_BASE_URL=http://localhost:3000
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

## Backend Integration

This app connects to the existing backend API with the following endpoints:

- `GET /games` - Get all games with registrations
- `GET /games/:id` - Get specific game details
- `POST /games/:id/register` - Register for a game
- `DELETE /games/:id/register/:userId` - Unregister from a game
- `POST /auth/telegram/complete` - Authenticate Telegram user

## Telegram Bot Setup

To use this mini app with Telegram:

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Set up the menu button to open your mini app:
   ```
   /setmenubutton
   @your_bot_name
   Volleyball Games
   https://your-app-domain.com
   ```
3. Configure your backend with the bot token
4. Deploy the mini app to a public URL

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

## Telegram WebApp Features Used

- **Main Button**: Join/Leave game actions
- **Back Button**: Navigation between screens
- **Theme Integration**: Adapts to user's Telegram theme
- **User Authentication**: Uses Telegram user data for auth
