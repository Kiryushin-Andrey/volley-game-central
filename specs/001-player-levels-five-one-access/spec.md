# Feature specification: Player skill levels for 5-1 game access

## Metadata

| Field | Value |
| --- | --- |
| **Feature branch** | `cursor/player-levels-five-one-spec-ee6d` |
| **Status** | Draft (specification only) |
| **Created** | 2026-05-14 |
| **Scope** | Backend, database, Telegram mini-app (global admin UI; game create/edit form; **game details join UX for blocked users**); **FR-2 registration errors** (HTTP JSON + mini-app copy; **no** Telegram on failed register) |
| **Updated** | 2026-05-14 (blocked user: hide Join + inline reason; API second line) |

## Summary

Introduce three internal player levels (`beginner`, `intermediate`, `advanced`) plus an **unassigned** default for new accounts. Levels control access only to games in the **with positions (5-1)** play mode. Levels must **not** appear anywhere in the UI for regular users and must **not** be exposed on general-purpose user APIs consumed by the mini-app. Only **global administrators** (`users.is_admin === true`, consistent with existing “global admin” patterns) may view and assign levels on a **dedicated admin page** listing all registered users. Whether FR-2 restrictions apply is controlled by a **hardcoded boolean in backend source** (default **off** until the team flips it in code for rollout). For **testing without code changes**, an **environment variable** may override that default (see FR-3). **No** database table, admin API, or mini-app control for this switch.

**FR-2 denials:** When player-level rules block registration for a **with positions** game with enforcement **on**, the product must return **clear HTTP error payloads** (and matching mini-app handling) **without** naming internal levels (`beginner`, `intermediate`, `advanced`). **Do not** send Telegram (or other push) for these failed registration attempts—same as other registration rejection paths today. **Successful** roster and waitlist registrations continue to use existing **`notifyUser`** patterns in `backend/src/routes/games.ts`.

**Game configuration change:** Replace the two independent booleans (`with_positions`, `with_priority_players`) with a **single control**—a select whose options are **with positions** (5-1), **with priority players** (non–5-1 games that use the priority registration window), and **regular game** (neither). Exactly one mode applies per game, so priority timing and 5-1 positioning are never combined on the same row.

## Clarifications

### Session 2026-05-14

- Q: How must FR-2 (player level) interact with the existing registration-open window (`getRegistrationOpenDays` / `registrationOpensAt` for the game’s play mode)? → A: **All checks apply (logical AND).** The player must already be allowed by today’s registration timing rules for that game; FR-2 then **adds** beginner/intermediate constraints on top. For **with positions** games without priority mode, the general open instant is earlier than the intermediate FR-2 instant; the effective moment an intermediate user may first register is the **later** of the two instants (the stricter combined gate).
- Q: Should repeated FR-2 registration failures spam Telegram? → A: **No Telegram on FR-2 denials** (or any registration rejection). Only the HTTP response / mini-app surface informs the user; no dedupe logic required for push on denial.
- Q: Should HTTP responses expose machine-readable codes for FR-2 denials (for the mini-app and tests)? → A: **Yes:** include stable `code` values (e.g. `FIVE_ONE_LEVEL_NOT_ELIGIBLE`, `FIVE_ONE_LEVEL_WINDOW`) plus `registrationOpensAt` when the denial is time-window based, mirroring the shape used for early registration errors today.
- Q: Must create/update game APIs accept the old `with_positions` / `with_priority_players` request shape? → A: **No.** Backend and mini-app deploy **together**; only the new **play mode** field (single value) is accepted on write—no transitional dual-boolean payloads.
- Q: Must the global-admin “all users” list API handle large user tables? → A: **Paginated admin API** (page or cursor) with default limit **100** rows and optional `q` search on display name / telegram username; the mini-app page loads pages (or infinite scroll) so the server never returns an unbounded full user set.
- Q: Should the 5-1 enforcement switch be stored in the database or exposed via admin API? → A: **No.** Use a **hardcoded backend default** (flip in source + deploy for rollout) and an optional **environment variable** to override the default for testing; no persisted settings entity and no HTTP/mini-app control.
- Q: When a user is blocked (`blockReason`), how should join behave in the mini-app? → A: **Hide Join Game** (and self-serve guest entry) **completely**; show an **inline note** with the reason using the **same pattern** as registration-not-yet-open; keep **403** on register as the **second line of defense**.

