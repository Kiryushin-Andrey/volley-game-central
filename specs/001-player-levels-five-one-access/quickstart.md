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

## 5. FR-2 join hidden (game details UI)

With enforcement **on**, use a **beginner** (or **intermediate** on a 5-1 game still **>3 calendar days** away). Pick a game where **general registration is already open** (same timing rules as today). Open game details while **not** registered:

- **No** Join Game button (and no self-serve add-guest when that path is gated).
- Inline info text shows neutral copy (no words `beginner` / `intermediate` / `advanced`).
- `GET /games/:id` includes `registrationRestriction` with the expected `code`.
- `POST .../register` still returns **403** with the same FR-2 `code` (second line of defense).

**Admin `blockReason` (separate):** Join may still show; popup on tap is OK. Confirm `POST .../register` returns **403** with the block message if called directly.

## 6. Successful registration Telegram

- Unchanged: after insert, `notifyUser` still sends roster vs waitlist messages.

## 7. Enforcement OFF

Unset env (if used) and use constant `false`: all levels behave as **pre-feature** for 5-1 registration.

## 8. Browser E2E (Playwright / MCP)

Follow scenario IDs **E1–E7** in [e2e-playwright-mcp.md](./e2e-playwright-mcp.md). Minimum smoke today: `tg-mini-app/e2e/smoke.spec.ts` (landing only); FR-2 scenarios are planned in `fr2-join-hidden.spec.ts`.

## 9. Admin UI

- Global admin: open player-levels route; confirm pagination, search, sort buckets (unassigned → advanced → intermediate → beginner).
- Non-admin: route 403 / redirect.

## 10. Game form

- Create/edit game sends **only** the new play-mode field; persisted value round-trips.
