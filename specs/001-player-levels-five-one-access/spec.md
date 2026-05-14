# Feature specification: Player skill levels for 5-1 game access

## Metadata

| Field | Value |
| --- | --- |
| **Feature branch** | `cursor/player-levels-five-one-spec-ee6d` |
| **Status** | Draft (specification only) |
| **Created** | 2026-05-14 |
| **Scope** | Backend, database, Telegram mini-app (global admin UI; game create/edit form); **user notifications** (Telegram / `notifyUser` and in-app/API errors aligned with them) |
| **Updated** | 2026-05-14 (game type select; admin bypass; notifications in scope) |

## Summary

Introduce three internal player levels (`beginner`, `intermediate`, `advanced`) plus an **unassigned** default for new accounts. Levels control access only to games in the **with positions (5-1)** play mode. Levels must **not** appear anywhere in the UI for regular users and must **not** be exposed on general-purpose user APIs consumed by the mini-app. Only **global administrators** (`users.is_admin === true`, consistent with existing “global admin” patterns) may view and assign levels on a **dedicated admin page** listing all registered users. A **global toggle** must allow enabling or disabling all level-based restrictions for 5-1 games without a deployment, defaulting to **restrictions off** until operators explicitly turn them on.

**Notifications** are **in scope**: whenever player-level rules (FR-2) deny or defer registration for a **with positions** game while the global toggle is on, the product must define **user-facing messages** (API errors and Telegram where applicable) that explain the situation in plain language **without** naming internal levels (`beginner`, `intermediate`, `advanced`). Successful registration and waitlist flows continue to use the existing notification patterns (`notifyUser` in `backend/src/routes/games.ts`, `notificationService.ts`), extended only where needed for consistency with the new rules (e.g. include a formatted “opens at” date when the user is too early for roster or waitlist under FR-2).

**Game configuration change:** Replace the two independent booleans (`with_positions`, `with_priority_players`) with a **single control**—a select whose options are **with positions** (5-1), **with priority players** (non–5-1 games that use the priority registration window), and **regular game** (neither). Exactly one mode applies per game, so priority timing and 5-1 positioning are never combined on the same row.

## Definitions

- **Game play mode** (exactly one per game): **With positions** (5-1 scheme), **with priority players** (standard game using priority-player registration windows), or **regular game** (standard game without priority windows). This replaces the current pair of flags on `games` (see `backend/src/db/schema.ts`).
- **5-1 game**: Any game whose play mode is **with positions** (5-1). Player-level restrictions (FR-2) apply only to this mode when the global toggle is on.
- **Global admin**: User with `is_admin` true; same authorization model as pages guarded with `user.isAdmin` in the mini-app (e.g. `GameAdministrators.tsx`).
- **Player level**: One of `beginner`, `intermediate`, `advanced`, or **null / unassigned** (no level stored).

## User stories

### P1 — Access rules when restrictions are enabled globally

1. **As a global admin**, I can turn 5-1 level restrictions on or off globally so we can roll out enforcement at a chosen time without code changes.
2. **As an advanced player** (when restrictions are on), I can join 5-1 games under the same registration timing rules as today for that play mode (including waitlist behavior when full).
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

11. **As a global admin creating or editing a game**, I choose **one** play mode from a single select: **with positions**, **with priority players**, or **regular game**—not two separate checkboxes.

### P4 — Notifications (player-facing, privacy-safe)

12. **As a player** blocked or deferred by FR-2 when registering for a **with positions** game (restrictions on), I receive a **clear Telegram notification** (when the user has a deliverable Telegram or phone channel per existing `notifyUser` rules) and a **consistent API error** in the mini-app, so I understand what happened without seeing internal level names.
13. **As a player** who successfully registers or joins the waitlist under the new rules, I receive the **same style of success/waitlist Telegram messages** as today, unless copy must be adjusted to avoid implying incorrect rules—any adjustment must still avoid internal level vocabulary.

## Functional requirements

### FR-0 — Game play mode (schema and UI)

