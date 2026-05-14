# Feature specification: Player skill levels for 5-1 game access

## Metadata

| Field | Value |
| --- | --- |
| **Feature branch** | `cursor/player-levels-five-one-spec-ee6d` |
| **Status** | Draft (specification only) |
| **Created** | 2026-05-14 |
| **Scope** | Backend, database, Telegram mini-app (global admin UI only) |

## Summary

Introduce three internal player levels (`beginner`, `intermediate`, `advanced`) plus an **unassigned** default for new accounts. Levels control access to **5-1 games** (games where `with_positions` / “5-1” is enabled in the existing data model). Levels must **not** appear anywhere in the UI for regular users and must **not** be exposed on general-purpose user APIs consumed by the mini-app. Only **global administrators** (`users.is_admin === true`, consistent with existing “global admin” patterns) may view and assign levels on a **dedicated admin page** listing all registered users. A **global toggle** must allow enabling or disabling all level-based restrictions for 5-1 games without a deployment, defaulting to **restrictions off** until operators explicitly turn them on.

## Definitions

- **5-1 game**: Any game where the existing `with_positions` flag is true (see `games.with_positions` in `backend/src/db/schema.ts` and registration logic in `backend/src/routes/games.ts`).
- **Global admin**: User with `is_admin` true; same authorization model as pages guarded with `user.isAdmin` in the mini-app (e.g. `GameAdministrators.tsx`).
- **Player level**: One of `beginner`, `intermediate`, `advanced`, or **null / unassigned** (no level stored).

## User stories

### P1 — Access rules when restrictions are enabled globally

1. **As a global admin**, I can turn 5-1 level restrictions on or off globally so we can roll out enforcement at a chosen time without code changes.
2. **As an advanced player** (when restrictions are on), I can join 5-1 games under the same registration timing rules as today (including waitlist behavior when full).
3. **As an intermediate player** (when restrictions are on), I can join a 5-1 game only starting **3 calendar days** before the game’s scheduled start time, and only if there is still at least one non-waitlist spot available; if the game is full, I may still join the **waitlist** (same ordering semantics as existing waitlist: first-come by `created_at`).
4. **As a beginner** (when restrictions are on), I **cannot** register for a 5-1 game (neither active roster nor waitlist) via the normal player registration flow.
5. **As a user with no level assigned** (when restrictions are on), I have the **same access as advanced** (unrestricted 5-1 access relative to these new rules), so legacy users and newcomers are not locked out until an admin assigns a restrictive level.

### P2 — Administration and privacy

6. **As a global admin**, I see a dedicated page listing **all** users in the system with their current level (including unassigned), and I can assign or change a user’s level.
7. **As a regular user**, I never see my level or anyone else’s level in the mini-app; profile and game UIs remain unchanged from a “level” perspective.
8. **As a non–global-admin** (including day administrators / assigned admins), I cannot open the levels admin page or call its APIs successfully.

### P3 — List ordering and defaults

9. **As a global admin**, the user list shows **unassigned** users first (any stable order within that group is acceptable; alphabetical by display name is recommended), then **advanced**, then **intermediate**, then **beginner**; within each of those three groups, users are sorted **alphabetically** by primary display name (case-insensitive), matching the product wording “from advanced to beginners” with unassigned on top.
10. **As the system**, new users are created **without** a level; no automatic assignment on signup.

## Functional requirements

### FR-1 — Data model

- Persist optional player level on the user record (e.g. nullable enum column on `users`), default **null** for new and existing rows until backfilled or set by an admin.
- Persist a single global boolean (or equivalent) such as **`five_one_level_restrictions_enabled`**, default **`false`**, so production behavior matches “restrictions postponed” until toggled.

### FR-2 — Restriction logic (only when global toggle is **true**)

Apply **only** when the target game is a 5-1 game (`with_positions === true`). Non–5-1 games are unaffected.

| Level / state | Join active roster | Join waitlist |
| --- | --- | --- |
| Unassigned | Allowed (same as pre-feature behavior for timing/spots) | Allowed |
| Advanced | Allowed | Allowed |
| Intermediate | Allowed only if `now >= gameStart - 3 calendar days` **and** current registered count for non-waitlist slots is strictly below `max_players` | Allowed even when full (subject to same `now >= gameStart - 3 days` window) |
| Beginner | Denied | Denied |

