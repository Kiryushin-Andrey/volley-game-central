Ralph workflow (each pass is a fresh context — read these first):
1. {{prd}} — scope and acceptance criteria for this epic.
2. {{progress_file}} on branch {{branch}} — what prior iterations did (append every time; completion sigil only when an issue is fully done).
3. {{e2e}} — full browser E2E plan; **Suites A–D run every iteration** before feature work.

Work style:
- One **issue** per loop iteration — not other child issues, not the whole epic in one go.
- **E2E first:** run full Suites A, B, C, D; if any **Fail**, fix one failure before issue feature work. **Blocked** (documented) is OK when zero Fails.
- Read {{progress_file}}; continue open work on the current issue. Partial iterations update the log only (no sigil). Emit `RALPH_ISSUE_COMPLETE #n` only when the issue is done **and** E2E specs match the app.
- After changes: run feedback loops, re-run full A–D, append to {{progress_file}}, commit, push to {{branch}}.
{{#if is_cloud}}
- Cloud handoff: the next agent session is a fresh VM — it only sees what you pushed. Always include an updated {{progress_file}} in your commit.
{{/if}}

Before committing, run feedback loops for the code you touched:
{{feedback_loops}}
Do not commit if a loop you ran fails. Do not commit if full Suites A–D still have any Fail.
