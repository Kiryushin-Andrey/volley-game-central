# Quickstart: Verifying player levels & 5-1 access

Local verification assumes [README.md](../../README.md) Docker/backend + mini-app dev flows already work. For **browser E2E with Playwright and Cursor’s browser/Playwright MCP**, follow [e2e-playwright-mcp.md](./e2e-playwright-mcp.md).

## 1. Apply migrations

From `backend/`:

```bash
npm run generate   # after schema.ts edits
npm run migrate    # or dev script which migrates
```

Confirm columns: `users.player_level`, `games.play_mode` (or equivalent).

## 2. Turn enforcement **on** for testing

**Option A — env (no code change):** set `FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED=true` (or `1` / `yes` per implementation) in `.env` / deployment env and restart the backend.

**Option B — constant:** set the hardcoded default to **true** in `backend/src/constants.ts` (or chosen module), rebuild/restart.

**Option C — off:** unset the env variable and use constant `false` to confirm pre-feature behaviour for 5-1 registration.

## 3. Seed data for manual matrix

- Create or pick three users (Telegram-linked if testing **success** `notifyUser`): assign levels **beginner**, **intermediate**, **advanced** via admin API or SQL.
- Leave one user **NULL** level (unassigned).
- Create a future **with positions** game with open registration per existing rules.

## 4. Registration matrix (enforcement ON)

| User level | Before T−3 | At/after T−3, spots | At/after T−3, full |
|------------|------------|---------------------|-------------------|
| beginner | 403 + code `FIVE_ONE_LEVEL_NOT_ELIGIBLE` | same | same |
| intermediate | 403 (window); no roster **or** waitlist before T−3 | roster if spot | waitlist if full |
| advanced / NULL | existing timing only | roster/waitlist per today | same |

Cross-check **403 JSON** includes `code` and optional `registrationOpensAt` (time-window denials).

## 5. Blocked user (join hidden)

- Use an account with `blockReason` set. Open an upcoming game you are **not** registered for: **no** Join button; inline text shows the block reason (same area as early-registration message). Confirm `POST .../register` still returns **403** if called directly.

## 6. Successful registration Telegram

- Unchanged: after insert, `notifyUser` still sends roster vs waitlist messages.

## 7. Enforcement OFF

Unset env (if used) and use constant `false`: all levels behave as **pre-feature** for 5-1 registration.

## 8. Admin UI

- Global admin: open player-levels route; confirm pagination, search, sort buckets (unassigned → advanced → intermediate → beginner).
- Non-admin: route 403 / redirect.

## 9. Game form

- Create/edit game sends **only** the new play-mode field; persisted value round-trips.
