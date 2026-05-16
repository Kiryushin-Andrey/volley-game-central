# Ralph prompt templates

Edit these markdown files to change what agents see. Templates use **[Handlebars](https://handlebarsjs.com/)** (via `scripts/ralph`).

Override the directory with `--prompts-dir` on `ralph-loop.sh` or `launch-ralph-orchestrator.sh`.

## Syntax

| Construct | Example |
|-----------|---------|
| Variable | `{{prd}}`, `{{issue_number}}` |
| Conditional | `{{#if has_children}}…{{else}}…{{/if}}` |
| Partial (shared `.md` included from multiple parents) | `{{> workflow}}`, `{{> refs-block}}` |

Every `*.md` file here (except `README.md`) is registered as a Handlebars partial. Use partials only when the same block is included from **more than one** template; otherwise embed the text directly.

Boolean context flags: `has_children`, `has_steering`, `has_issue`.

## Files

| File | Used for |
|------|----------|
| `progress-header.md` | Initial `.ralph/progress.txt` (raw load, not composed) |
| `cloud-preamble.md` | Prepended to every cloud child pass |
| `workflow.md` | Shared workflow + feedback loops (`{{> …}}` from `slice`, `final`) |
| `refs-block.md` | Required files list (`{{> …}}` from `slice`, `final`) |
| `slice.md` | Per pass: one PRD item + E2E + completion sigils |
| `final.md` | Final regression + PR pass |
| `orchestrator.md` | Cloud orchestrator (`{{#if has_children}}` for step 2) |

Context fields are built in `scripts/ralph/src/loop.ts` and `launch-orchestrator.ts`.
