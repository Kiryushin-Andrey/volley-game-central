# Ralph prompt templates

Edit these markdown files to change what agents see. Templates use **[Handlebars](https://handlebarsjs.com/)** (via `scripts/ralph`).

Override the directory with `--prompts-dir` on `ralph-loop.sh` or `launch-ralph-orchestrator.sh`.

## Naming

| Suffix | Meaning | Example |
|--------|---------|---------|
| `-pass` | Full prompt for one agent session | `slice-pass.md`, `orchestrator-pass.md` |
| `-partial` | Shared block included via `{{> …}}` from multiple passes | `workflow-partial.md` |
| (none) | Static text not composed as a pass | `progress-header.md` |

## Syntax

| Construct | Example |
|-----------|---------|
| Variable | `{{prd}}`, `{{issue_number}}` |
| Conditional | `{{#if has_children}}…{{else}}…{{/if}}` |
| Partial | `{{> workflow-partial}}`, `{{> refs-block-partial}}` |

Every `*.md` file here (except `README.md`) is registered as a Handlebars partial. Use `-partial` files only when included from **more than one** `-pass` template.

Boolean context flags: `has_children`, `has_steering`, `has_issue`, `is_cloud`.

## Files

| File | Role |
|------|------|
| `progress-header.md` | Initial `.ralph/progress.txt` (raw load) |
| `cloud-preamble-partial.md` | Cloud VM intro (`{{#if is_cloud}}` in `slice-pass`, `final-pass`) |
| `workflow-partial.md` | Workflow + feedback loops (in `slice-pass`, `final-pass`) |
| `refs-block-partial.md` | Required files list (in `slice-pass`, `final-pass`) |
| `slice-pass.md` | Child issue: one PRD item + E2E + completion sigils |
| `final-pass.md` | Epic: Suite D, unit tests, draft PR |
| `orchestrator-pass.md` | Cloud orchestrator (`{{#if has_children}}` for step 2) |

Context fields are built in `scripts/ralph/src/loop.ts` and `launch-orchestrator.ts`.
