---
title: Player levels and game format refactor
labels:
  - enhancement
  - ready-for-agent
branch: cursor/player-levels-c8a4
domain_glossary: CONTEXT.md
---

# Player levels and game format refactor

> **Tracker note:** GitHub Issues are disabled on `kiryushin-andrey/volley-game-central` (`has_issues: false`). This document is the published PRD. When issues are enabled, import it and apply labels `enhancement` + `ready-for-agent`.

## Problem Statement

The club runs **positions games** (games with assigned positions) alongside **recreational games** and **priority players games** (early registration windows without positions). There is no structured way to restrict who can self-register for positions games by skill tier, while keeping that information invisible to regular players. Operators also need a phased rollout: assign levels first, turn enforcement on later.

Separately, game creation uses two independent booleans (`withPositions`, `withPriorityPlayers`) that are confusing and allow meaningless combinations. The domain model should express three mutually exclusive **game formats**.

## Solution

Introduce **player levels** (`beginner`, `intermediate`, `advanced`, or unassigned) managed only by **global administrators**, with a dedicated admin UI. When **positions game level restrictions** are enabled via environment configuration (`POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED`, default off), self-serve registration for **positions games** respects those levels; recreational and priority players games are unaffected.

Replace the two game booleans with a single **game format** enum: `recreational`, `positions`, `priority_players`. Reorganize the admin **Players hub** so the toolbar lands on a page linking to game administrators and player levels.

## User Stories

### Player levels — policy

1. As a club organizer, I want three player levels (beginner, intermediate, advanced), so that access to positions games can be tiered by skill.
2. As a club organizer, I want newcomers to have no level assigned initially, so that we do not label people before we know them.
3. As a club organizer, I want unassigned players to have unrestricted access to positions games (when restrictions are on), so that newcomers are not blocked before evaluation.
4. As a club organizer, I want advanced players to have unrestricted access to positions games, so that experienced players are never delayed by level rules.
5. As a club organizer, I want intermediate players to register for positions games only from 3 days before start (roster or waitlist), so that they join after advanced players have had a fair window.
6. As a club organizer, I want intermediate players to be unable to register at all before that 3-day window (including waitlist), so that there is no early waitlist loophole.
7. As a club organizer, I want beginners blocked from self-registering for positions games, so that inexperienced players do not fill competitive slots.
8. As a club organizer, I want level restrictions to apply only to positions games, so that recreational and priority players games stay open to everyone (subject to their existing timing rules).
9. As a club organizer, I want to turn all level restrictions on or off globally via deployment config, so that we can assign levels before enforcement goes live.
10. As a club organizer, I want restrictions off by default when the env var is unset, so that deploys do not accidentally enforce levels.

### Player levels — registration behavior

11. As a player, I do not want to see my level or anyone else's level in the app, so that the tier system stays internal.
12. As a beginner, I want the join button hidden on positions games when restrictions apply, so that I am not invited to register only to get an error.
13. As an intermediate player, I want the join button hidden until my registration window opens, so that the UX matches “registration not open yet.”
14. As a player already on the roster or waitlist for a positions game, I want to keep my spot if my level changes or restrictions turn on, so that I am not auto-removed.
15. As a player who left a positions game while blocked by level, I want to be unable to self-serve re-join while still blocked, so that leaving does not reset the gate.
16. As a beginner who cannot self-register, I want to be unable to register guests for that positions game, so that guests cannot bypass my block.
17. As a player who can self-register, I want guest registration to follow existing guest rules only, so that guest flow is unchanged.

### Player levels — admin UI

