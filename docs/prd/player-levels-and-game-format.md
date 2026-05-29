# Player levels, game format, and Technical Committee role

**Implementation branch:** `cursor/player-levels-issue8-dbd5` (base: `cursor/recursive-ralph-babb`)  
**Parent issue:** #8  
**Domain glossary:** `CONTEXT.md` (repo root)  
**Full PRD file:** `docs/prd/player-levels-and-game-format.md`

## Problem Statement

The club runs **positions games** (games with assigned positions) alongside **recreational games** and **priority players games** (early registration windows without positions). There is no structured way to restrict who can self-register for positions games by skill tier, while keeping that information invisible to regular players. Operators also need a phased rollout: assign levels first, turn enforcement on later.

Player levels are today manageable only by **global administrators**. The **Technical Committee** needs to assign and review tiers without full club-admin access. **Assigned game administrators** must not see or change levels unless they are also TC members or global admins.

Separately, game creation uses two independent booleans (`withPositions`, `withPriorityPlayers`) that are confusing and allow meaningless combinations. The domain model should express three mutually exclusive **game formats**.

## Solution

Introduce **player levels** (`beginner`, `intermediate`, `advanced`, or unassigned) managed by **global administrators** and **Technical Committee members** (`is_tc` on the user record; set manually in the database). Record **who last set each player’s level** (setter display name only in the UI). Provide a **player levels page** with name and level filters, plus **player info dialog** behavior driven by the viewer’s role.

**Global administrators** retain full admin capabilities and inherit all TC level capabilities. **Technical Committee members** who are not global admins: toolbar **Players** goes directly to the player levels page; no **Players hub**, game administrators, or priority players routes; on **game details** they may tap participants to open a scoped dialog (read-only level outside the player levels page) without other game-admin actions.

Self-serve registration for **positions games** still uses server-computed `canSelfRegister` on game detail; `playerLevel` is not exposed on `/users/me` for any user.

Replace the two game booleans with a single **game format** enum: `recreational`, `positions`, `priority_players`. **Global administrators** use a **Players hub** linking game administrators and player levels.

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

### Player levels — admin UI (global administrator)

18. As a global administrator, I want the toolbar Players button to open a Players hub, so that I can choose between game administrators and player levels.
19. As a global administrator, I want a link to game administrators from the hub, so that existing workflows still work.
20. As a global administrator, I want a link to player levels from the hub, so that I can manage tiers in one place.
21. As a global administrator, I want a list of all registered users on the player levels page, so that I can see who needs a level.
22. As a global administrator, I want unassigned players listed first, then advanced, intermediate, beginner (alphabetical within each group), so that prioritization matches how we assign levels.
23. As a global administrator, I want each row to look like the game participants list (avatar, name), so that the UI is familiar.
24. As a global administrator, I want a read-only level pill on the right of each assigned row (light green / light yellow / light red), so that I can scan levels quickly.
25. As a global administrator, I want no pill on unassigned rows, so that unassigned players are visually distinct.
26. As a global administrator, I want to click a row to open the player info dialog, so that I can see the same details as on game pages.
27. As a global administrator, I want to set or change a player's level on the player levels page (dialog with immediate save), so that assignment is quick.
28. As a global administrator, I want to switch between beginner, intermediate, and advanced only (no clear-to-unassigned), so that once labeled, players stay in the system.
29. As a global administrator or technical committee member, I want a name filter above the list, so that I can find players quickly.
30. As a global administrator or technical committee member, I want the full list to load in one request (~300 users) with client-side filtering, so that empty or broad search stays fast.
31. As a global administrator or technical committee member, I want a level filter on the player levels page (All, Unassigned, Advanced, Intermediate, Beginner), so that I can focus on one tier at a time.
32. As a global administrator or technical committee member, I want the level filter to apply together with the name filter, so that I can narrow to specific players within a tier.
33. As a global administrator or technical committee member, I want to see who last set each player's level (display name only) on the player levels list and in the player info dialog, so that we know who assigned the tier.
34. As a global administrator, I want to see read-only player level and assignment record in the player info dialog when I open it outside the player levels page, so that I can check tiers in context without accidental edits.
35. As a global administrator, I want the full player info dialog (unpaid games, payment reminders, block/unblock) when I am not acting as a TC-only viewer, so that existing admin workflows continue.

### Technical Committee role

