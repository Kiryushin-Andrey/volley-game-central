## E2E gate (required every iteration — before issue feature work)

**Policy:** Do not advance issue #{{issue_number}} scope until the **project-wide** Playwright E2E suite is green (no failures). Fixing E2E failures has **higher priority** than new feature work this iteration.

### 1. Run the full Playwright suite

Use the repo checklist and tests (not feature-specific E2E docs):

- Read **{{e2e}}** for environment assumptions, personas, and scenario IDs (`E2E-*`).
- Start stack per that doc (e.g. `npm run e2e:server` or `scripts/playwright-dev-server.sh`, then `npm run test:e2e` from repo root).
- Run the **entire** Playwright suite (`npm run test:e2e`), not a subset, unless a failure requires a focused re-run while debugging.

Record in {{progress_file}}: pass/fail counts, failing spec files, and scenario IDs from the checklist when relevant.

### 2. If any test **failed**

- Do **not** start new feature work for the issue until failures are cleared.
- Investigate; pick **one** failing test or root cause to fix this iteration.
- Re-run **`npm run test:e2e`** (full suite) after the fix before committing.
- Append to {{progress_file}}: what failed, what you fixed, what still fails.

You may end a **partial iteration** with only E2E repair work (no issue sigil).

### 3. When the gate is green

You may work on issue #{{issue_number}} per **{{prd}}** and the GitHub issue.

**E2E spec hygiene (when you change product behavior):**

- Add or update scenarios in **{{e2e}}** and implement or adjust tests under **`e2e/`** so the checklist matches the app.
- Do **not** emit `RALPH_ISSUE_COMPLETE #{{issue_number}}` until:
  - acceptance criteria for the issue are met, **and**
  - **`npm run test:e2e` passes** (full suite), **and**
  - {{e2e}} and `e2e/` reflect your changes when applicable.

### 4. Before commit / end of iteration

Re-run **full** `npm run test:e2e` after all code and E2E edits. Do not commit if tests still fail.
