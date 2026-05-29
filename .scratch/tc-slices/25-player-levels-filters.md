## Parent

https://github.com/Kiryushin-Andrey/volley-game-central/issues/8

**PRD:** `docs/prd/player-levels-and-game-format.md`

## What to build

Add a **level filter** on the **player levels page** so **global administrators** and **Technical Committee members** can narrow the list by tier in addition to the existing name filter.

**UI:** control with **All**, **Unassigned**, **Advanced**, **Intermediate**, **Beginner** (default **All**). Apply together with the name filter on the client-loaded full list (~300 users). List sort order unchanged (unassigned → advanced → intermediate → beginner, alphabetical within group).

## Acceptance criteria

- [ ] Level filter visible on `/player-levels` for global administrators and TCs
- [ ] Selecting a tier shows only matching players; **All** restores full list subject to name filter
- [ ] Name + level filters combine correctly
- [ ] E2E **E2E-LEVELS-008**: global admin or TC sets level filter to **Beginner** (or **Unassigned**); list shows only matching players
- [ ] `npm run test:e2e` green

## Blocked by

- #23 (TC and global admin access to player levels page)

## User stories (reference)

31–32.