18. As a global administrator, I want the toolbar Players button to open a Players hub, so that I can choose between game administrators and player levels.
19. As a global administrator, I want a link to game administrators from the hub, so that existing workflows still work.
20. As a global administrator, I want a link to player levels from the hub, so that I can manage tiers in one place.
21. As a global administrator, I want a list of all registered users on the player levels page, so that I can see who needs a level.
22. As a global administrator, I want unassigned players listed first, then advanced, intermediate, beginner (alphabetical within each group), so that prioritization matches how we assign levels.
23. As a global administrator, I want each row to look like the game participants list (avatar, name), so that the UI is familiar.
24. As a global administrator, I want a read-only level pill on the right of each assigned row (light green / light yellow / light red), so that I can scan levels quickly.
25. As a global administrator, I want no pill on unassigned rows, so that unassigned players are visually distinct.
26. As a global administrator, I want to click a row to open the player info dialog, so that I can see the same details as on game pages.
27. As a global administrator, I want to set or change a player's level in that dialog with immediate save, so that assignment is quick.
28. As a global administrator, I want to switch between beginner, intermediate, and advanced only (no clear-to-unassigned), so that once labeled, players stay in the system.
29. As a global administrator, I want a name filter above the list, so that I can find players quickly.
30. As a global administrator, I want the full list to load in one request (~300 users) with client-side filtering, so that empty or broad search stays fast.
31. As a game administrator (non-global), I want no access to player levels or the Players hub, so that tiers remain global-admin-only.

### Game format

32. As a global administrator creating a game, I want one select with three options (recreational / positions / priority players), so that I cannot pick invalid combinations.
33. As a global administrator, I want “recreational game” naming instead of “regular game,” so that language matches how we talk about sessions.
34. As a global administrator, I want “priority players” games to mean priority registration windows without positions, so that Thursday-style priority lists apply to non-positions games.
35. As a global administrator, I want “positions” games to be the only format with position play, so that level restrictions have a clear target.
36. As a developer migrating data, I want legacy `withPositions=false, withPriorityPlayers=false` → `recreational`, `true/false` → `positions`, `false/true` → `priority_players`, and `true/true` → `recreational`, so that existing rows map cleanly.

### Game format — downstream behavior

37. As a player on a priority players game, I want existing 10-day / 3-day priority registration rules unchanged, so that deti-plova-style games behave as today.
38. As a player on a recreational game, I want no level-based registration gates, so that social games stay open.
39. As a player on a positions game, I want standard registration-open timing for advanced/unassigned unless level rules tighten it, so that intermediates get the 3-day window under restrictions.
40. As a global administrator, I want to add any player to any game via existing admin participant flows (past or readonly, no payment requests sent), without level checks overriding those gates, so that manual exceptions stay possible.

### API and consistency

41. As the registration API, I want to reject self-serve registration when level policy blocks it, so that clients cannot bypass hidden buttons.
42. As the game detail API, I want the client to know whether the current user can self-register (and when registration opens), so that the join button can be hidden consistently.
43. As a global administrator updating a player's level, I want the change persisted immediately via API, so that the list and dialog stay in sync.

## Implementation Decisions

### Deep module: positions game registration eligibility

Extract a **pure, testable module** (no DB/HTTP) that answers registration eligibility for self-serve flows:

**Inputs:** `gameFormat`, `playerLevel | null`, `restrictionsEnabled`, `gameDateTime`, `now`, `isGuestRegistration`, `hostCanSelfRegister` (for guests), `existingRegistration` (for grandfathering), `baseRegistrationOpensAt` (from existing priority/timing logic).

**Outputs:** `canSelfRegister: boolean`, `registrationOpensAt: Date | null` (for intermediate / timing alignment), `blockReason: 'level' | 'timing' | null` (internal; not exposed to end users).

**Rules encoded:**

| Level / state | Positions game + restrictions on |
|---------------|-----------------------------------|
| `null`, `advanced` | Allow (subject to base timing) |
| `intermediate` | Allow only when `now >= gameDateTime - 3 days` |
| `beginner` | Never allow self-serve |
| Already on roster/waitlist | Allow remaining on list; leaving triggers level-blocked re-registration |
| Guest | Allow only if `hostCanSelfRegister` |

Restrictions flag read once at process start from `POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED` (truthy: `true`, `1`; default false).

### Deep module: game format

Single enum on `games` replacing `withPositions` and `withPriorityPlayers`:

```ts
type GameFormat = 'recreational' | 'positions' | 'priority_players';
```

Helpers (testable):

- `gameFormatFromLegacy(withPositions: boolean, withPriorityPlayers: boolean): GameFormat`
- `isPositionsGame(format: GameFormat): boolean`
- `usesPriorityPlayerWindows(format: GameFormat): boolean` → `format === 'priority_players'`

Migration SQL: add column, backfill via mapping above, drop old columns. Journal via Drizzle.

### Schema: users

