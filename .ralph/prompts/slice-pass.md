Ralph loop — slice pass, issue #{{issue_number}} (one PRD item + verify in this session).

{{> workflow-partial}}
{{> refs-block-partial}}

Read {{progress_file}} first. If prior passes left PRD items open for issue #{{issue_number}}, continue the next highest-priority item — do not repeat finished work.

## 1. Implement (one item only)

Pick the single highest-priority PRD item for issue #{{issue_number}} that is not yet done.
Implement it per {{prd}} and the GitHub issue. Follow {{context}} for terms.
Do not start other PRD items for this issue in this pass.

## 2. Verify (same session)

Run the parts of Suite {{suite}} from {{e2e}} (§6–§8) that apply to what you just built.
Screenshots: {{screenshots_dir}}/.
If checks fail, fix and re-run — stay in this session.

## 3. Finish

Run feedback loops for any code you changed. Commit and push to {{branch}}.
Append to {{progress_file}}: item completed, decisions, files changed, which PRD items remain for issue #{{issue_number}}.

When one PRD item is done but more remain for issue #{{issue_number}} (commit + append progress first):
RALPH_ITEM_COMPLETE #{{issue_number}}
(or <promise>RALPH_ITEM_COMPLETE #{{issue_number}}</promise>)

When every PRD item for issue #{{issue_number}} is done AND Suite {{suite}} passes:
RALPH_SLICE_COMPLETE #{{issue_number}}
(or <promise>RALPH_SLICE_COMPLETE #{{issue_number}}</promise>)
