# Data model: Player levels & 5-1 access

Derived from [spec.md](./spec.md) and [research.md](./research.md).

## Entity: `users` (extend)

| Field | Type | Constraints | Notes |
|-------|------|---------------|--------|
| `player_level` | `player_skill_level` enum or nullable text | NULL = unassigned | Never returned on non-admin DTOs |

## Entity: `games` (replace dual flags)

| Field | Type | Constraints | Notes |
|-------|------|---------------|--------|
| `play_mode` | enum / constrained text | NOT NULL, default `regular` | Values: `with_positions`, `with_priority_players`, `regular` |
| ~~`with_positions`~~ | — | Remove after migration + API cutover | Derived: `play_mode === 'with_positions'` |
| ~~`with_priority_players`~~ | — | Remove after migration + API cutover | Derived: `play_mode === 'with_priority_players'` |

**Migration (database only):** Map existing rows: `(with_positions=true)` → with positions; `(with_positions=false, with_priority_players=true)` → with priority players; `(false, false)` → regular game. If any row has both booleans true (rare), migrate to **with positions** and log. **API** does not read the old columns after deploy—only `play_mode` (or chosen name) on write.

**Application helpers:** `isWithPositions(game) => game.playMode === 'with_positions'` for `classifyGame`, Telegram filters, `getRegistrationOpenDays` branches.

## Enforcement switch (not stored)

| Mechanism | Location | Notes |
|-----------|----------|--------|
| Default | `backend/src/constants.ts` (or equivalent) | Boolean constant; ship `false` until flipped |
| Override | `process.env.FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED` | When set, overrides constant for truthy values |

No table, no column, no admin API.

## Relationships

- `users.player_level` — independent attribute; no FK.
- `games.play_mode` — drives which registration helpers apply; links conceptually to `game_administrators.with_positions` (boolean track for day admins) — **no FK**; admin UI naming alignment only.

## Validation rules

- Admin PATCH level: only `beginner` | `intermediate` | `advanced` | `null`.
- `play_mode`: reject unknown enum labels on write.

## State transitions

- **Constant/env change on deploy:** Existing registrations unchanged; new registrations evaluated under FR-2 when effective enforcement is on.
- **Level change:** Does not remove existing `game_registrations`; affects **next** registration attempt only.
