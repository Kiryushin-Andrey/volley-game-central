---
description: "Dependency-ordered implementation tasks for player levels & 5-1 access"
---

# Tasks: Player levels & 5-1 access

**Input**: Design documents from `/specs/001-player-levels-five-one-access/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md), [e2e-playwright-mcp.md](./e2e-playwright-mcp.md)

**Tests**: Automated unit/integration tests are optional for this feature per plan. Browser E2E (Playwright) is in scope; manual verification follows [quickstart.md](./quickstart.md).

**Organization**: Phases follow user stories **P1–P5** from [spec.md](./spec.md) (labeled US1–US5 below).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies on incomplete sibling tasks)
- **[Story]**: User story label ([US1]…[US5]) for story-phase tasks only
- Every task includes a concrete file path

## Path Conventions

- **Backend**: `backend/src/`, `backend/drizzle/`
- **Mini-app**: `tg-mini-app/src/`

---

## Extension Hooks

**Optional Pre-Hook**: git

Command: `/speckit.git.commit`

Description: Auto-commit before task generation

Prompt: Commit outstanding changes before task generation?

To execute: `/speckit.git.commit`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Enforcement switch wiring and shared configuration surface for local/staging tests

- [x] T001 Add default constant and env-backed reader for `FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED` in `backend/src/constants.ts` (or a small dedicated module under `backend/src/config/`) and ensure `backend/.env.example` documents the variable

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, migration, and codebase-wide migration from dual booleans to `play_mode` so registration and admin routes share one model

**⚠️ CRITICAL**: No user story work should ship until `play_mode` and `player_level` exist in the database and backend reads are consistent

- [x] T002 Add Drizzle migration under `backend/drizzle/` (next index after `0030_add_with_priority_players_to_games`, e.g. `0031_player_level_and_play_mode.sql`) implementing `users.player_level`, `games.play_mode`, backfill from `with_positions` / `with_priority_players`, and removal of legacy boolean columns per [data-model.md](./data-model.md)
- [x] T003 [P] Update `backend/src/db/schema.ts` for `users.player_level` and `games.play_mode`; remove deprecated boolean columns from the Drizzle schema after the migration
- [x] T004 [P] Regenerate or update Drizzle metadata in `backend/drizzle/meta/` after schema changes (`npm` scripts in `backend/package.json`)
- [x] T005 Replace all backend references to `withPositions` / `withPriorityPlayers` with `play_mode` semantics across `backend/src/` (at minimum `backend/src/routes/games.ts`, `backend/src/routes/gamesAdmin.ts`, `backend/src/services/gameService.ts`, `backend/src/services/telegramService.ts`, and related middleware/types)

**Checkpoint**: Foundation ready — user stories can proceed (US2/US3 may overlap in parallel after T005)

---

## Phase 3: User Story 1 — Access rules when restrictions are ON (Priority: P1) 🎯 MVP core

**Goal**: When enforcement is enabled, `POST /games/:gameId/register` (and waitlist join, if applicable) denies beginners entirely, applies the 3-day intermediate window with non-waitlist roster rules, and leaves advanced + unassigned unrestricted for **5-1 (with positions)** games only, stacked with existing registration timing per [research.md](./research.md)

**Independent Test**: With enforcement on and a `with_positions` game, verify matrix in [quickstart.md](./quickstart.md) FR-2 section via API or mini-app; confirm admin backfill routes still bypass checks (separate story verification in US2 if routed differently)

### Implementation for User Story 1

- [x] T006 [US1] Implement FR-2 eligibility evaluation (beginner / intermediate window / intermediate roster vs waitlist / advanced / unassigned) in a focused helper under `backend/src/` (e.g. `backend/src/services/fiveOneLevelAccess.ts` or co-located helpers in `backend/src/routes/games.ts`) using `games.play_mode === 'with_positions'` and the enforcement reader from T001
- [x] T007 [US1] Integrate the FR-2 gate into `POST /:gameId/register` (and any waitlist registration handler) in `backend/src/routes/games.ts` after existing registration-open checks per [spec.md](./spec.md) FR-2
- [x] T008 [US1] On FR-2 denial, return HTTP 403 JSON shaped per [contracts/http-registration-fr2.md](./contracts/http-registration-fr2.md); do **not** call `notifyUser` on this path

**Checkpoint**: Backend enforcement for FR-2 is complete when combined with foundational `play_mode` data

---

## Phase 4: User Story 2 — Administration & privacy (Priority: P2)

**Goal**: Global admins can list all users with pagination, assign `player_level`, and receive sorted groups; `player_level` never appears on non-admin user payloads or non-admin mini-app surfaces

**Independent Test**: Global admin succeeds on new admin APIs; non-admin receives 403; public/game JSON responses omit `player_level`

### Implementation for User Story 2

- [x] T009 [US2] Implement paginated `GET` (directory) and `PATCH` (assign level) routes per [contracts/http-admin-player-levels.md](./contracts/http-admin-player-levels.md) in `backend/src/routes/` (new file or extension of an existing admin module) and register them in `backend/src/index.ts` behind global-admin auth
- [x] T010 [US2] Audit serializers / DTO builders in `backend/src/routes/` (e.g. games, users, profile) so `player_level` is excluded except on the dedicated admin responses
- [x] T011 [US2] Add admin UI page under `tg-mini-app/src/pages/` listing users with server-driven sort (unassigned first, then advanced → intermediate → beginner, then alphabetical within group) and level assignment controls wired to new APIs
- [x] T012 [US2] Extend `tg-mini-app/src/services/api.ts` with typed client functions for the admin directory and PATCH
- [x] T013 [US2] Add routing and a global-admin-only navigation entry in `tg-mini-app/src/App.tsx` and the appropriate admin menu surface (e.g. `tg-mini-app/src/pages/GamesList.tsx` or existing admin shell)

**Checkpoint**: Admin can manage levels without leaking levels to regular players

---

## Phase 5: User Story 3 — Game play mode & signup defaults (Priority: P3)

**Goal**: Game creation/editing uses a single `play_mode` (`with_positions` | `with_priority_players` | `regular`); API rejects legacy dual-boolean payloads; new users default to unassigned (`null`); mini-app types and utilities align

**Independent Test**: Create/update game via admin API and mini-app form using only `playMode`; confirm DB row; confirm new signups have `player_level` null

### Implementation for User Story 3

- [x] T014 [US3] Update `backend/src/routes/gamesAdmin.ts` (and shared validation/types) to accept **only** `playMode` on writes and reject deprecated `with_positions` / `with_priority_players` boolean fields
- [x] T015 [US3] Refactor `tg-mini-app/src/viewmodels/GameFormViewModel.ts` to hold a single `playMode` value instead of two booleans
- [x] T016 [US3] Replace the two checkboxes with one select in `tg-mini-app/src/components/GameFormFields.tsx` and map options to the backend enum
- [x] T017 [US3] Ensure user creation paths in `backend/src/` default `player_level` to `null` for new registrations per [data-model.md](./data-model.md)
- [x] T018 [US3] Update shared mini-app types and helpers (`tg-mini-app/src/types/index.ts`, `tg-mini-app/src/utils/gameDateUtils.ts`, and any `classifyGame` consumers) to the new `playMode` shape

**Checkpoint**: Authoring pipeline and client are aligned on `play_mode` / `playMode`

---

## Phase 6: User Story 4 — Player-facing errors (Priority: P4)

**Goal**: FR-2 denials surface clear in-app messaging from stable JSON `code` values; successful registrations keep existing Telegram behavior; failed registrations do not add new Telegram notifications

**Independent Test**: Trigger FR-2 denials and confirm UI text; confirm Telegram is unchanged vs today on failures; confirm success path still notifies

### Implementation for User Story 4

- [x] T019 [US4] Parse FR-2 error payloads in `tg-mini-app/src/viewmodels/GameDetailsViewModel.ts` (and guest/registration paths that share the same client) to show user-visible messages without exposing internal level names, reusing patterns for “registration not yet open” where appropriate

**Checkpoint**: Players understand denials without backend-only errors

---

## Phase 7: User Story 5 — Blocked users join UX (Priority: P5)

**Goal**: When `blockReason` is set, hide the Join affordance entirely and show an inline explanation; `POST /games/:gameId/register` continues to return 403 as defense in depth

**Independent Test**: Blocked fixture user opens game details — no Join button, visible reason; direct API call still 403

### Implementation for User Story 5

- [x] T020 [US5] Update `tg-mini-app/src/viewmodels/GameDetailsViewModel.ts` (and any related UI components) so blocked users never see the Join action and instead see inline `blockReason` text; remove or bypass popup-based join attempts for blocked state

**Checkpoint**: Blocked UX matches spec FR-8

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: E2E harness, stable selectors, and manual regression sweep

- [x] T021 Add Playwright scaffolding to `tg-mini-app/` (`playwright.config.ts`, `e2e/` smoke spec, npm scripts) following [e2e-playwright-mcp.md](./e2e-playwright-mcp.md)
- [x] T022 [P] Add `data-testid` attributes needed for MCP-driven flows on join CTA, registration status copy, blocked banner, admin user table, and play-mode select in the relevant `tg-mini-app/src/components/` and page files
- [x] T023 Execute the scenarios in [quickstart.md](./quickstart.md) and fix any regressions found in `backend/src/` or `tg-mini-app/src/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user stories**
- **Phases 3–7 (US1–US5)**: All depend on Phase 2 completion
- **Phase 8 (Polish)**: Depends on the user stories you intend to ship together (this feature expects **simultaneous** backend + mini-app deploy)

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 — requires `play_mode` and enforcement reader
- **US2 (P2)**: Depends on Phase 2 — largely parallel with US3/US4/US5 once schema exists
- **US3 (P3)**: Depends on Phase 2 — should land before or with US1 for realistic end-to-end registration from the updated client (dual-boolean client must not ship against strict API)
- **US4 (P4)**: Depends on US1 backend error shape (T008) for meaningful parsing
- **US5 (P5)**: Depends on Phase 2 only — can proceed in parallel with US1–US4

