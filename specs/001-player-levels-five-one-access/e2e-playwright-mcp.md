# E2E testing plan: Playwright + browser MCP

This document plans **browser-level acceptance tests** for the player-levels / 5-1 access feature using **Playwright**, executed or steered via the **Playwright (or browser automation) MCP** in Cursor so agents can open a real browser, navigate the mini-app, and assert UI state—complementing API/unit tests and [quickstart.md](./quickstart.md) manual checks.

## Goals

- Verify **mini-app behavior** that APIs alone miss:
  - **FR-2 join UX:** hide **Join Game** (and self-serve **add guest**) with **inline info** when the viewer is a **beginner** on a 5-1 game (enforcement on), or an **intermediate** when the game is still **more than three calendar days** away—**after** the general registration window is already open.
  - **FR-2 defense in depth:** optional `request` fixture confirms `POST /games/:id/register` still returns **403** with `FIVE_ONE_LEVEL_*` codes if the UI is bypassed.
  - **Admin `blockReason`:** Join may still appear; popup on tap and API **403** remain acceptable (not the same as FR-2).
  - **Admin** player-levels page sort/pagination; **game form** play-mode select.
- Use **MCP-driven** sessions for exploratory passes during development and, optionally, **saved Playwright specs** (`*.spec.ts`) for repeatable smoke runs in CI later.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Running stack** | Backend + Postgres + `tg-mini-app` dev server (or preview build) reachable at stable base URLs (e.g. `http://127.0.0.1:3001`). |
| **Auth** | Document how tests sign in: **dev/phone login** flow in the mini-app (see `PhoneAuth` / dev login if available), or cookie injection if a test-only shortcut exists. **Do not** commit real secrets. |
| **Seed data** | SQL or admin API: users with `player_level` **beginner**, **intermediate**, **advanced**, **NULL**; one user with `block_reason` (admin block, separate from FR-2); games with `play_mode` **with_positions** at dates that exercise FR-2 windows (intermediate: game **>3 days** out but within general registration-open window); global admin account. |
| **`FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED`** | Toggle via env to flip enforcement without code edits for E2E matrix rows. |

## Repository layout

```text
tg-mini-app/
├── e2e/
│   ├── playwright.config.ts
│   ├── fixtures/              # auth helpers, seed references (to add)
│   └── specs/
│       ├── smoke.spec.ts      # landing smoke (committed)
│       ├── fr2-join-hidden.spec.ts      # planned
│       ├── player-levels-admin.spec.ts  # planned
│       └── play-mode-form.spec.ts       # planned
└── package.json               # @playwright/test, npm run test:e2e
```

- **`playwright.config.ts`**: `baseURL` = mini-app origin; optional `webServer` for `npm run dev`.
- **Trace / screenshot**: Enable `trace: 'on-first-retry'` or `on` for debugging MCP-assisted failures.

## MCP workflow (Cursor)

1. **Connect** the Playwright MCP server in Cursor (project `.cursor/mcp.json` uses `npx @playwright/mcp@latest`).
2. **Start** backend + mini-app locally; set `FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED=true` when testing FR-2 rows.
3. **Drive** the browser through MCP: navigate, click, fill, wait for **`data-testid`** selectors.
4. **Assert** visible text and **absence** of Join CTA for FR-2-blocked viewers; assert **presence** of info line copy from `registrationRestriction` (loaded via `GET /games/:id`, not from exposed `player_level`).
5. **Optionally** mirror flows in committed `*.spec.ts` and run `npm run test:e2e` from `tg-mini-app/`.

## Scenario checklist (map to spec)

| ID | Scenario | Key assertions |
|----|----------|----------------|
| **E1** | **FR-2:** beginner, enforcement **on**, 5-1 game, general registration **open**, not registered | **`data-testid="game-details-join-button"`** (or main join CTA) **absent**; **`data-testid="game-details-info-text"`** contains neutral denial (no substring `beginner` / `intermediate` / `advanced`); optional API: `GET /games/:id` includes `registrationRestriction.code === 'FIVE_ONE_LEVEL_NOT_ELIGIBLE'`; `POST .../register` → **403** same code. |
| **E2** | **FR-2:** intermediate, enforcement **on**, game **>3 calendar days** away, general registration **open** | Join **hidden**; info text mentions registration opens (window); `registrationRestriction.code === 'FIVE_ONE_LEVEL_WINDOW'` on GET; optional `registrationOpensAt` reflected in info copy. |
| **E3** | **FR-2:** intermediate, enforcement **on**, within **3-day** window, spot available | Join **visible** (if no other gate); register succeeds or shows waitlist per today’s rules. |
| **E4** | Enforcement **off** | Beginner/intermediate on 5-1: no `registrationRestriction` on GET; Join behaviour matches **pre-feature** baseline when timing allows. |
| **E5** | Admin **`blockReason`** (not FR-2) | Join **may** be visible; tap → popup with reason **or** API-only block; `POST .../register` → **403** with block message. **Do not** assert Join hidden solely because of `blockReason`. |
| **E6** | Global admin player-levels page | Route `/player-levels` loads; **`data-testid="admin-user-table"`**; change level and verify persistence (reload). |
| **E7** | Game admin play mode | **`data-testid="play-mode-select"`** saves; reload game shows correct `playMode`. |

### API helpers for E2E (optional Playwright `request` fixture)

- **Game details:** `GET /games/:id` → `registrationRestriction: { code, message, registrationOpensAt? } | null` when FR-2 would block self-serve join and general registration is open.
- **Register:** `POST /games/:id/register` → FR-2 body per [http-registration-fr2.md](./contracts/http-registration-fr2.md).

## Stability guidelines

- Prefer **`data-testid`** on: join CTA (`game-details-join-button`), info banner (`game-details-info-text`), add-guest button, admin user table, play-mode select.
- Avoid time flakes: seed `date_time` so **general registration is open** but intermediate FR-2 window is **not** (e.g. game 7 days out, intermediate user).
- **Parallelism:** isolated storage state per role (beginner / intermediate / admin).

## CI (later)

- Workflow job runs `npm run test:e2e` from `tg-mini-app`, uploads Playwright report on failure.
- Gate on `main` or PR label `e2e`.

## Out of scope for first E2E slice

- Real Telegram WebApp `initData` in production shape (use dev bypass).
- Full category matrix—start with **with_positions** + admin levels + FR-2 join hidden (E1–E2).
