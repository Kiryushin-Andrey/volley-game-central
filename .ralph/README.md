# Ralph loop state

Orchestrator: find child issues, **order by dependency** (read + reason — skill **ralph-cloud-loop**), run `scripts/ralph-loop.sh` in the **foreground**, and **proactively report** after each iteration (see skill + `prompts/orchestrator-prompt.md`).

Implementation: TypeScript under `scripts/ralph/` (run via `tsx`).

Pattern: [Getting started with Ralph](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

| File / folder | Purpose |
|---------------|---------|
| `prompts/` | Agent prompt templates (edit `.md` files; see `prompts/README.md`) |
| `progress.template.txt` | Seed for new `progress.txt` (committed) |
| `progress.txt` | **Sprint resume source** — agents append narrative + `RALPH_*` sigils; commit on integration branch each pass |
| E2E checklist | Default: `docs/playwright-e2e-scenarios.md` (override with `--e2e` only if needed) |
| `logs/` | Agent stdout per iteration on the loop host (gitignored) |
| `screenshots/` | E2E screenshots (gitignored) |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |
| `examples/example-epic.sh` | Example flag template (add `--child-issues` after discovery) |

There is **no** `ralph-state.json`. The harness resumes **only** by reading `.ralph/progress.txt` on the sprint branch after `git pull`. Sigils in commit messages are **not** used.

After **each** cloud/local agent run, the orchestrator pulls the sprint branch and re-reads `progress.txt` to decide whether an issue is done (not the streamed agent log). Cloud SSE streams have **no** fetch timeout; if the stream drops, the harness polls run status until `FINISHED`, then still checks `progress.txt`.

## Cloud resume

1. Start a new orchestrator (fresh VM is fine) with the same `--branch` and `--child-issues`.
2. Use `--push` so agents keep `progress.txt` on the remote branch.
3. The harness runs `git pull` on the sprint branch, parses `RALPH_ISSUE_COMPLETE #n` (or legacy `RALPH_SLICE_COMPLETE #n`) **in `progress.txt` only**, and skips finished issues.
4. If a milestone exists only in a commit message and not in `progress.txt`, the loop will **not** treat it as done — update `progress.txt` and push.

## Modes

| Mode | Command | Use when |
|------|---------|----------|
| HITL | `scripts/ralph-once.sh` or `--once` | Learning, refining prompts, risky work |
| AFK | `scripts/ralph-loop.sh` + `--max-iterations N` | Unattended runs; always cap iterations |

## Setup

```bash
cd scripts/ralph && npm install
```

## Required arguments

```bash
./scripts/ralph-loop.sh \
  --parent-issue <N> \
  --child-issues <n1> <n2> ... \
  --branch <integration-branch> \
  --prd <path-to-epic-prd.md> \
  [--e2e docs/playwright-e2e-scenarios.md] \
  [--backend local|cloud] [--push] [--once] [--max-iterations N] \
  [--cloud-model default] [--prompts-dir .ralph/prompts] …
```

Cloud backend runs child agents via a pluggable provider (`scripts/ralph/src/agents/`):

| Provider | Flag | Credentials | Notes |
|----------|------|-------------|-------|
| **cursor** (default) | `--cloud-provider cursor` | `CURSOR_API_KEY`, `--cloud-model` | Cursor Cloud Agents API |
| **oz** (Warp) | `--cloud-provider oz` | `WARP_API_KEY`, `OZ_ENVIRONMENT_ID` | [Oz Platform](https://docs.warp.dev/agent-platform/cloud-agents/overview/) |

```bash
# Cursor (default)
./scripts/ralph-loop.sh ... --backend cloud --push ...

# Warp Oz
./scripts/ralph-loop.sh ... --backend cloud --cloud-provider oz \
  --oz-environment-id <uid> --push ...
```

Run `./scripts/ralph-loop.sh --help` for all flags.

- **`--prd`** — feature-specific epic PRD (required).
- **`--e2e`** — optional; defaults to project-wide Playwright checklist. Do not point this at feature-only browser-agent plans.

Child issue numbers and **order** come from the orchestrator. The script does not call GitHub.

## Local backend

```bash
./scripts/ralph-loop.sh --help
./scripts/ralph-once.sh --parent-issue … --child-issues … --branch … --prd … --dry-run
```

Requires Cursor CLI (`agent`), `git`, Node.js 18+, and Playwright deps (`npx playwright install` if needed).

## Cloud backend

See `.cursor/skills/ralph-cloud-loop/SKILL.md`.

```bash
./scripts/launch-ralph-orchestrator.sh --branch … -- \
  --parent-issue … --child-issues … --prd … --backend cloud --push --max-iterations 50
```

When the epic is done, remove or trim `progress.txt` on the branch in a cleanup commit.
