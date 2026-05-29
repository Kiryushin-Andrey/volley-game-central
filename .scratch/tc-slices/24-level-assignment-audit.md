## Parent

https://github.com/Kiryushin-Andrey/volley-game-central/issues/8

**PRD:** `docs/prd/player-levels-and-game-format.md`  
**Glossary:** `CONTEXT.md` — **Level assignment record**

## What to build

Track **who last set each player's level** and show it to **global administrators** and **Technical Committee members** on the **player levels page** and in the **player info dialog** when opened from that page.

**Data:** `player_level_set_by_id` (nullable FK to users) and `player_level_set_at` on users; update both on every successful level PATCH (including first assignment).

**API:** list and PATCH responses include `playerLevelSetBy: { displayName } | null`. Add **`GET /player-levels/users/:userId`** (global administrator or TC only) returning the same profile shape for one user (used by later slices; must be testable here via API or minimal UI hook).

**UI:** show **Set by {displayName}** on assigned rows in the player levels list and under level in the dialog on the player levels page. Show **Unassigned** when `playerLevel` is null; no **Set by** line until a level exists. Display name only — no timestamp.

## Acceptance criteria

- [ ] Migration adds audit columns; PATCH sets them to the authenticated global administrator or TC member
- [ ] `GET /player-levels/users` and `GET /player-levels/users/:userId` return `playerLevelSetBy` for global administrators and TCs
- [ ] Player levels list and dialog (from that page) show audit line per PRD
- [ ] E2E **E2E-LEVELS-007**: global admin or TC assigns level; list and/or dialog shows **Set by** with assigner's display name
- [ ] `npm run test:e2e` green

## Blocked by

- #23 (`isAdmin || isTc` auth and TC/global access to player levels routes)

## User stories (reference)

33, 42–43, 57.
