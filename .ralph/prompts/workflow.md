Ralph workflow (each pass is a fresh context — read these first):
1. {prd} — scope and acceptance criteria for this epic.
2. {progress_file} — what prior passes did (append when you finish).
3. {state_file} — machine progress (do not edit unless fixing mistakes).

Work style:
- ONLY ONE SLICE this pass: implement, run that slice's E2E suite, fix, commit — not the whole epic.
- If the slice has several PRD items, pick the highest-priority / riskiest one only.
- After implementing: run feedback loops, commit, push to {branch}, append to progress.txt.
- Progress entries: task done, key decisions, files changed, blockers for next pass. Be concise.

{feedback_block}