- Replace the independent `with_positions` and `with_priority_players` columns with a **single persisted field** (recommended: enum / constrained varchar on `games`), or enforce a single effective mode with a DB constraint and migration from the two legacy booleans.
- Allowed values map to the product select: **with positions** (5-1), **with priority players**, **regular game**.
- **Invariant:** A game is never both “with positions” and “with priority players”; those capabilities are mutually exclusive by design.
- **Mini-app:** In game create/edit (e.g. `tg-mini-app/src/components/GameFormFields.tsx`), replace the two checkboxes with **one** `<select>` (or an equally exclusive control) bound to that field.
- **API:** Create/update game payloads expose one mode value; server rejects ambiguous or combined legacy shapes if any transitional API remains.
- **Data migration:** Map existing rows: `(with_positions=true)` → with positions; `(with_positions=false, with_priority_players=true)` → with priority players; `(false, false)` → regular game. If any legacy row has both booleans true (should be rare), migrate to **with positions** and log or fix in a one-off migration note.

### FR-1 — Data model (users and system)

- Persist optional player level on the user record (e.g. nullable enum column on `users`), default **null** for new and existing rows until backfilled or set by an admin.
- Persist a single global boolean (or equivalent) such as **`five_one_level_restrictions_enabled`**, default **`false`**, so production behavior matches “restrictions postponed” until toggled.

### FR-2 — Restriction logic (only when global toggle is **true**)

Apply **only** when the target game’s play mode is **with positions** (5-1). Games in **with priority players** or **regular game** modes are unaffected by player-level rules (they continue to use the existing registration timing logic for those modes only).

| Level / state | Join active roster | Join waitlist |
| --- | --- | --- |
| Unassigned | Allowed (same as pre-feature behavior for timing/spots) | Allowed |
| Advanced | Allowed | Allowed |
| Intermediate | Allowed only if `now >= gameStart - 3 calendar days` **and** current registered count for non-waitlist slots is strictly below `max_players` | Allowed even when full (subject to same `now >= gameStart - 3 days` window) |
| Beginner | Denied | Denied |

**Timing detail:** Use the same “calendar day subtraction” approach as existing registration windows (`setDate(getDate() - N)` relative to `game.date_time`), not wall-clock 72 hours, unless implementation audit shows existing product uses a different rule—in that case align with the dominant registration-open behavior in `games.ts` for consistency.

**Composition with priority windows:** Not applicable on a single game: **with positions** and **with priority players** are separate play modes (FR-0). Intermediate player rules (FR-2) apply **only** on **with positions** games, alongside the normal registration-open logic already used for 5-1 games in that mode. Priority-player timing applies **only** on **with priority players** games and does not interact with player-level gates.

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
- Global-admin game create/edit implements the **play mode** select per FR-0 (this is not a “player level” surface; it replaces two booleans with one control).
- No changes to game cards, game details, category copy, or registration flows that **reveal player skill level** to non-admins. If the API returns a rejection for beginners, use a **generic** message that does not mention “beginner” or internal level names (e.g. “You cannot register for this game.”); see **FR-7** for Telegram alignment.

### FR-6 — Security and privacy

- Do not include `player_level` in responses for normal authenticated routes used by the mini-app home/game flows (auth `/me`, game lists, registrations, etc.).
- Server must enforce FR-2 on **every** player-driven registration path for **with positions** games when the toggle is on (primary entry: `POST /games/:gameId/register` in `backend/src/routes/games.ts`).
- **Admin backfill / correction:** Routes used by global or assigned admins to add or adjust participants outside the normal player flow (including **past-game participant** endpoints in `backend/src/routes/gamesAdmin.ts`, e.g. `POST /:gameId/participants`) **must bypass all player-level checks** entirely, regardless of global toggle state.

### FR-7 — Notifications (Telegram and API consistency)

