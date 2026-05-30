## Parent

https://github.com/Kiryushin-Andrey/volley-game-central/issues/8

**PRD:** `docs/prd/player-levels-and-game-format.md`

## What to build

Add a **level multiselect** on the **player levels page** so **global administrators** and **Technical Committee members** can narrow the list by tier in addition to the existing name filter.

**UI:** multiselect (same pattern as games home **category filter** / `CategoryMultiSelect`) with **Unassigned**, **Advanced**, **Intermediate**, **Beginner**. Default: **all four selected** (equivalent to no level restriction). One or more tiers selected = show players matching **any** selected tier (OR). **No tiers selected** = empty list. Name filter applies afterward (AND). Client-loaded full list (~300 users). List sort order unchanged (unassigned → advanced → intermediate → beginner, alphabetical within group).

## Acceptance criteria

- [ ] Level multiselect visible on `/player-levels` for global administrators and TCs (`aria-label="Filter by level"`)
- [ ] Selecting a single tier (e.g. **Beginner**) shows only matching players; all tiers selected restores full list subject to name filter
- [ ] Name + level filters combine correctly (OR within levels, AND with name)
- [ ] E2E **E2E-LEVELS-008**: global admin or TC toggles multiselect to **Beginner** only (then **Unassigned** only, then all tiers + name filter)
- [ ] `npm run test:e2e` green

## Blocked by

- #23 (TC and global admin access to player levels page)

## User stories (reference)

31–32.