**Timing detail:** Use the same “calendar day subtraction” approach as existing registration windows (`setDate(getDate() - N)` relative to `game.date_time`), not wall-clock 72 hours, unless implementation audit shows existing product uses a different rule—in that case align with the dominant registration-open behavior in `games.ts` for consistency.

**Interaction with existing registration windows:** Evaluate player-level rules together with current `getRegistrationOpenDays` / priority-player logic. The spec requires that **advanced** and **unassigned** users are not more restricted than they are today by these new rules. [NEEDS CLARIFICATION] **Exact composition order** when both priority-based windows and intermediate 5-1 windows apply (e.g. take the more permissive window vs the stricter window) should be decided during implementation and covered by tests.

### FR-3 — Global toggle

- When **`five_one_level_restrictions_enabled` is `false`**, **no** beginner/intermediate/unassigned differentiation applies for 5-1 games; behavior matches the system **before** this feature for registration eligibility.
- When **`true`**, FR-2 applies.
- Only global admins may read or update the toggle (same as level assignment APIs).

### FR-4 — APIs (indicative)

- **Admin**: list all users with id, display identifiers used elsewhere, and `player_level` + maybe `telegram_username` for disambiguation—mirror fields already used on other admin surfaces; do **not** add level fields to public user DTOs.
- **Admin**: set user’s level to `beginner` | `intermediate` | `advanced` | `null` (clear).
- **Admin**: get/set global restriction toggle.

All endpoints must verify `req.user.isAdmin` (or shared middleware equivalent).

### FR-5 — Mini-app

- New route (e.g. `/player-levels` or `/admin/player-levels`) visible only when `user.isAdmin`, with a navigation entry in the same admin icon cluster as existing global-admin tools (see `GamesList.tsx` patterns).
- Page implements the sort order in FR P3.
- No changes to game cards, game details, category copy, or registration buttons that reveal level text to non-admins. If the API returns a rejection for beginners, use a **generic** message that does not mention “beginner” or internal level names (e.g. “You cannot register for this game.”).

### FR-6 — Security and privacy

- Do not include `player_level` in responses for normal authenticated routes used by the mini-app home/game flows (auth `/me`, game lists, registrations, etc.).
- Server must enforce FR-2 on **every** player-driven registration path for 5-1 games when the toggle is on (primary entry: `POST /games/:gameId/register` in `backend/src/routes/games.ts`). [NEEDS CLARIFICATION] Whether **admin bulk / past-game participant correction** routes should ignore level rules is assumed **yes** (organizer override); confirm with product owner.

## Success criteria (measurable)

- With toggle **off**, integration tests show 5-1 registration behavior unchanged from baseline for beginner/intermediate/advanced labels if assigned.
- With toggle **on**, an automated test matrix covers: beginner blocked; intermediate before T-3 days blocked for roster but can waitlist after T-3 when full; intermediate at T-3 with spots can roster; advanced/unassigned always pass level gate (subject only to existing timing rules).
- Non-admin API consumers never receive `player_level` in JSON for scoped manual review (contract test or snapshot of DTOs).
- Global admin page loads full user set in dev/staging with correct ordering for a fixture dataset.

## Key entities

- **User**: extended with optional `player_level`.
- **System setting**: single boolean controlling enforcement.
- **Game**: unchanged; 5-1 inferred from `with_positions`.

## Edge cases

- **User level changed after registration**: Do not retroactively remove existing registrations; restrictions apply at **registration attempt** time only (unless product later requests migration jobs).
- **Clock skew**: Use server time consistently with existing registration checks.
- **Guests on 5-1**: Apply the same permission gate to the **authenticated** user performing registration (if the acting user cannot join 5-1, they cannot add a guest to that game via the same flow). Aligns with treating “join” as the inviter’s action.

## Implementation notes (repository context)

- Registration and waitlist ordering live in `backend/src/routes/games.ts` (`POST /:gameId/register`).
- Global admin checks in UI: `user.isAdmin` in `tg-mini-app/src/pages/*`.
- User admin patterns: `backend/src/routes/usersAdmin.ts` for precedent on admin-only user operations.

## Out of scope (unless later specified)

- Showing level to assigned day administrators.
- Per-game overrides, appeals, or self-service level requests.
- Notifications explaining why a user was blocked (keep generic errors for privacy).
