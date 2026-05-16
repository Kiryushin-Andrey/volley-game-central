Ralph workflow (each pass is a fresh context — read these first):
1. {{prd}} — scope and acceptance criteria for this epic.
2. {{progress_file}} — what prior passes did (append when you finish).
3. {{state_file}} — machine progress (do not edit unless fixing mistakes).

Work style:
- ONLY ONE PRD ITEM this pass on the current issue — not the whole issue, not the epic.
- Read progress.txt; continue the next open item. Emit RALPH_ITEM_COMPLETE or RALPH_SLICE_COMPLETE per completion-slice.md.
- After implementing: run feedback loops, commit, push to {{branch}}, append to progress.txt.
- Progress entries: task done, key decisions, files changed, blockers for next pass. Be concise.

{{> feedback-block}}
