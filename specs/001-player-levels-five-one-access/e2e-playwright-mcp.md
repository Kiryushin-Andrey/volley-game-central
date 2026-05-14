# E2E testing plan: Playwright + browser MCP

This document plans **browser-level acceptance tests** for the player-levels / 5-1 access feature using **Playwright**, executed or steered via the **Playwright (or browser automation) MCP** in Cursor so agents can open a real browser, navigate the mini-app, and assert UI state—complementing API/unit tests and [quickstart.md](./quickstart.md) manual checks.

## Goals

- Verify **mini-app behavior** that APIs alone miss: hidden **Join** for blocked users with inline reason, **FR-2** denial copy (no internal level names), **admin** player-levels page sort/pagination, **game form** play-mode select.
- Use **MCP-driven** sessions for exploratory passes during development and, optionally, **saved Playwright specs** (`*.spec.ts`) for repeatable smoke runs in CI later.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Running stack** | Backend + Postgres + `tg-mini-app` dev server (or preview build) reachable at stable base URLs (e.g. `http://127.0.0.1:3001`). |
| **Auth** | Document how tests sign in: **dev/phone login** flow in the mini-app (see `PhoneAuth` / dev login if available), or cookie injection if a test-only shortcut exists. **Do not** commit real secrets. |
| **Seed data** | SQL or admin API: users with `player_level` variants, one blocked user (`block_reason`), games with `play_mode` **with_positions** at dates that exercise FR-2 windows, global admin account. |
| **`FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED`** | Toggle via env to flip enforcement without code edits for E2E matrix rows. |

## Repository layout (to add during implementation)

Recommended (adjust if team prefers root `e2e/`):

```text
tg-mini-app/
├── e2e/
│   ├── playwright.config.ts
│   ├── fixtures/           # auth helpers, seed references
│   └── specs/
│       ├── blocked-join.spec.ts
│       ├── player-levels-admin.spec.ts
│       └── five-one-register-fr2.spec.ts
└── package.json            # devDependencies: @playwright/test
```

- **`playwright.config.ts`**: `baseURL` = mini-app origin; `webServer` optional to `npm run dev` (or document “start servers manually” for MCP-only runs).
- **Trace / screenshot**: Enable `trace: 'on-first-retry'` or `on` for debugging MCP-assisted failures.

## MCP workflow (Cursor)

1. **Connect** the Playwright (or Microsoft Playwright) MCP server in Cursor settings if not already enabled.
2. **Start** backend + mini-app locally; confirm URLs in MCP/browser target.
3. **Drive** the browser through MCP tools: navigate, click, fill, wait for selectors aligned with stable `data-testid` attributes (add `data-testid` on Join region, block info line, admin table rows where selectors would otherwise be brittle).
4. **Assert** visible text and absence of buttons (e.g. blocked user: **no** element with Join label; **yes** block reason snippet in info area).
5. **Optionally** export or paste steps into a committed `*.spec.ts` so the same flow runs with `npx playwright test`.

**Why MCP + Playwright:** MCP gives **interactive** verification during implementation; Playwright gives **repeatable** scripts and artifacts (trace, HTML report) for regressions.

## Scenario checklist (map to spec)

| ID | Scenario | Key assertions |
|----|----------|----------------|
| E1 | Blocked user, not registered, upcoming game | Join **hidden**; info text contains `blockReason`; direct API call still **403** (optional `request` fixture in Playwright). |
| E2 | Enforcement **off** | Intermediate/beginner can register for 5-1 same as baseline (if timing allows). |
| E3 | Enforcement **on**, beginner | Join visible when timing OK → click → error surface **without** “beginner” string; no Telegram assertion needed. |
| E4 | Enforcement **on**, intermediate too early | Join hidden or click yields window message; `registrationOpensAt` reflected in copy if exposed to UI. |
| E5 | Global admin player-levels page | Route loads; grouped list; pagination control; change level and verify persistence (reload). |
| E6 | Game admin play mode | Single select saves; reload game shows correct mode. |

## Stability guidelines

- Prefer **`data-testid`** on: main join CTA container, registration info banner, blocked-user banner, player-levels table, play-mode select.
- Avoid time-dependent flakes: use **seeded** `date_time` far enough in the future and control “now” only via game dates, not system clock hacks, unless Playwright `clock` API is used intentionally.
- **Parallelism**: run admin vs player flows in separate workers to avoid shared session collisions, or use isolated storage state per project.

## CI (later)

- Add a workflow job `playwright` that installs browsers, runs `npm run test:e2e` from `tg-mini-app`, uploads **Playwright report** artifact on failure.
- Gate on `main` only or on PR with label `e2e` to control cost.

## Out of scope for first E2E slice

- Real Telegram WebApp `initData` in production shape (use dev bypass or test backend session as agreed).
- Full matrix of all game categories in one run—start with **with_positions** + admin levels + blocked join.
