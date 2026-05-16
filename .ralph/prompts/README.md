# Ralph prompt templates

Edit these markdown files to change what agents see. Placeholders use `{name}` and are filled in by `scripts/ralph-loop.py` and `scripts/launch-ralph-orchestrator.py`.

Override the directory with `--prompts-dir` on either script.

| File | Used for |
|------|----------|
| `progress-header.md` | Initial `.ralph/progress.txt` |
| `cloud-preamble.md` | Prepended to every cloud child pass |
| `workflow.md` | Shared “read PRD / progress / one task” block |
| `feedback-block.md` | Feedback loops list (body: `{feedback_loops}`) |
| `completion-single.md` | Pass done sigil for impl/E2E |
| `completion-with-alt.md` | Final pass (primary + `COMPLETE` alt) |
| `refs-block.md` | Required files list per pass |
| `impl.md` | Implementation pass |
| `e2e.md` | Browser E2E pass |
| `final.md` | Final regression + PR pass |
| `orchestrator.md` | Cloud orchestrator agent |
| `orchestrator-discover-children.md` | Orchestrator step 2 when children unknown |
| `orchestrator-children-known.md` | Orchestrator step 2 when `--child-issues` set |
