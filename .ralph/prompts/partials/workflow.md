Ralph workflow (each pass is a fresh context — read these first):
1. {{prd}} — scope and acceptance criteria for this epic.
2. {{progress_file}} on branch {{branch}} — what prior passes did (append when you finish, including completion sigils).

Work style:
- ONLY ONE PRD ITEM this pass on the current issue — not the whole issue, not the epic.
- Read {{progress_file}}; continue the next open item. For slice passes, record RALPH_ITEM_COMPLETE or RALPH_SLICE_COMPLETE in that file when done.
- After implementing: run feedback loops, append to {{progress_file}} (with sigils), commit, push to {{branch}}.
{{#if is_cloud}}
- Cloud handoff: the next agent session is a fresh VM — it only sees what you pushed. Always include an updated {{progress_file}} in your commit.
{{/if}}
- Progress entries: task done, key decisions, files changed, blockers for next pass. Be concise.

Before committing, run feedback loops for the code you touched:
{{feedback_loops}}
Do not commit if a loop you ran fails. Fix issues first. Prefer one logical change per commit.
