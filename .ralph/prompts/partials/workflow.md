Ralph workflow (each pass is a fresh context — read these first):
1. **{{prd}}** — scope and acceptance criteria for **this epic** (feature-specific).
2. **{{progress_file}}** on branch {{branch}} — prior iterations (append every time; completion sigil only when an issue is fully done).
3. **{{e2e}}** — **project-wide** Playwright scenario checklist (not feature-specific).

Work style:
- One **issue** per loop iteration — not other child issues, not the whole epic in one go.
- **E2E first:** run full **`npm run test:e2e`** per {{e2e}}; if anything fails, fix one failure before issue feature work.
- Read {{progress_file}}; continue open work on the current issue. Partial iterations update the log only (no sigil). Emit `RALPH_ISSUE_COMPLETE #n` only when the issue is done and Playwright E2E is green.
- When behavior changes: update **{{e2e}}** and **`e2e/`** tests in the same iteration.
- After changes: run feedback loops, re-run full Playwright E2E, append to {{progress_file}}, commit, push to {{branch}}.
{{#if is_cloud}}
- Cloud handoff: the next agent session is a fresh VM — it only sees what you pushed. Always include an updated {{progress_file}} in your commit.
{{/if}}

Before committing, run feedback loops for the code you touched:
{{feedback_loops}}
Do not commit if a loop you ran fails. Do not commit if **`npm run test:e2e`** still fails.
