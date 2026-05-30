Ralph workflow (each pass may be a **fresh context** — you completed **Session orientation**; use this as the priority order for decisions):

1. **{{prd}}** — scope and acceptance criteria for **this epic** (feature-specific).
2. **{{progress_file}}** on branch {{branch}} — prior iterations (**append-only** — never delete or rewrite past dated sections; add new sections below).
3. **`docs/playwright-e2e-scenarios.md`** + **`e2e/`** — **whole-project** Playwright gate (independent of **{{prd}}**).

Work style:
- One **issue** per session when working a child issue — not other child issues, not the whole epic in one go.
- **E2E first:** run full **`npm run test:e2e`** (all specs in `e2e/`); any failure anywhere blocks **{{prd}}** work until fixed.
- Continue open work from {{progress_file}}. Partial iterations **append** to the log only (no completion sigil). Emit `RALPH_ISSUE_COMPLETE #n` only when the issue is done and the **full project** suite is green.
- When **your** change alters behavior: update **`docs/playwright-e2e-scenarios.md`** and **`e2e/`** (not a feature-only E2E doc).
- After changes: run feedback loops, re-run full Playwright E2E, **append** to {{progress_file}}, commit, **push** to {{branch}}.
{{#if is_remote}}
- **Next VM:** push branch + **{{progress_file}}** together when possible; leave a **clean working tree** (no surprise uncommitted files) unless you document intentional WIP in the log.
{{/if}}

Before committing, run feedback loops for the code you touched:
{{feedback_loops}}
Do not commit if a loop you ran fails. Do not commit if **`npm run test:e2e`** still fails.
