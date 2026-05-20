{{#if is_cloud}}{{> cloud-preamble}}

{{/if}}Ralph loop — final pass.

{{> refs-block}}
{{> session-orientation}}
{{> workflow}}

## E2E

Run **`npm run test:e2e`** — the **full project** Playwright suite (`e2e/`). No failures may remain. Fix any regression anywhere in the app before closing the epic.

Confirm **`docs/playwright-e2e-scenarios.md`** and **`e2e/`** match shipped behavior; update the **project** checklist and specs if anything drifted (not a feature-only E2E doc).

If the UI still shows **obvious** breakage that Playwright missed, extend **`e2e/`** and the checklist before declaring the epic closed.

Run unit tests if applicable. One draft PR {{branch}} → {{base}} ({{closes_clause}}).
Update **{{prd}}** if items use passes:true/false — mark completed issues.

**Append-only log:** add a new dated section to **{{progress_file}}** — do not delete or rewrite earlier sections. Push with your changes so the next session sees full history.

**Handoff:** clean working tree or document intentional WIP in the log; **{{progress_file}}** and code on **{{branch}}** pushed together when possible.

Append to {{progress_file}} and output on their own lines when done:

RALPH_E2E_COMPLETE
RALPH_ALL_COMPLETE
