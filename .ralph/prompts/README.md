# Ralph prompt templates

Edit these markdown files to change what agents see. Templates use **[Handlebars](https://handlebarsjs.com/)** (via `scripts/ralph`).

Override the directory with `--prompts-dir` on `ralph-loop.sh` or `launch-ralph-orchestrator.sh`.

## Layout

| Location | Role |
|----------|------|
| `*-prompt.md` (this directory) | Full prompt for one agent session |
| `partials/*.md` | Shared blocks included via `{{> name}}` |

## Syntax

| Construct | Example |
|-----------|---------|
| Variable | `{{prd}}`, `{{issue_number}}` |
| Conditional | `{{#if has_children}}…{{else}}…{{/if}}` |
| Partial | `{{> workflow}}`, `{{> refs-block}}` |

Partials are registered from `partials/` by basename (e.g. `workflow.md` → `{{> workflow}}`).

Boolean context flags: `has_children`, `has_steering`, `has_issue`, `is_cloud`.

## Files

### Prompts

| File | Role |
|------|------|
| `loop-iteration-prompt.md` | E2E gate (A–D) then issue work; partial progress or `RALPH_ISSUE_COMPLETE` |
| `final-pass-prompt.md` | Epic: Suite D, unit tests, draft PR |
| `orchestrator-prompt.md` | Cloud orchestrator (`{{#if has_children}}` for step 2) |

### Partials (`partials/`)

| File | Role |
|------|------|
| `cloud-preamble.md` | Cloud VM intro (`{{#if is_cloud}}` in loop + final prompts) |
| `workflow.md` | Workflow + feedback loops |
| `e2e-gate.md` | Full Suites A–D before feature work; E2E-first policy |
| `refs-block.md` | Required files list |

Context fields are built in `scripts/ralph/src/loop.ts` and `launch-orchestrator.ts`.
