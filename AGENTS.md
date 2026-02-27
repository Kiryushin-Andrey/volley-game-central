# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Volley Game Central is a Telegram Mini App for organizing volleyball games. Two services: **backend** (Express + PostgreSQL, port 3000) and **tg-mini-app** (React + Vite, port 3001).

### Starting services

1. **PostgreSQL**: `docker compose up -d postgres` (port 5432, user/pass: `postgres/postgres`, db: `volley_game_central`)
2. **Backend**: `cd backend && DEV_MODE=true npx ts-node-dev --respawn src/index.ts` (port 3000). The Telegram bot token error on startup is expected and harmless in dev mode.
3. **Frontend**: `cd tg-mini-app && npm run dev` (port 3001). Proxies `/api` -> backend, `/webhooks` -> backend.
4. **All together**: `DEV_MODE=true npm run dev` from root, or `./dev-start.sh`.

### Key caveats

- **DEV_MODE=true** must be set as an environment variable (not in `.env`) to enable simplified auth (phone + name, no SMS/Telegram needed). The `dev-start.sh` script and `npm run dev:local` handle this.
- **Backend requires a build before migrations**: `npm run migrate` (in `backend/`) runs from `dist/`, so `npm run build` (i.e. `tsc`) must run first. The `npm run dev` script handles this automatically via `ts-node-dev`.
- **JWT_SECRET** must be set in `backend/.env` for auth to work. Any string works for local dev.
- **TELEGRAM_BOT_TOKEN** is optional in dev; the bot will log an error on startup but the API server still runs fine.
- Backend routes are at `/games`, `/users`, `/auth`, etc. (no `/api` prefix). The Vite dev server's proxy strips the `/api` prefix when forwarding.
- See `README.md` for full setup instructions, game creation workflow, and Telegram WebApp setup.

### Build, lint, test

- **Build backend**: `cd backend && npm run build`
- **Build frontend**: `cd tg-mini-app && npm run build`
- **Build all**: `npm run build` (from root)
- **TypeScript check frontend**: `cd tg-mini-app && npx tsc --noEmit`
- No ESLint or test frameworks are currently configured in the project.