36. As a technical committee member, I want my role stored as `is_tc` on my user record (set in the database by operators), so that the app can grant level stewardship without making me a global administrator.
37. As a technical committee member who is not a global administrator, I want the toolbar Players button to open the player levels page directly, so that I am not shown the Players hub or game-administrator links I must not use.
38. As a technical committee member, I want to list, filter, and assign player levels on the player levels page, so that I can do the committee’s tier work.
39. As a technical committee member, I want the player info dialog to show only identity, player level, and who set the level (no unpaid games, payment reminders, or block/unblock), so that I am not exposed to unrelated admin tools.
40. As a technical committee member, I want player level editable only when the dialog is opened from the player levels page, and read-only when opened from game details or other surfaces, so that bulk assignment stays on the management page.
41. As a technical committee member, I want to tap a participant on game details to open the player info dialog (read-only level), without gaining remove-player, guest, or payment admin actions, so that I can check tiers at a game without running the game.
42. As a technical committee member, I want to see “Unassigned” for players with no level, so that newcomers are clearly distinguished.
43. As a technical committee member, I want no “Set by” line until a level has been assigned, so that the audit line is meaningful.

### Assigned game administrator (restricted admin)

44. As an assigned game administrator who is not a technical committee member or global administrator, I want no access to player levels, the Players hub, or level fields in the player info dialog, so that tiers stay with the committee and global admins.
45. As an assigned game administrator, I want my existing game-admin dialog (payments, moderation where applicable) unchanged and without level fields, so that day-to-day game running is separate from tier management.

### Game format

46. As a global administrator creating a game, I want one select with three options (recreational / positions / priority players), so that I cannot pick invalid combinations.
47. As a global administrator, I want “recreational game” naming instead of “regular game,” so that language matches how we talk about sessions.
48. As a global administrator, I want “priority players” games to mean priority registration windows without positions, so that Thursday-style priority lists apply to non-positions games.
49. As a global administrator, I want “positions” games to be the only format with position play, so that level restrictions have a clear target.
50. As a developer migrating data, I want legacy `withPositions=false, withPriorityPlayers=false` → `recreational`, `true/false` → `positions`, `false/true` → `priority_players`, and `true/true` → `recreational`, so that existing rows map cleanly.

### Game format — downstream behavior

51. As a player on a priority players game, I want existing 10-day / 3-day priority registration rules unchanged, so that deti-plova-style games behave as today.
52. As a player on a recreational game, I want no level-based registration gates, so that social games stay open.
53. As a player on a positions game, I want standard registration-open timing for advanced/unassigned unless level rules tighten it, so that intermediates get the 3-day window under restrictions.
54. As a global administrator, I want to add any player to any game via existing admin participant flows (past or readonly, no payment requests sent), without level checks overriding those gates, so that manual exceptions stay possible.

### API and consistency

55. As the registration API, I want to reject self-serve registration when level policy blocks it, so that clients cannot bypass hidden buttons.
56. As the game detail API, I want the client to know whether the current user can self-register (and when registration opens) without exposing player level on `/users/me`, so that join buttons are correct but tiers stay hidden.
57. As a global administrator or technical committee member updating a player's level, I want the change persisted immediately via API with an updated assignment record, so that the list and dialog stay in sync.
58. As a technical committee member opening a player from game details, I want to load that user's level profile via a dedicated admin GET by user id, so that levels are not embedded on public participant payloads.
59. As the authenticated client, I want `/users/me` to include `isTc` (and `isAdmin`) but not my own `playerLevel`, so that routing and checks work without revealing tiers in session data.

## Implementation Decisions

### Roles and authorization

- **`is_tc`** boolean on `users`, default false; granted/revoked only via database (no in-app UI or API).
- **Level steward** access: `isAdmin || isTc` for player-levels admin routes and for viewing level fields in the player info dialog.
- **Global administrator** (`isAdmin`): all TC capabilities plus Players hub, payments, moderation, and other existing global-admin routes.
- **Assigned game administrator**: unchanged game-admin powers; no level fields unless also steward.
- Replace global-admin-only middleware on player-levels routes with steward middleware (`tcOrAdminAuth` or equivalent).

### Schema: users (TC and audit)

- Existing nullable `player_level`: `beginner` | `intermediate` | `advanced`.
- Add **`is_tc`** boolean, not null, default false.
- Add **`player_level_set_by_id`** (nullable FK to users) and **`player_level_set_at`** (timestamp); update on every successful level PATCH (including first assignment).

### Deep module: positions game registration eligibility

Pure, testable module (no DB/HTTP) for self-serve registration eligibility.

**Inputs:** `gameFormat`, `playerLevel | null`, `restrictionsEnabled`, `gameDateTime`, `now`, `isGuestRegistration`, `hostCanSelfRegister`, `existingRegistration`, `baseRegistrationOpensAt`.

**Outputs:** `canSelfRegister: boolean`, `registrationOpensAt: Date | null`, internal `blockReason` (not exposed to end users).

Restrictions flag from `POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED` (default off). Game detail loads the current user’s level server-side and returns only `canSelfRegister` / `registrationOpensAt`.

### Deep module: game format

```ts
type GameFormat = 'recreational' | 'positions' | 'priority_players';
```

Helpers: `gameFormatFromLegacy`, `isPositionsGame`, `usesPriorityPlayerWindows`. Migration backfills and drops legacy booleans.

