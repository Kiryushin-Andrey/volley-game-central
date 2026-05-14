# Quickstart: Verifying player levels & 5-1 access

Local verification assumes [README.md](../../README.md) Docker/backend + mini-app dev flows already work.

## 1. Apply migrations

From `backend/`:

```bash
npm run generate   # after schema.ts edits
npm run migrate    # or dev script which migrates
```

Confirm columns: `users.player_level`, `games.play_mode`, `system_settings` row for toggle.

## 2. Seed data for manual matrix

- Create or pick three users (Telegram-linked if testing `notifyUser`): assign levels **beginner**, **intermediate**, **advanced** via admin API or SQL.
- Leave one user **NULL** level (unassigned).
- Create a future **with positions** game with open registration per existing rules.
- Set `five_one_level_restrictions_enabled` **true** in `system_settings`.

## 3. Registration matrix (toggle ON)

| User level | Before T−3 | At/after T−3, spots | At/after T−3, full |
|------------|------------|---------------------|-------------------|
| beginner | 403 + code `FIVE_ONE_LEVEL_NOT_ELIGIBLE` | same | same |
| intermediate | 403 (window); no roster **or** waitlist before T−3 | roster if spot | waitlist if full |
| advanced / NULL | existing timing only | roster/waitlist per today | same |

Cross-check **403 JSON** includes `code` and optional `registrationOpensAt` (time-window denials).

## 4. Telegram

- Successful register: unchanged messages.
- FR-2 denial: message sent **once** within 60s for repeated identical failures (spam test).

## 5. Toggle OFF

Set toggle false: all levels behave as **pre-feature** for 5-1 registration.

## 6. Admin UI

- Global admin: open player-levels route; confirm pagination, search, sort buckets (unassigned → advanced → intermediate → beginner).
- Non-admin: route 403 / redirect.

## 7. Game form

- Create/edit game shows **single** play mode select; persisted value round-trips.

## 8. Legacy API (during compat window)

POST/PATCH game with only legacy booleans still maps to `play_mode` correctly.
