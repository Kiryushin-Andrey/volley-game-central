{{#if is_remote}}{{> remote-preamble}}

{{/if}}Ralph loop — issue #{{issue_number}} (one iteration; continue until this issue is fully done).

{{> refs-block}}
{{> session-orientation}}
{{> workflow}}

Do not work on other child issues this iteration.

{{> e2e-gate}}

## Implement (only after Playwright E2E gate is green)

Make a coherent chunk of progress on issue #{{issue_number}} per **{{prd}}**, the issue body, and **{{context}}**.
If the issue is large, prefer one focused chunk of work, not the entire issue in one session.

## Finish

Run feedback loops for any code you changed. Commit and **push** to {{branch}}.

**Handoff for the next pass (especially on cloud):** working tree clean or intentional WIP called out in the log; **{{progress_file}}** updated in the same push as code when possible so the next agent can clone and continue without guessing.

**Append-only log:** add a new dated section to {{progress_file}} — Playwright E2E result, what you did, decisions, files touched, what remains. Do **not** delete or rewrite earlier sections.

**Partial iteration** (more work remains on #{{issue_number}}, or only E2E fixes): do **not** emit a completion sigil. Push an updated {{progress_file}}.

**Issue finished** — only when acceptance criteria are met, the **full project** suite (`npm run test:e2e`, all `e2e/` specs) passes, and `docs/playwright-e2e-scenarios.md` + `e2e/` are updated for your changes when applicable. Add on its own line inside {{progress_file}} (and in your final message):

RALPH_ISSUE_COMPLETE #{{issue_number}}

(Legacy alias: `RALPH_SLICE_COMPLETE #{{issue_number}}`.)