### Backend modules to build or modify

1. **Registration routes** — eligibility module; grandfathering via existing registration row.
2. **Game detail route** — `canSelfRegister` / `registrationOpensAt`; do not add `playerLevel` to registration user objects.
3. **Player levels admin routes** — steward auth:
   - `GET /player-levels/users` — full list with `playerLevel`, `playerLevelSetBy: { displayName } | null`
   - `GET /player-levels/users/:userId` — single **player level profile** for lazy dialog load
   - `PATCH /player-levels/users/:userId` — non-null enum only; set audit fields to current user
4. **`/users/me` (auth user response)** — include `isTc`; strip `playerLevel` for all users.
5. **Games / games admin** — `gameFormat`; registration-open-days by format.
6. **Config** — `POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED`.

### Frontend modules to build or modify

1. **Routing / toolbar** — if `isTc && !isAdmin`, **Players** → `/player-levels`; block or redirect TC-only from `/players`, `/game-administrators`, `/priority-players`. Global admin unchanged.
2. **Player levels page** — allow `isTc`; name + level filters (client-side); list shows level pills and “Set by {name}” where applicable; row opens dialog with **editable** level.
3. **Player info dialog** — sections by **viewer role only** (same at every entry point):
   - Global admin: full dialog including editable level only when `allowLevelEdit` (player levels page); read-only level + audit elsewhere
   - TC (not global admin): identity + level + audit only; editable only with `allowLevelEdit`
   - Assigned admin (not steward): no level section
   - Lazy load profile via `GET /player-levels/users/:userId` when dialog opens without list row data
4. **Game details** — `canOpenPlayerInfo = isGameAdmin || isTc` for roster/waitlist taps; TC does not receive other game-admin UI flags from `isGameAdmin`.
5. **Game form, game details view model, types/API client** — as in game-format slice; add `isTc` to session user type.

### API contracts (summary)

- **Game:** `gameFormat`, `canSelfRegister`, `registrationOpensAt` for current user.
- **Auth user (`/users/me`):** `isAdmin`, `isTc`; no `playerLevel`.
- **Player levels list item / profile:** `playerLevel`, `playerLevelSetBy: { displayName } | null`, plus existing public identity fields used in admin UI.
- **PATCH player level:** steward only; non-null enum; updates audit columns.

### UI specifics

- Level pills: advanced light green, intermediate light yellow, beginner light red; no pill if unassigned; stewards see “Unassigned” where applicable.
- Player levels filters: name search + level (All / Unassigned / Advanced / Intermediate / Beginner); combined client-side; default All.
- Assignment audit in UI: setter **display name only** (no timestamp).
- Players hub: global administrators only.
- Do not expose level on participant payloads, game list, or non-steward surfaces.

## Testing Decisions

**Good tests:** External behavior of pure functions and HTTP status/body — not middleware order or React structure.

**Modules to test (recommended):**

1. **`positionsGameRegistrationEligibility`** — level × format × restrictions × dates × grandfathering × guest/host.
2. **`gameFormat` helpers** — legacy boolean mapping.
3. **Steward authorization** — player-levels routes return 403 for assigned-only admin, 200 for `isTc` / `isAdmin`.
4. **PATCH player level** — updates `player_level`, `player_level_set_by_id`, `player_level_set_at`; response includes setter display name.
5. **Registration route integration** (optional) — 403 vs 201 on positions game when restrictions on.

**Prior art:** Domain unit tests under `backend/src/domain/`; E2E `e2e/player-levels.spec.ts` (extend for TC scenarios).

**Not prioritized for v1 automated tests:** Dialog layout, pill colors, filter control widget type (manual QA).

## Out of Scope

- In-app UI or API to grant/revoke `is_tc` (database only).
- Clearing a player level back to unassigned via admin UI.
- Per-game or per-day level overrides.
- Showing levels to non-stewards (including error messages that name a tier).
- Embedding `playerLevel` on game registration / participant JSON.
- TC access to Players hub, game administrators, or priority players admin pages.
- TC gaining game-admin actions (remove player, guests, Bunq) without a separate assignment or global admin role.
- Admin UI for the restrictions env toggle.
- Auto-removing players from games when level or restrictions change.
- Pagination/server-side search for player levels list (~300 users; client filter only).
- Showing assignment timestamp in the UI.

## Further Notes

- Domain terms and resolutions: `CONTEXT.md`.
- Epic #8 slices #20–#22 cover game format, initial global-admin player levels, and enforcement; **TC role** is a follow-on on `cursor/player-levels-issue8-dbd5`.
- Reference implementation patterns exist on branch `cursor/player-levels-epic8-ad37` (PR #37) for prior TC work; implement against current branch and this PRD.
- Story numbering in this file is contiguous; child GitHub issues may use their own numbers.
