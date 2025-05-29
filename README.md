# Volley Game Central

A platform for organizing volleyball games with Telegram authentication.

## Project Structure

The project is organized into two main directories:

- `frontend/`: React application built with Vite, TypeScript, and Tailwind CSS
- `backend/`: Node.js server with Express, PostgreSQL, and Telegram bot integration

## Prerequisites

- Node.js & npm
- PostgreSQL database
- Telegram Bot Token (obtain from @BotFather)

## Setup

1. Clone the repository and install dependencies:
```sh
git clone <repository-url>
cd volley-game-central
npm install
cd frontend && npm install
cd ../backend && npm install
```

2. Configure the environment:
```sh
cp backend/.env.example backend/.env
# Edit backend/.env with your database and Telegram bot credentials
```

3. Start the development servers:
```sh
# In the root directory:
npm run dev
# This will start both frontend and backend servers
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Technologies Used

Frontend:
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

Backend:
- Node.js
- Express
- PostgreSQL with TypeORM
- Telegraf (Telegram Bot Framework)

## Development

- Frontend runs on: http://localhost:5173
- Backend runs on: http://localhost:3000

## Features

- Telegram authentication
- Game creation and management
- Player registration for games
- Real-time updates via Telegram bot
