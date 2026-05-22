## Parent

https://github.com/Kiryushin-Andrey/volley-game-central/issues/8

## What to build

Replace the two game flags (`withPositions`, `withPriorityPlayers`) with a single **game format** field on every game: `recreational`, `positions`, or `priority_players`. These are mutually exclusive:

| Format | Meaning |
|--------|---------|
| `recreational` | No positions, no priority registration windows |
| `positions` | Assigned positions play |
| `priority_players` | Priority registration windows (10-day / 3-day), **not** a positions game |

Migrate existing rows: `false/false` → `recreational`, `true/false` → `positions`, `false/true` → `priority_players`, `true/true` → `recreational`.

Ship end-to-end: database migration (Drizzle), backend reads/writes `gameFormat` on create/update/list/detail, mini-app types and API client, game create/edit form uses one three-option select (labels: Recreational game / With positions / With priority players). All code paths that branched on the old booleans (registration timing, Telegram announcements, categories, admin assignments keyed by day) must use format helpers instead:

```ts
type GameFormat = 'recreational' | 'positions' | 'priority_players';
// gameFormatFromLegacy(withPositions, withPriorityPlayers): GameFormat
// isPositionsGame(format): boolean
// usesPriorityPlayerWindows(format): boolean  // format === 'priority_players'
```

**Note:** `game_administrators.withPositions` (day/slot assignment) stays as-is — it is not the same as game format on a game instance.

## Acceptance criteria

- [ ] Migration adds `game_format`, backfills from legacy columns, drops `with_positions` and `with_priority_players`
- [ ] API exposes `gameFormat` on game resources; old boolean fields are not returned
- [ ] Creating/editing a game persists exactly one of the three formats via the new select
- [ ] Priority registration windows apply only to `priority_players` games; positions behavior only on `positions` games
- [ ] Existing games behave correctly after migration (manual smoke: one game per format)
- [ ] Pure helpers for format + legacy mapping have unit tests

## Blocked by

None — can start immediately.
