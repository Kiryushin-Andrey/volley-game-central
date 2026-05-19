{{#if is_cloud}}{{> cloud-preamble}}

{{/if}}Ralph loop — issue #{{issue_number}} (one iteration; continue until this issue is fully done).

{{> workflow}}
{{> refs-block}}

Read {{progress_file}} and GitHub issue #{{issue_number}} first. Continue where prior iterations left off — do not redo finished work on this issue. Do not work on other child issues this iteration.

{{> e2e-gate}}

## Implement (only after E2E gate is green)

Make a coherent chunk of progress on issue #{{issue_number}} per {{prd}}, the issue body, and {{context}}.
If the issue is large, prefer one focused chunk of work, not the entire issue in one session.

When you change product behavior, update **{{e2e}}** (and automated tests if the repo has them) in the **same iteration** so specifications match reality.

## Finish

Run feedback loops for any code you changed. Commit and push to {{branch}}.
Append to {{progress_file}}: dated section for issue #{{issue_number}}, E2E gate result (A–D), what you did, decisions, files touched, and what remains.

**Partial iteration** (more work remains on #{{issue_number}}, or only E2E fixes): do **not** emit a completion sigil. Push an updated {{progress_file}}.

**Issue finished** — only when acceptance criteria are met, **full Suites A–D have no Fail**, {{e2e}} is updated for your changes (if applicable), and Suite **{{suite}}** scenarios for this issue pass. Add on its own line inside {{progress_file}} (and in your final message):

RALPH_ISSUE_COMPLETE #{{issue_number}}

(Legacy alias: `RALPH_SLICE_COMPLETE #{{issue_number}}`.)
