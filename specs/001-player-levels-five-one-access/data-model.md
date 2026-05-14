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

**Migration:** Map rows per spec; `(true,true)` legacy → `with_positions`.

**Application helpers:** `isWithPositions(game) => game.playMode === 'with_positions'` for `classifyGame`, Telegram filters, `getRegistrationOpenDays` branches.

## Entity: `system_settings` (new)

| Field | Type | Constraints | Notes |
|-------|------|---------------|--------|
| `key` | text | PRIMARY KEY | e.g. `five_one_level_restrictions_enabled` |
| `value` | jsonb or text | NOT NULL | Boolean or `{"enabled":true}` |
| `updated_at` | timestamptz | default now() | Optional audit |

**Seed:** Insert `five_one_level_restrictions_enabled` = false if missing on migrate.

## Relationships

- `users.player_level` — independent attribute; no FK.
- `games.play_mode` — drives which registration helpers apply; links conceptually to `game_administrators.with_positions` (boolean track for day admins) — **no FK**; admin UI naming alignment only.

## Validation rules

- Admin PATCH level: only `beginner` | `intermediate` | `advanced` | `null`.
- Global toggle: only global admin (`is_admin`).
- `play_mode`: reject unknown enum labels on write.

## State transitions

- **Toggle off → on:** Existing registrations unchanged; new registrations evaluated under FR-2.
- **Level change:** Does not remove existing `game_registrations`; affects **next** registration attempt only.