### Within Each User Story

- Backend routes before mini-app wiring for the same story
- Keep admin serialization audit (T010) before or alongside mini-app admin page to avoid accidental leaks during QA

### Parallel Opportunities

- **After Phase 2**: T009–T013 (US2) can run alongside T014–T018 (US3) in parallel if coordinated on merge order
- **After Phase 2**: T020 (US5) can proceed in parallel with US1–US4 (touches mainly `GameDetailsViewModel.ts`)
- **Phase 8**: T021 and T022 are parallelizable once UI stabilizes

---

## Parallel Example: After Foundational (Phase 2)

```bash
# Track A — US2 admin APIs + UI
Task: "T009 [US2] … in backend/src/routes/…"
Task: "T011 [US2] … in tg-mini-app/src/pages/…"

# Track B — US3 play mode + form
Task: "T014 [US3] … in backend/src/routes/gamesAdmin.ts"
Task: "T016 [US3] … in tg-mini-app/src/components/GameFormFields.tsx"

# Track C — US5 blocked UX (mostly isolated file)
Task: "T020 [US5] … in tg-mini-app/src/viewmodels/GameDetailsViewModel.ts"
```

---

## Implementation Strategy

### MVP First (backend enforcement only — not shippable alone)

1. Complete Phase 1 and Phase 2
2. Complete Phase 3 (US1) — FR-2 enforcement + JSON errors
3. **STOP**: Validate with curl or scripted calls against `backend/` using [quickstart.md](./quickstart.md)