## Definitions

- **Game play mode** (exactly one per game): **With positions** (5-1 scheme), **with priority players** (standard game using priority-player registration windows), or **regular game** (standard game without priority windows). This replaces the current pair of flags on `games` (see `backend/src/db/schema.ts`).
- **5-1 game**: Any game whose play mode is **with positions** (5-1). Player-level restrictions (FR-2) apply only to this mode when enforcement is on (FR-3).
- **Global admin**: User with `is_admin` true; same authorization model as pages guarded with `user.isAdmin` in the mini-app (e.g. `GameAdministrators.tsx`).
- **Player level**: One of `beginner`, `intermediate`, `advanced`, or **null / unassigned** (no level stored).

## User stories

### P1 — Access rules when restrictions are enabled globally

1. **As an operator**, I enable or disable 5-1 level enforcement by **changing the hardcoded flag** (and redeploying) when we are ready to roll out; I can use an **env override** in staging or locally to exercise “on” behaviour without editing the default constant.
2. **As an advanced player** (when enforcement is on), I can join 5-1 games under the same registration timing rules as today for that play mode (including waitlist behavior when full).
3. **As an intermediate player** (when enforcement is on), I can join a 5-1 game only starting **3 calendar days** before the game’s scheduled start time, and only if there is still at least one non-waitlist spot available; if the game is full, I may still join the **waitlist** (same ordering semantics as existing waitlist: first-come by `created_at`).
4. **As a beginner** (when enforcement is on), I **cannot** register for a 5-1 game (neither active roster nor waitlist) via the normal player registration flow.
5. **As a user with no level assigned** (when enforcement is on), I have the **same access as advanced** (unrestricted 5-1 access relative to these new rules), so legacy users and newcomers are not locked out until an admin assigns a restrictive level.

### P2 — Administration and privacy

6. **As a global admin**, I see a dedicated page to browse **the full user directory** with pagination (or infinite scroll), with correct grouping/sort (P3), and I can assign or change a user’s level.
7. **As a regular user**, I never see my level or anyone else’s level in the mini-app; profile and game UIs remain unchanged from a “level” perspective.
8. **As a non–global-admin** (including day administrators / assigned admins), I cannot open the levels admin page or call its APIs successfully.

### P3 — List ordering and defaults

9. **As a global admin**, the user list shows **unassigned** users first (any stable order within that group is acceptable; alphabetical by display name is recommended), then **advanced**, then **intermediate**, then **beginner**; within each of those three groups, users are sorted **alphabetically** by primary display name (case-insensitive), matching the product wording “from advanced to beginners” with unassigned on top.
10. **As the system**, new users are created **without** a level; no automatic assignment on signup.

11. **As a global admin creating or editing a game**, I choose **one** play mode from a single select: **with positions**, **with priority players**, or **regular game**—not two separate checkboxes.

### P4 — Player-facing errors and success notifications

12. **As a player** blocked or deferred by FR-2 when registering for a **with positions** game (enforcement on), I see a **consistent API error** in the mini-app (and HTTP body) that explains the situation in plain language **without** internal level names—**no** Telegram or other push for this failure.
13. **As a player** who successfully registers or joins the waitlist, I still receive the **same Telegram success/waitlist messages** as today (`notifyUser`), unless copy must be tweaked for accuracy—never with internal level vocabulary.

### P5 — Blocked users (game join UX)

14. **As a blocked user** (`blockReason` set on my session / user profile), when I open an upcoming game I am **not** registered for, I **do not** see a **Join Game** button at all; instead I see an **inline note** with the block reason, using the **same presentation pattern** as when registration is not open yet (e.g. the existing info text area used for “registration opens on …” on game details).
15. **As a blocked user**, I **cannot** trigger self-registration via the primary join flow; if a request still reaches the API, I receive **403** with the existing error payload (**second line of defense**—unchanged server behavior).

