Ralph workflow (each pass is a fresh context — read these first):
1. {{prd}} — scope and acceptance criteria for this epic.
2. {{progress_file}} on branch {{branch}} — what prior iterations did (append every time; completion sigil only when an issue is fully done).

Work style:
- One **issue** per loop iteration — not other child issues, not the whole epic in one go.
- Read {{progress_file}}; continue open work on the current issue. Partial iterations update the log only (no sigil). Emit `RALPH_ISSUE_COMPLETE #n` only when issue #n is fully done.
- After implementing: run feedback loops, append to {{progress_file}}, commit, push to {{branch}}.
{{#if is_cloud}}
- Cloud handoff: the next agent session is a fresh VM — it only sees what you pushed. Always include an updated {{progress_file}} in your commit.
{{/if}}
- Progress entries: task done, key decisions, files changed, what remains on this issue. Be concise.

Before committing, run feedback loops for the code you touched:
{{feedback_loops}}
Do not commit if a loop you ran fails. Fix issues first. Prefer one logical change per commit.