Because the API rejects legacy booleans, the **minimum releasable slice** for production is **Phase 2 + US1 + US3 + US4** (US2/US5 can ship in the same release but are independently testable).

### Incremental Delivery

1. Phase 2 → database + `play_mode` everywhere in backend
2. US3 → client + admin API accept new shape
3. US1 + US4 → enforcement + in-app error mapping
4. US2 → admin directory
5. US5 → blocked UX polish
6. Phase 8 → Playwright + selectors + full quickstart pass

### Parallel Team Strategy

- Developer A: US1 + US4 (same registration/error surfaces)
- Developer B: US2 (admin APIs + page)
- Developer C: US3 (play mode form) + Phase 8 E2E scaffolding

---

## Notes

- Admin backfill routes must remain exempt from FR-2 — verify in `backend/src/routes/` when touching registration utilities
- Do not add `notifyUser` calls on FR-2 denial paths
- Prefer server-side sorting/pagination for the admin directory to meet performance notes in [plan.md](./plan.md)

---

## Extension Hooks

**Optional Hook**: git

Command: `/speckit.git.commit`

Description: Auto-commit after task generation

Prompt: Commit task changes?

To execute: `/speckit.git.commit`

---

## Summary

| Metric | Value |
|--------|------|
| Total tasks | 23 |
| US1 (P1) | 3 (T006–T008) |
| US2 (P2) | 5 (T009–T013) |
| US3 (P3) | 5 (T014–T018) |
| US4 (P4) | 1 (T019) |
| US5 (P5) | 1 (T020) |
| Setup + Foundational + Polish | 8 (T001–T005, T021–T023) |
| Format validation | All lines use `- [x] Tnnn …` with `[USn]` only on story-phase tasks; `[P]` only on T003, T004, T022 |
