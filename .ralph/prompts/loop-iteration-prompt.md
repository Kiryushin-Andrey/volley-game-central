{{#if is_cloud}}{{> cloud-preamble}}

{{/if}}Ralph loop — issue #{{issue_number}} (one iteration; continue until this issue is fully done).

{{> workflow}}
{{> refs-block}}

Read {{progress_file}} and GitHub issue #{{issue_number}} first. Continue where prior iterations left off — do not redo finished work on this issue. Do not work on other child issues this iteration.

## 1. Implement

Make a coherent chunk of progress on issue #{{issue_number}} per {{prd}}, the issue body, and {{context}}.
If the issue is large, prefer one focused slice of work (e.g. a few related checklist items), not the entire issue in one go.

## 2. Verify (same session)

Run the parts of Suite {{suite}} from {{e2e}} (§6–§8) that apply to what you changed this iteration.
On the iteration where you finish the whole issue, run the full Suite {{suite}}.
Screenshots: {{screenshots_dir}}/.
If checks fail, fix and re-run — stay in this session.

## 3. Finish

Run feedback loops for any code you changed. Commit and push to {{branch}}.
Append to {{progress_file}}: dated section for issue #{{issue_number}}, what you did, decisions, files touched, and what remains on this issue.

**Partial iteration** (more work remains on #{{issue_number}}): do **not** emit a completion sigil. Push an updated {{progress_file}} so the next iteration can continue.

**Issue finished** (all acceptance criteria for #{{issue_number}} done and full Suite {{suite}} passes): add on its own line inside {{progress_file}} (and in your final message):

RALPH_ISSUE_COMPLETE #{{issue_number}}

(Legacy alias still accepted by the harness: `RALPH_SLICE_COMPLETE #{{issue_number}}`.)
