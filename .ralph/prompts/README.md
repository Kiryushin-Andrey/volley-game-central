# Ralph prompt templates

Edit these markdown files to change what agents see. Templates use **[Handlebars](https://handlebarsjs.com/)** (via `scripts/ralph`).

Override the directory with `--prompts-dir` on `ralph-loop.sh` or `launch-ralph-orchestrator.sh`.

## Syntax

| Construct | Example |
|-----------|---------|
| Variable | `{{prd}}`, `{{issue_number}}` |
| Conditional | `{{#if has_children}}…{{else}}…{{/if}}` |
| Partial (include another `.md` file) | `{{> workflow}}`, `{{> refs-block}}` |

Partials are every `*.md` file in this folder (except `README.md`), registered by basename.

Boolean context flags used today: `has_children`, `has_steering`, `has_issue`.

## Files

| File | Used for |
|------|----------|
| `progress-header.md` | Initial `.ralph/progress.txt` |
| `cloud-preamble.md` | Prepended to every cloud child pass |
| `workflow.md` | Shared workflow block (includes `{{> feedback-block}}`) |
| `feedback-block.md` | Feedback loops list |
| `completion-slice.md` | ITEM vs SLICE sigils (partial) |
| `refs-block.md` | Required files list (optional steering / issue lines) |
| `slice.md` | Per pass: one PRD item + E2E (composes partials) |
| `final.md` | Final regression + PR pass |
| `orchestrator.md` | Cloud orchestrator (`{{#if has_children}}` for step 2) |

Context fields are built in `scripts/ralph/src/loop.ts` and `launch-orchestrator.ts`.
