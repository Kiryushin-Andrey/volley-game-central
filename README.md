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
cp backend/env.example backend/.env
# Edit backend/.env with your database, Telegram, and other credentials
```

4. **Run database migrations:**
Before running this command, ensure you installed postgres and created the database `CREATE DATABASE volley_game_central;`.
```sh
cd backend
npm run migrate
```

5. **Start development servers:**

Option A – run both the backend and frontend together from the project root (recommended):
```sh
npm run dev
```

Option B – start each service in its own terminal:
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here]
