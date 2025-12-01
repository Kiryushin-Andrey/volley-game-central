# Volley Game Central

A Telegram Mini App for organizing volleyball games with integrated payment processing via Bunq.

## Project Structure

The project consists of two main components:

- `backend/`: Node.js server with Express, PostgreSQL (Drizzle ORM), and Telegram bot integration
- `tg-mini-app/`: Telegram Mini App built with React, TypeScript, and Vite

## Features

- **Telegram Authentication**: Secure user authentication through Telegram Web App
- **Game Management**: Create, edit, and manage volleyball games
- **Player Registration**: Register/unregister for games with deadline management
- **Payment Integration**: Bunq payment processing for game fees
- **Real-time Updates**: Telegram bot notifications for game updates
- **Admin Features**: Game moderation and payment tracking

## Prerequisites

- Node.js & npm
- Docker & Docker Compose (for running PostgreSQL locally)
- Telegram Bot Token (obtain from @BotFather)
- Bunq API credentials (for payment processing)

## Quick Start

1. **Clone and install dependencies:**
```sh
git clone https://github.com/Kiryushin-Andrey/volley-game-central.git
cd volley-game-central
npm install
```

Install dependencies per project:
```
# Backend (from backend directory)
npm install

# Frontend (from tg-mini-app directory)
npm install
```

2. **Set up the database:**
```sh
# Start PostgreSQL for development (recommended)
npm run db:up

# Or use Docker directly
docker compose up -d postgres

# For production deployment you can also use the helper script
./up.sh
```

3. **Configure environment variables:**
```sh
# Backend configuration
cp backend/.env.example backend/.env
# Edit backend/.env with your database, Telegram, and other credentials
```

4. **Run database migrations:**
Before running this command, ensure you installed postgres and created the database `CREATE DATABASE volley_game_central;`.
```sh
cd backend
npm run migrate
```

5. **Start development servers:**

Option A – use the dev startup script (recommended for local development):
```sh
./dev-start.sh
```

This script:
- Sets `DEV_MODE=true` to enable simplified authentication (phone + name, no SMS)
- Suppresses all Telegram and SMS notifications
- Starts PostgreSQL database automatically
- Runs both backend and frontend concurrently

You can optionally specify a preview host:
```sh
./dev-start.sh example.com
```

Option B – run both the backend and frontend together from the project root:
```sh
npm run dev
```

Option C – start each service in its own terminal:
```sh
# Backend
cd backend
npm run dev

# Frontend
cd tg-mini-app
npm run dev
```

## Development

- **Backend API**: http://localhost:3000
- **Telegram Mini App**: http://127.0.0.1:3001 (when running in development)
- **Database**: PostgreSQL on localhost:5432

## Technologies Used

**Backend:**
- Node.js with Express
- PostgreSQL with Drizzle ORM
- Telegraf (Telegram Bot Framework)
- Bunq API integration
- JWT for authentication

**Frontend (Telegram Mini App):**
- React 18 with TypeScript
- Vite for build tooling
- React Router for navigation
- Telegram Web App SDK
- SCSS for styling

**Infrastructure:**
- Docker & Docker Compose
- PostgreSQL database
- Environment-based configuration

## Deployment

### Backend Deployment
The backend can be deployed using the provided Docker setup:
```sh
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Telegram Mini App Deployment
The Mini App is configured for deployment on Netlify/Vercel:
```sh
cd tg-mini-app
npm run build
# Deploy the dist/ folder to your hosting provider
```

## Database Schema

The application uses the following main entities:
- **Users**: Telegram users with admin roles
- **Games**: Volleyball games with registration deadlines
- **Game Registrations**: Player registrations for games
- **Bunq Credentials**: Encrypted payment API credentials
- **Payment Requests**: Payment tracking and status

## Telegram WebApp setup (local development)

To run the Mini App inside Telegram while developing locally:

1) Create a bot
- Use BotFather in Telegram to create a bot and get a token.
  - Docs: https://core.telegram.org/bots and https://core.telegram.org/bots#6-botfather

2) Run the frontend and expose it over HTTPS
- From `tg-mini-app/` run `npm run dev` (port 3001).
- Start an HTTPS tunnel for port 3001 (either is fine):
  - ngrok: `ngrok http 3001` (docs: https://ngrok.com/docs)
  - Pinggy: `ssh -p 443 -R0:localhost:3001 a.pinggy.io` (docs: https://pinggy.io/docs/ssh-tunneling)
- Copy the public HTTPS URL you get, e.g. `https://abc123.pinggy.link`.

3) Point your bot to the Mini App URL
- In BotFather, set the Menu Button / Web App to your tunnel URL and set the Web App domain to the same domain.
- Docs: https://core.telegram.org/bots/webapps#linking-your-web-app-to-a-bot

4) Configure backend and start services
- In `backend/.env`, set at minimum:
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=volley_game_central

TELEGRAM_BOT_TOKEN=<your_bot_token>
MINI_APP_URL=<your_https_tunnel_url>
```
- Start Postgres and migrate:
```sh
npm run db:up
cd backend && npm run migrate
```
- Run servers (from repo root):
```sh
npm run dev
```

5) Open the bot in Telegram
- Open `https://t.me/<your_bot>` and tap the menu button to launch the Web App.
- The app authenticates via Telegram WebApp initData (validated server-side using `@telegram-apps/init-data-node`).
- Docs: https://core.telegram.org/bots/webapps and https://github.com/Telegram-Mini-Apps/init-data-node

## Creating a game (admin only)

Creating games is restricted to admins. If you don’t see the “Create New Game” button on the Games screen, promote your Telegram user to admin in the database.

1) Promote your user to admin
```sh
psql "postgresql://postgres:postgres@localhost:5432/volley_game_central"
```
Then run:
```sql
SELECT id, telegram_id, username, is_admin FROM users ORDER BY created_at DESC LIMIT 10;
UPDATE users SET is_admin = true WHERE telegram_id = '<your_numeric_telegram_id>';
```
Reload the Mini App in Telegram.

2) Create a game via the UI
- On the Games screen, use the admin toolbar → “Create New Game”.
- Fill date/time, max players, unregister deadline (hours), payment amount (€), optional 5-1 toggle, location name/link.
- Submit to create the game.

3) If the new game doesn’t appear
- By default, the list shows only games within `REGISTRATION_OPEN_DAYS` (currently 10 days). Use the admin toggle “Show all scheduled games” to see games further in the future.

Optional: direct SQL insert for testing
```sql
INSERT INTO games (
  date_time, max_players, unregister_deadline_hours, payment_amount,
  with_positions, location_name, location_link, created_by_id
) VALUES (
  '2025-08-10 17:00:00+00', 14, 5, 500, false,
  'Victoria Park, Amsterdam', 'https://maps.example/link',
  (SELECT id FROM users WHERE telegram_id = '<your_numeric_telegram_id>')
);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here]
