Ralph workflow (each pass is a fresh context — read these first):
1. {{prd}} — scope and acceptance criteria for this epic.
2. {{progress_file}} — what prior passes did (append when you finish).
{{#unless is_cloud}}
3. {{state_file}} — machine progress on the loop host (do not edit unless fixing mistakes).
{{/unless}}

Work style:
- ONLY ONE PRD ITEM this pass on the current issue — not the whole issue, not the epic.
- Read {{progress_file}} on branch {{branch}}; continue the next open item. For slice passes, emit RALPH_ITEM_COMPLETE or RALPH_SLICE_COMPLETE when done.
- After implementing: run feedback loops, append to {{progress_file}}, then commit and push to {{branch}}.
{{#if is_cloud}}
- Cloud handoff: the next agent session is a fresh VM — it only sees what you pushed. Always include {{progress_file}} in your commit (with your code changes).
{{/if}}
- Progress entries: task done, key decisions, files changed, blockers for next pass. Be concise.

Before committing, run feedback loops for the code you touched:
{{feedback_loops}}
Do not commit if a loop you ran fails. Fix issues first. Prefer one logical change per commit.