Add nullable `player_level` enum column: `beginner` | `intermediate` | `advanced`.

### Backend modules to build or modify

1. **Registration routes** — integrate eligibility module in `POST /games/:id/register` (and guest path); respect grandfathering via existing registration row check.
2. **Game detail route** — return `canSelfRegister` (and keep `registrationOpensAt` as the effective date for the current user on positions games).
3. **Player levels admin routes** (new, `isAdmin` middleware):
   - `GET /admin/users` — all users with public profile fields + `playerLevel`, sorted for admin list.
   - `PATCH /admin/users/:id/player-level` — body `{ playerLevel: 'beginner' | 'intermediate' | 'advanced' }`; reject null/clear.
4. **Games admin / games routes** — accept and persist `gameFormat`; update `getRegistrationOpenDays` to branch on `gameFormat` instead of booleans.
5. **Telegram / game services** — replace boolean checks with format helpers where announcements or filters reference positions or priority.
6. **Constants / config** — parse `POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED`.

### Frontend modules to build or modify

1. **Players hub page** — route `/players`, links to `/game-administrators` and `/player-levels`.
2. **Player levels page** — route `/player-levels`; grouped list component reusing participant row styling; level pills; name filter; wires to admin user API.
3. **Player info dialog** — level selector when opened from player levels page only; immediate PATCH on change.
4. **Game form** — replace two toggles with three-option select bound to `gameFormat`.
5. **Game details view model** — hide join button using `canSelfRegister` from API; hide guest affordances when host cannot self-register.
6. **Types / API client** — `gameFormat` on `Game`; remove deprecated booleans from client types after migration.
7. **Games list toolbar** — point Players icon to `/players`.

**Note:** `game_administrators.withPositions` remains a separate concept (which day/slot assignment); it is not the same as **game format** on a game instance.

### API contracts (summary)

- **Game** resource includes `gameFormat: 'recreational' | 'positions' | 'priority_players'` (no `withPositions` / `withPriorityPlayers` in API responses after migration).
- **Game detail** includes `canSelfRegister: boolean` for the authenticated user.
- **User (admin list)** includes `playerLevel: null | 'beginner' | 'intermediate' | 'advanced'`.
- **PATCH player level** — admin only; non-null enum only.

### UI specifics

- Level pills: advanced light green, intermediate light yellow, beginner light red; no pill if unassigned.
- Players hub title: “Players”; links “Game administrators” and “Player levels”.
- Do not expose level in any non-admin surface.

## Testing Decisions

**What makes a good test here:** Assert external behavior of pure functions and HTTP status/body edges — not implementation details like internal middleware order.

**Modules to test (recommended):**

1. **`positionsGameRegistrationEligibility`** (new unit tests) — matrix of level × format × restrictions × dates × grandfathering × guest/host; highest value, isolated.
2. **`gameFormat` helpers** (new unit tests) — legacy boolean migration mapping including `true/true` → `recreational`.
3. **Registration route integration** (optional, lighter) — a few supertest cases for 403 vs 201 on positions game when restrictions on.

**Prior art:** The repo currently has no automated backend test suite in `package.json`; introduce a minimal test runner (e.g. Node test runner or Vitest in backend) for the new pure modules first.

**Not prioritized for automated tests in v1:** React page layout, pill colors, dialog immediate-save UX (manual QA).

## Out of Scope

- Clearing a player level back to unassigned via admin UI.
- Per-game or per-day level overrides.
- Showing levels to non-admin users (including error messages that mention “beginner”).
- Changing `game_administrators` assignment model to use `gameFormat` enum (stays day + `withPositions` for slot).
- Enabling GitHub Issues or admin UI for the restrictions env toggle (env only).
- Auto-removing players from games when level or restrictions change.
- Level-based restrictions on guest skill (only host eligibility).
- Pagination/server-side search for player levels list (club size ~300; client filter only).

## Further Notes

- Domain glossary: `CONTEXT.md` at repo root (from grill-with-docs session).
- Feature branch: `cursor/player-levels-c8a4`.
- Related remote branch name spotted: `cursor/player-levels-five-one-spec-ee6d` — confirm not duplicate work before implementing.
- When GitHub Issues are enabled, create an issue from this file and label `enhancement` + `ready-for-agent`; remove other open triage state labels per triage skill.
