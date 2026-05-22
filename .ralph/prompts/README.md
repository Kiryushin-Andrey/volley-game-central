# Ralph prompt templates

Edit these markdown files to change what agents see. Templates use **[Handlebars](https://handlebarsjs.com/)** (via `scripts/ralph`).

Override the directory with `--prompts-dir` on `ralph-loop.sh` or `launch-ralph-orchestrator.sh`.

## Naming

| Suffix | Meaning | Example |
|--------|---------|---------|
| `-prompt` | Full prompt for one agent session | `loop-iteration-prompt.md`, `orchestrator-prompt.md` |
| `-partial` | Shared block included via `{{> …}}` from multiple prompts | `workflow.md` |
| (none) | Static text not composed as a prompt | `progress-header.md` |

## Syntax

| Construct | Example |
|-----------|---------|
| Variable | `{{prd}}`, `{{issue_number}}`, `{{e2e}}` |
| Conditional | `{{#if has_children}}…{{else}}…{{/if}}` |
| Partial | `{{> workflow}}`, `{{> e2e-gate}}` |

Partials are registered from `partials/` by basename (e.g. `workflow.md` → `{{> workflow}}`).

Boolean context flags: `has_children`, `has_steering`, `has_issue`, `is_remote`. Strings: `worker` (e.g. `local-claude`), `worker_agent` (e.g. `claude`) when `is_remote`.

## Files

### Prompts

| File | Role |
|------|------|
| `loop-iteration-prompt.md` | One iteration on a child issue (Playwright gate, then epic PRD work) |
| `final-pass-prompt.md` | Epic: full Playwright E2E, unit tests, draft PR |
| `orchestrator-prompt.md` | Cloud orchestrator (`{{#if has_children}}` for step 2) |

### Partials (`partials/`)

| File | Role |
|------|------|
| `remote-preamble.md` | Remote worker intro (`{{#if is_remote}}` in loop + final prompts) |
| `workflow.md` | Workflow + feedback loops |
| `e2e-gate.md` | Whole-project Playwright gate (`docs/playwright-e2e-scenarios.md` + `e2e/`) before **{{prd}}** work |
| `refs-block.md` | Required files list |
| `session-orientation.md` | Mandatory first steps: git branch, **{{progress_file}}**, issue or epic, `git log`, working assumption (fresh-context handoff) |

### Variables

| Variable | Typical value |
|----------|----------------|
| `{{prd}}` | Feature epic PRD (required `--prd`) |
| `{{e2e}}` | Project-wide checklist (default `docs/playwright-e2e-scenarios.md`) |
| `{{context}}` | `CONTEXT.md` |

Context fields are built in `scripts/ralph/src/loop.ts` and `launch-orchestrator.ts`.