## Functional requirements

### FR-0 — Game play mode (schema and UI)

- Replace the independent `with_positions` and `with_priority_players` columns with a **single persisted field** (recommended: enum / constrained varchar on `games`), or enforce a single effective mode with a DB constraint and migration from the two legacy booleans.
- Allowed values map to the product select: **with positions** (5-1), **with priority players**, **regular game**.
- **Invariant:** A game is never both “with positions” and “with priority players”; those capabilities are mutually exclusive by design.
- **Mini-app:** In game create/edit (e.g. `tg-mini-app/src/components/GameFormFields.tsx`), replace the two checkboxes with **one** `<select>` (or an equally exclusive control) bound to that field.
- **API:** Create/update game payloads accept **only** the new single play-mode field (e.g. `playMode` / agreed name). **Do not** accept `with_positions` / `with_priority_players` on write; backend and mini-app ship in the same deploy.
- **Data migration:** Map existing rows: `(with_positions=true)` → with positions; `(with_positions=false, with_priority_players=true)` → with priority players; `(false, false)` → regular game. If any legacy row has both booleans true (should be rare), migrate to **with positions** and log or fix in a one-off migration note.

### FR-1 — Data model (users)

- Persist optional player level on the user record (e.g. nullable enum column on `users`), default **null** for new and existing rows until backfilled or set by an admin.
- **Do not** add any database column or table for “restrictions enabled”; see FR-3.

### FR-2 — Restriction logic (only when enforcement is **on**)

Apply **only** when the target game’s play mode is **with positions** (5-1) **and** FR-3 reports enforcement **on**. Games in **with priority players** or **regular game** modes are unaffected by player-level rules (they continue to use the existing registration timing logic for those modes only).

| Level / state | Join active roster | Join waitlist |
| --- | --- | --- |
| Unassigned | Allowed (same as pre-feature behavior for timing/spots) | Allowed |
| Advanced | Allowed | Allowed |
| Intermediate | Allowed only if `now >= gameStart - 3 calendar days` **and** current registered count for non-waitlist slots is strictly below `max_players` | Allowed even when full (subject to same `now >= gameStart - 3 days` window) |
| Beginner | Denied | Denied |

**Timing detail:** Use the same “calendar day subtraction” approach as existing registration windows (`setDate(getDate() - N)` relative to `game.date_time`), not wall-clock 72 hours, unless implementation audit shows existing product uses a different rule—in that case align with the dominant registration-open behavior in `games.ts` for consistency.

**Composition with priority windows:** Not applicable on a single game: **with positions** and **with priority players** are separate play modes (FR-0). Intermediate player rules (FR-2) apply **only** on **with positions** games, alongside the normal registration-open logic already used for 5-1 games in that mode. Priority-player timing applies **only** on **with priority players** games and does not interact with player-level gates.

**Stacking with general registration-open:** FR-2 is evaluated only after the player passes existing checks (blocked user, Telegram group, readonly, **and** `now >= registrationOpenDate` from `getRegistrationOpenDays` for self vs guest). FR-2 never **widens** who may register earlier than those rules; it only **narrows** beginner (always) or intermediate (until its FR-2 instant, and roster vs waitlist per the table).

### FR-3 — Enforcement switch (code + env, not persisted)

- **Default:** A **compile-time or source-level constant** in the backend (e.g. in `backend/src/constants.ts` or adjacent) defines whether 5-1 level restrictions are active; ship with **`false`** until operators flip it to **`true`** and deploy.
- **Override for testing:** If an environment variable is set (recommended name: `FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED`), it **overrides** the hardcoded default when present (e.g. `1` / `true` / `yes` → on; empty or unset → use hardcoded default). Document the variable in `backend/.env.example`.
- When enforcement is **off**, **no** beginner/intermediate/unassigned differentiation applies for 5-1 games; behavior matches the system **before** this feature for registration eligibility.
- When enforcement is **on**, FR-2 applies.
- **No** HTTP or mini-app surface to change this switch; **no** global-admin API for it.

