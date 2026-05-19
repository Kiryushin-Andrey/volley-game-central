{{#if is_cloud}}{{> cloud-preamble}}

{{/if}}Ralph loop — final pass.

{{> workflow}}
{{> refs-block}}

## E2E

Run **full Suites A, B, C, and D** from {{e2e}} (§2–§8). No Fail may remain. Fix any regression before closing the epic.

Confirm {{e2e}} matches shipped behavior for all child issues; update scenarios if anything drifted.

Screenshots: {{screenshots_dir}}/ for any new failures.

## Close epic

Run unit tests. One draft PR {{branch}} → {{base}} ({{closes_clause}}).
Update {{prd}} if items use passes:true/false — mark completed issues.

Append to {{progress_file}} and output on their own lines when done:

RALPH_E2E_COMPLETE SUITE_D
RALPH_ALL_COMPLETE
