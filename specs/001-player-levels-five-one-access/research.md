# Research: Player levels & 5-1 access

Consolidates implementation decisions for [spec.md](./spec.md). No open NEEDS CLARIFICATION items remain for the plan.

## 1. Game play mode storage

**Decision:** Add a single PostgreSQL column `game_play_mode` (or `play_mode`) using a **text check constraint** or **native enum** with exactly three values: `with_positions`, `with_priority_players`, `regular`. Migrate data from legacy booleans; drop legacy columns after dual-read window if desired.

**Rationale:** Matches spec FR-0; single source of truth; simpler queries than two booleans + CHECK.

**Alternatives considered:** Keep two booleans with DB CHECK `(with_positions AND NOT with_priority_players) OR (...)` — rejected as error-prone at API layer.

## 2. Global enforcement switch (no persistence)

**Decision:** **Hardcoded boolean** in backend source (e.g. `backend/src/constants.ts`), default **`false`**. Optional env **`FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED`**: when set, parse truthy/falsy and **override** the constant so staging/local can test “on” without a code edit. When env is unset, use the constant only. Document in `backend/.env.example`.

**Rationale:** Product owner preference: no separate DB entity; rollout = edit constant + deploy; tests use env.

**Alternatives considered:** `system_settings` table — **rejected** by updated spec.

## 3. `player_level` column

**Decision:** Nullable `player_level` on `users` — PostgreSQL `enum` type `player_skill_level` with values `beginner`, `intermediate`, `advanced`, or **NULL** for unassigned.

**Rationale:** Type-safe; matches spec vocabulary internally (never exposed to clients except admin APIs).

## 4. FR-2 evaluation order

**Decision:** Implement FR-2 **after** all existing pre-registration checks including `now >= registrationOpenDate` from `getRegistrationOpenDays` (logical AND per Clarifications session).

**Rationale:** Matches clarified spec; avoids widening early access.

## 5. Telegram deduplication (60s)

**Decision:** Use an **in-process** `Map` keyed by `${userId}:${gameId}:${denialCode}` with expiry timestamp; skip second `notifyUser` if key exists and `now < expiry`.

**Rationale:** Zero new infrastructure; sufficient for single Node instance.

**Alternatives considered:** Redis — defer unless horizontally scaled; document in plan risks.

## 6. Admin user list global sort + pagination

**Decision:** **Server-side** sort: SQL `ORDER BY` with `CASE` for level bucket (unassigned first, then advanced, intermediate, beginner) then `LOWER(display_name)`. Cursor-based pagination using `(sort_bucket, display_name, id)` tie-breaker **or** offset pagination for v1 if simpler—spec allows page or cursor; **offset + limit** acceptable for modest N with warning in tasks to add cursor if needed.

**Rationale:** FR-5 requires global ordering across pages; OFFSET is simplest first ship.

## 7. HTTP error codes for FR-2

**Decision:** Use JSON fields `code`, `error`, optional `registrationOpensAt` (ISO 8601) mirroring existing early-registration 403 responses in `games.ts`.

**Rationale:** Clarifications session; enables mini-app branching without string matching.

## 8. Legacy game API compatibility

**Decision:** One release: `gamesAdmin` create/update accepts **either** new `playMode` field **or** legacy `withPositions`/`withPriorityPlayers`; server normalizes to single enum using precedence: `with_positions` if legacy `with_positions===true`, else `with_priority_players` if true, else `regular`.

**Rationale:** Matches clarify answer; mobile/web rollout buffer.
