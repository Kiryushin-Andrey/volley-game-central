---
name: e2e-run-and-publish
description: Run the full Playwright E2E suite and publish the HTML report with all test screenshots to GitHub Pages. Use when the user asks to run E2E tests and publish/share/view screenshots on mobile, update GitHub Pages with E2E results, or run the E2E suite from Cursor Cloud.
---

# E2E run and publish

Run the full Playwright suite, then push the HTML report to the `gh-pages` branch so every test screenshot is viewable at a stable GitHub Pages URL (works on mobile browsers).

## One-time repo setup (human)

If GitHub Pages is not enabled yet:

1. GitHub → **Settings → Pages**
2. **Build and deployment → Source:** Deploy from a branch
3. **Branch:** `gh-pages` / **`/ (root)`**
4. Save

The publish script creates and updates the `gh-pages` branch automatically on first run.

## Workflow

Execute in order:

1. **Run the full suite** (allow up to ~15 minutes):

   ```bash
   CI=true npm run test:e2e 2>&1 | tee /opt/cursor/artifacts/e2e-full-suite.log
   ```

   Use `CI=true` so screenshots and the HTML report land under `/opt/cursor/artifacts/` on Cursor Cloud.

2. **Confirm the report exists** before publishing:

   ```bash
   test -f /opt/cursor/artifacts/playwright-report/index.html || test -f playwright-report/index.html
   ```

3. **Publish to GitHub Pages**:

   ```bash
   bash scripts/publish-e2e-report-to-gh-pages.sh
   ```

4. **Reply to the user** with:
   - The GitHub Pages URL printed by the script (bookmark for mobile)
   - Pass / fail / flaky counts from the test run
   - Note that GitHub Pages may take 1–2 minutes to reflect the new deploy after the first push

## Rules

- Run **all** E2E specs (`npm run test:e2e`), not a subset, unless the user explicitly asks for a partial run.
- **Publish even when tests fail** — failed and flaky runs are when screenshots matter most. Only skip publish if the suite did not produce `playwright-report/index.html` (e.g. dev server never started).
- Do **not** commit `playwright-report/`, `test-results/`, or `.gh-pages-worktree/` to `main`.
- The Cloud Agent must have **push access** to the repository (required for `gh-pages`).

## Troubleshooting

| Problem | Action |
|---------|--------|
| Report not found | Re-run step 1; check `/opt/cursor/artifacts/playwright-report/` and `e2e-full-suite.log` |
| `git push` fails | Confirm repo write permissions; retry push once |
| Pages URL 404 | Confirm Pages is enabled on `gh-pages` / root; wait ~2 minutes after first push |
| Publish from local run | Report falls back to `playwright-report/` if Cursor artifacts path is absent |

## Optional: publish only

If the suite already ran in this session and the report exists:

```bash
bash scripts/publish-e2e-report-to-gh-pages.sh
```

Override report location:

```bash
PLAYWRIGHT_REPORT_DIR=/path/to/playwright-report bash scripts/publish-e2e-report-to-gh-pages.sh
```

## Report URL

For `Kiryushin-Andrey/volley-game-central`:

**https://kiryushin-andrey.github.io/volley-game-central/**

Derive from `git remote get-url origin` if the repo moves.