### FR-4 — APIs (indicative)

- **Admin**: list users with id, display identifiers used elsewhere, and `player_level` + maybe `telegram_username` for disambiguation—mirror fields already used on other admin surfaces; do **not** add level fields to public user DTOs. List endpoint is **paginated** (see Clarifications session) with optional search.
- **Admin**: set user’s level to `beginner` | `intermediate` | `advanced` | `null` (clear).

All endpoints must verify `req.user.isAdmin` (or shared middleware equivalent).

### FR-5 — Mini-app

- New route (e.g. `/player-levels` or `/admin/player-levels`) visible only when `user.isAdmin`, with a navigation entry in the same admin icon cluster as existing global-admin tools (see `GamesList.tsx` patterns).
- Page implements the sort order in FR P3 **within the current page**; when paginating, apply global sort by **fetching or sorting server-side** so ordering is consistent across pages (recommended: server-side sort + cursor/page).
- Global-admin game create/edit implements the **play mode** select per FR-0 (this is not a “player level” surface; it replaces two booleans with one control).
- No changes to game cards, game details, category copy, or registration flows that **reveal player skill level** to non-admins. If the API returns a rejection for beginners, use a **generic** message that does not mention “beginner” or internal level names (e.g. “You cannot register for this game.”); see **FR-7** for the JSON error shape.
- **Blocked users (`user.blockReason`):** On game details for upcoming games, do **not** show **Join Game** when the user is blocked and **not** registered for that game. Show the block reason in the **same inline info region** used for “registration not open yet” (`getInfoText()` pattern in `GameDetailsViewModel.ts`). Remove the **popup-on-tap** blocked flow for join. Apply the same **hide + note** pattern to **add guest** (or equivalent self-serve guest entry) when the acting user is blocked—no CTA that would only 403.

### FR-6 — Security and privacy

- Do not include `player_level` in responses for normal authenticated routes used by the mini-app home/game flows (auth `/me`, game lists, registrations, etc.).
- Server must enforce FR-2 on **every** player-driven registration path for **with positions** games when enforcement is **on** (FR-3) (primary entry: `POST /games/:gameId/register` in `backend/src/routes/games.ts`).
- **Admin backfill / correction:** Routes used by global or assigned admins to add or adjust participants outside the normal player flow (including **past-game participant** endpoints in `backend/src/routes/gamesAdmin.ts`, e.g. `POST /:gameId/participants`) **must bypass all player-level checks** entirely, regardless of enforcement switch state.

### FR-7 — API errors for FR-2 denials (no outbound notification on failure)

- **FR-2 registration denials:** Return **only** an HTTP error response (e.g. **403**) with a JSON body that follows the same conventions as existing registration errors (`error` string, optional `code`, optional `registrationOpensAt` when time-based). The mini-app displays that message. **Do not** call **`notifyUser`** (or send any Telegram/push) solely because an FR-2 check failed—failed registration behaves like today’s other rejected register attempts (JSON only).
- **Privacy:** `error` and any user-visible mini-app strings for these responses must **not** contain internal level identifiers or labels (`beginner`, `intermediate`, `advanced`, raw enum values). Use neutral copy; include **registrationOpensAt** when the denial is window-based.
- **HTTP shape:** Use stable `code` values (e.g. `FIVE_ONE_LEVEL_NOT_ELIGIBLE`, `FIVE_ONE_LEVEL_WINDOW`, names finalizable in implementation) plus `registrationOpensAt` when applicable, consistent with existing early-registration JSON responses.
- **Success unchanged:** After a **successful** insert, keep existing **`notifyUser`** success and waitlist messages; do not introduce level names there.
- **Out of scope:** Telegram (or other push) on registration failure for FR-2 or elsewhere; marketing pushes; admin audit logs for denials.

### FR-8 — Blocked users: join UX (defense in depth)

