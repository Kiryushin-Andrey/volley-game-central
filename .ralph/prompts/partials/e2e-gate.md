## E2E gate — whole project (required before issue feature work)

The gate is **always** the **repository-wide** Playwright regression set. It is **not** scoped to issue #{{issue_number}}, **not** defined by **{{prd}}**, and **not** a feature-specific browser plan under `docs/testing/`.

| Project E2E (use for this gate) | Feature work (after gate is green) |
|--------------------------------|-------------------------------------|
| `docs/playwright-e2e-scenarios.md` — full scenario checklist | **{{prd}}** + GitHub issue #{{issue_number}} |
| `e2e/**/*.spec.ts` — all Playwright specs | Product code you change for this epic |
| `npm run test:e2e` — run **every** spec | New scenarios/tests only when **your** changes require them |

**Policy:** Do not advance issue #{{issue_number}} until the **entire** project suite passes. Fixing **any** failing Playwright test has higher priority than epic feature work.

### 1. Run the full project suite

1. Read **`docs/playwright-e2e-scenarios.md`** for environment setup, personas, and `E2E-*` scenario IDs (this is the canonical checklist; `{{e2e}}` should resolve to this path).
2. Start the stack per that doc (e.g. `npm run e2e:server` or `scripts/playwright-dev-server.sh`).
3. From repo root run **`npm run test:e2e`** — **all** specs under `e2e/`, not a subset tied to the current feature.

Record in {{progress_file}}: total pass/fail, failing spec file paths, and related `E2E-*` IDs from the **project** checklist.

### 2. If any test failed

- Do **not** start new work from **{{prd}}** / issue #{{issue_number}} until failures are cleared.
- Investigate; pick **one** failure anywhere in the suite to fix this iteration.
- Re-run **`npm run test:e2e`** (full project suite) after the fix.
- Append to {{progress_file}}: failures, fix, remaining failures.

A partial iteration may contain **only** project E2E repairs (no issue sigil).

### 3. When the whole project suite is green

You may implement a chunk of issue #{{issue_number}} per **{{prd}}** and the GitHub issue.

If **your** change alters product behavior:

- Add or update rows in **`docs/playwright-e2e-scenarios.md`** and tests in **`e2e/`** so the **project** catalog matches the app (not a separate feature-only E2E doc).

Do **not** emit `RALPH_ISSUE_COMPLETE #{{issue_number}}` until:

- issue acceptance criteria are met, **and**
- **`npm run test:e2e`** passes for the **full** repo suite, **and**
- project checklist + `e2e/` specs reflect your changes when applicable.

### 4. Before commit

Re-run full **`npm run test:e2e`**. Do not commit with any project spec still failing.
