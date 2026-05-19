{{#if is_cloud}}{{> cloud-preamble}}

{{/if}}Ralph loop — final pass.

{{> workflow}}
{{> refs-block}}

## E2E

Run **`npm run test:e2e`** (full Playwright suite). No failures may remain. Fix any regression before closing the epic.

Confirm **{{e2e}}** and **`e2e/`** match shipped behavior for all child issues; update scenarios and specs if anything drifted.

## Close epic

Run unit tests if applicable. One draft PR {{branch}} → {{base}} ({{closes_clause}}).
Update **{{prd}}** if items use passes:true/false — mark completed issues.

Append to {{progress_file}} and output on their own lines when done:

RALPH_E2E_COMPLETE
RALPH_ALL_COMPLETE
