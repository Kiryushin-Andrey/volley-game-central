{{#if is_remote}}{{> remote-preamble}}

{{/if}}Ralph **recursive** iteration — {{#if has_issue}}issue #{{issue_number}}{{else}}work per progress{{/if}} (one session, then chain).

Config: **{{config_file}}** · Worker: **{{worker}}** (keep unless the user explicitly chose another runtime).

{{> refs-block}}
{{> session-orientation}}
{{> workflow}}

{{#if has_issue}}
Do not work on other child issues this iteration — only #{{issue_number}}.
{{/if}}

{{> e2e-gate}}

## Implement (only after Playwright E2E gate is green)

{{#if has_issue}}
Make a coherent chunk of progress on issue #{{issue_number}} per **{{prd}}**, the issue body, and **{{context}}**.
If the issue is large, prefer one focused chunk; you may need another session on the same issue.
{{else}}
Follow **{{progress_file}}** for what remains on the current slice.
{{/if}}

## Finish this session

Run feedback loops for any code you changed. Commit and **push** to {{branch}}.

**Handoff:** working tree clean or intentional WIP in the log; **{{progress_file}}** updated in the same push as code when possible.

**Append-only log:** add a new dated section to {{progress_file}} — Playwright E2E result, what you did, decisions, files touched, what remains.

**Partial iteration** (more work remains on this issue): do **not** emit a completion sigil. Push an updated {{progress_file}}.

**Issue finished** — only when acceptance criteria are met, the **full project** suite (`npm run test:e2e`, all `e2e/` specs) passes, and `docs/playwright-e2e-scenarios.md` + `e2e/` are updated when applicable. Add on its own line inside {{progress_file}}:

RALPH_ISSUE_COMPLETE #{{issue_number}}

(Legacy alias: `RALPH_SLICE_COMPLETE #{{issue_number}}`.)

{{#if is_last_issue}}
## Epic closure (last child issue)

When issue #{{issue_number}} is complete and the **full project** E2E suite is green:

- Re-read **{{prd}}** and **{{context}}** for any epic-level acceptance not covered by this issue alone.
- Update **{{prd}}** if checklist items use `passes: true/false`.
- Ensure a draft PR exists from **{{branch}}** → **{{base}}** ({{closes_clause}}) if your workflow uses one; cloud bootstrap may have opened it already — otherwise note PR status in {{progress_file}}.

After you chain, `ralph-chain-next.sh` should print **`RALPH_DONE`** (no further child issues).
{{/if}}

{{> chain-next}}
