# Ralph loop state

Orchestrator: find child issues, **order by dependency** (read + reason — skill **ralph-cloud-loop**), then `scripts/ralph-loop.sh`.

Implementation: TypeScript under `scripts/ralph/` (run via `tsx`).

Pattern: [Getting started with Ralph](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

| File / folder | Purpose |
|---------------|---------|
| `prompts/` | Agent prompt templates (edit `.md` files; see `prompts/README.md`) |
| `ralph-state.json` | Machine progress: completed issues, per-issue item pass counts, E2E suites (gitignored) |
| `progress.txt` | Human/agent session log — append each pass; commit/push during the sprint (gitignored locally) |
| `logs/` | Agent stdout per iteration (gitignored) |
| `screenshots/` | E2E screenshots (gitignored) |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |
| `examples/player-levels.sh` | Example flags (add `--child-issues` after discovery) |

## Modes

| Mode | Command | Use when |
|------|---------|----------|
| HITL | `scripts/ralph-once.sh` or `--once` | Learning, refining prompts, risky slices |
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
  --prd <path-to-prd.md> \
  --e2e <path-to-e2e-plan.md> \
  [--backend local|cloud] [--push] [--once] [--max-iterations N] \
  [--prompts-dir .ralph/prompts] …
```

Child issue numbers and **order** come from the orchestrator. The script does not call GitHub.

To change agent instructions, edit files under `.ralph/prompts/`.

## Local backend

```bash
./scripts/ralph-loop.sh --help
./scripts/ralph-once.sh --parent-issue … --child-issues … --branch … --prd … --e2e … --dry-run
```

Requires Cursor CLI (`agent`), `git`, and Node.js 18+.

## Cloud backend

See `.cursor/skills/ralph-cloud-loop/SKILL.md`.

```bash
./scripts/launch-ralph-orchestrator.sh --branch … -- \
  --parent-issue … --child-issues … --prd … --e2e … --backend cloud --push --max-iterations 50
```

When the epic is done, delete `progress.txt` (session-specific, not permanent docs).