- **In scope:** All player-visible outcomes of FR-2 on the normal registration path (`POST /games/:gameId/register` and any shared helper that enforces the same rules), including Telegram delivery via **`notifyUser`** (`backend/src/services/notificationService.ts`, used from `backend/src/routes/games.ts`) where the user is eligible for notifications today.
- **Privacy:** User-facing strings (Telegram HTML and JSON `error` bodies) must **not** contain internal level identifiers or labels (`beginner`, `intermediate`, `advanced`, database enum values). Use neutral copy: e.g. for “too early for this game type” include the computed **registration opens at** timestamp/date; for “not eligible for this game type” use a short explanation that points to organizers or existing group norms without naming a stored level.
- **Denial / deferral:** When FR-2 rejects a registration attempt, send a Telegram message **in addition to** the HTTP error response (unless `notifyUser` is suppressed in dev mode—then behavior matches existing notification suppression). Reuse one shared wording source where possible so API and Telegram do not drift.
- **Success unchanged:** Successful roster and waitlist registrations keep the existing success/waitlist notification behavior unless a wording tweak is required for factual accuracy; do not introduce level names there.
- **Out of scope for notifications:** Marketing pushes, digest emails, and **admin-only** audit logs (optional later). Optional “notify user when an admin changes their level” is **not** required for the first delivery unless time permits—if implemented, messages must still follow the same **no internal level names** rule.

## Success criteria (measurable)

- Game create/edit exposes exactly one play-mode control; persisted data never represents an illegal combination of “5-1” and “priority” on the same game.
- With toggle **off**, integration tests show 5-1 registration behavior unchanged from baseline for beginner/intermediate/advanced labels if assigned.
- With toggle **on**, an automated test matrix covers: beginner blocked; intermediate before T-3 days blocked for roster but can waitlist after T-3 when full; intermediate at T-3 with spots can roster; advanced/unassigned always pass level gate (subject only to existing timing rules).
- Non-admin API consumers never receive `player_level` in JSON for scoped manual review (contract test or snapshot of DTOs).
- Global admin page loads full user set in dev/staging with correct ordering for a fixture dataset.
- With toggle **on** and restrictions firing, automated or manual QA confirms: (a) Telegram + API copy for FR-2 denials contain **no** internal level vocabulary; (b) successful register/waitlist still receives notifications consistent with pre-feature behavior.

## Key entities

- **User**: extended with optional `player_level`.
- **System setting**: single boolean controlling enforcement.
- **Game**: one **play mode** field (replacing the pair `with_positions` + `with_priority_players`); 5-1 behavior and level gates key off the **with positions** mode only.

## Edge cases

- **User level changed after registration**: Do not retroactively remove existing registrations; restrictions apply at **registration attempt** time only (unless product later requests migration jobs).
- **Clock skew**: Use server time consistently with existing registration checks.
- **Guests on 5-1**: Apply the same permission gate to the **authenticated** user performing registration (if the acting user cannot join 5-1, they cannot add a guest to that game via the same flow). Aligns with treating “join” as the inviter’s action.

## Implementation notes (repository context)

- Registration and waitlist ordering live in `backend/src/routes/games.ts` (`POST /:gameId/register`); `getRegistrationOpenDays` and related helpers branch on priority vs non-priority—those branches map to play mode after FR-0. Registration notifications and new FR-2 denial notifications should route through **`notifyUser`** like existing register success/failure patterns in the same file.
- Game admin create/update: `backend/src/routes/gamesAdmin.ts`; form state: `tg-mini-app/src/viewmodels/GameFormViewModel.ts` and `GameFormFields.tsx`.
- Global admin checks in UI: `user.isAdmin` in `tg-mini-app/src/pages/*`.
- User admin patterns: `backend/src/routes/usersAdmin.ts` for precedent on admin-only user operations.
- **Game administrators** (`game_administrators.with_positions`) remain a boolean axis for “5-1 vs non–5-1 day assignment”; align it with the new play mode naming in UI copy only, or keep boolean semantics where `true` means “5-1 track” for that assignment (implementation detail).

## Out of scope (unless later specified)

- Showing level to assigned day administrators.
- Per-game overrides, appeals, or self-service level requests.
- **Surfacing internal level names** (`beginner`, `intermediate`, `advanced`, raw enum values) in user-facing Telegram or mini-app copy—disallowed; use FR-7-style explanatory text instead.
