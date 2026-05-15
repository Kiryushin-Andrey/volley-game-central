## Parent

https://github.com/Kiryushin-Andrey/volley-game-central/issues/8

## What to build

Add **player levels** for global administration only, without changing who can register for games yet (restrictions env stays off or unused).

**Data:** nullable `player_level` on users: `beginner` | `intermediate` | `advanced`. New users stay unassigned (`null`).

**Admin API (global administrator only):**
- List all users with public profile fields + `playerLevel`, ordered for the UI: unassigned first, then advanced, intermediate, beginner (alphabetical within each group)
- PATCH a user's level to one of the three values (reject clearing to unassigned)

**Admin UI:**
- Toolbar **Players** icon → **Players hub** at `/players` with links to Game administrators and Player levels
- **Player levels** page at `/player-levels`: participant-style rows (avatar, name), read-only **level pill** on the right (light green / yellow / red; no pill if unassigned), name filter above list (load all users once, filter client-side ~300 users)
- Row click opens **player info dialog** with level selector; changing level saves immediately; only beginner / intermediate / advanced (no unassigned option once assigning)
- Non–global administrators must not access hub or player levels routes

Levels must not appear anywhere in non-admin UI.

## Acceptance criteria

- [ ] Schema migration adds nullable `player_level` enum on users
- [ ] Global admin can list users and PATCH level; non-admin receives 403
- [ ] Players hub and player levels pages work for `isAdmin` only
- [ ] List grouping, pills, filter, and dialog match PRD UX
- [ ] Self-serve game registration behavior unchanged (no level gating in this slice)

## Blocked by

None — can start immediately (may run in parallel with game format slice).

## User stories (reference)

18–31, 1–2, 27–30, 43 from parent #8.