- **Mini-app:** When `blockReason` is present on the authenticated user, **Join Game** must not appear for the join path; the info line explains why (include the reason text administrators set—this is **not** a hidden skill level). Mirror the UX of **registration window closed** (no primary CTA, explanatory copy visible without opening a dialog).
- **Backend:** Keep existing **403** on `POST /games/:gameId/register` (and any guest-register path) when `req.user.blockReason` is set—**no relaxation**; the UI change is additive so mistaken or forged clients still fail closed.

## Success criteria (measurable)

- Game create/edit API and mini-app use **only** the new play-mode shape; requests using removed fields alone are rejected (e.g. **400**).
- With enforcement **off** (default constant and no enabling env), integration tests show 5-1 registration behavior unchanged from baseline for beginner/intermediate/advanced labels if assigned.
- With enforcement **on** (constant or env), an automated test matrix covers: beginner blocked; intermediate before T-3 days blocked for roster but can waitlist after T-3 when full; intermediate at T-3 with spots can roster; advanced/unassigned always pass level gate (subject only to existing timing rules).
- Non-admin API consumers never receive `player_level` in JSON for scoped manual review (contract test or snapshot of DTOs).
- Global admin page loads users with correct ordering for a fixture dataset **through pagination** (no single response that assumes entire table fits in memory).
- With enforcement **on** and restrictions firing, automated or manual QA confirms: (a) FR-2 denial **JSON** (and mini-app copy) contain **no** internal level vocabulary; **no** `notifyUser` call on those failures; (b) successful register/waitlist still receives existing Telegram notifications; (c) FR-2 HTTP responses include stable `code` and time fields where specified.
- For a user with `blockReason` set: game details shows **no** Join button and an **inline** reason note before any register call; direct API register still returns **403** with block message.

## Key entities

- **User**: extended with optional `player_level`.
- **Game**: one **play mode** field (replacing the pair `with_positions` + `with_priority_players`); 5-1 behavior and level gates key off the **with positions** mode only.
- **Enforcement switch**: not an entity—backend constant + optional env override (FR-3).

## Edge cases

- **User level changed after registration**: Do not retroactively remove existing registrations; restrictions apply at **registration attempt** time only (unless product later requests migration jobs).
- **Clock skew**: Use server time consistently with existing registration checks.
- **Repeated FR-2 failures:** Each attempt returns HTTP error JSON; no outbound notification on denial.

## Implementation notes (repository context)

- Registration and waitlist ordering live in `backend/src/routes/games.ts` (`POST /:gameId/register`); `getRegistrationOpenDays` and related helpers branch on priority vs non-priority—those branches map to play mode after FR-0. On **success**, keep using **`notifyUser`** as today. On **FR-2 denial**, return JSON only—**do not** invoke `notifyUser` for that outcome.
- Game admin create/update: `backend/src/routes/gamesAdmin.ts`; form state: `tg-mini-app/src/viewmodels/GameFormViewModel.ts` and `GameFormFields.tsx`.
- **Blocked join UX:** `tg-mini-app/src/viewmodels/GameDetailsViewModel.ts` — extend `getMainButtonProps()` / `getInfoText()` (or shared helpers) so blocked + not-registered hides Join and surfaces reason like early-registration copy; align guest affordances with FR-5 bullets.
- Global admin checks in UI: `user.isAdmin` in `tg-mini-app/src/pages/*`.
- User admin patterns: `backend/src/routes/usersAdmin.ts` for precedent on admin-only user operations.
- **Game administrators** (`game_administrators.with_positions`) remain a boolean axis for “5-1 vs non–5-1 day assignment”; align it with the new play mode naming in UI copy only, or keep boolean semantics where `true` means “5-1 track” for that assignment (implementation detail).

## Out of scope (unless later specified)

- Showing level to assigned day administrators.
- Per-game overrides, appeals, or self-service level requests.
- **Surfacing internal level names** (`beginner`, `intermediate`, `advanced`, raw enum values) in user-facing **API or mini-app** copy—disallowed; use FR-7-style neutral `error` text instead.
