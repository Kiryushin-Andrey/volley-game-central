# Ralph loop state

Orchestrator: find child issues, **order by dependency** (read + reason — skill **ralph-cloud-loop**), then `scripts/ralph-loop.py`.

Pattern: [Getting started with Ralph](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

| File / folder | Purpose |
|---------------|---------|
| `prompts/` | Agent prompt templates (edit `.md` files; see `prompts/README.md`) |
| `ralph-state.json` | Machine progress: completed issues, E2E suites, cloud session URLs (gitignored) |
| `progress.txt` | Human/agent session log — append each pass; **commit** so the next iteration skips exploration |
| `logs/` | Agent stdout per iteration (gitignored) |
| `screenshots/` | E2E screenshots (gitignored) |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |
| `examples/player-levels.sh` | Example flags (add `--child-issues` after discovery) |

## Modes

| Mode | Command | Use when |
|------|---------|----------|
| HITL | `scripts/ralph-once.sh` or `--once` | Learning, refining prompts, risky slices |
| AFK | `scripts/ralph-loop.py` + `--max-iterations N` | Unattended runs; always cap iterations |

## Required arguments

```bash
python3 scripts/ralph-loop.py \
  --parent-issue <N> \
  --child-issues <n1> <n2> ... \
  --branch <integration-branch> \
  --prd <path-to-prd.md> \
  --e2e <path-to-e2e-plan.md> \
  [--backend local|cloud] [--push] [--once] [--max-iterations N] \
  [--prompts-dir .ralph/prompts] …
```

Child issue numbers and **order** come from the orchestrator (reads issue text, reasons about dependencies). The script does not call GitHub.

To change agent instructions, edit files under `.ralph/prompts/` rather than Python.

## Local backend

```bash
python3 scripts/ralph-loop.py --help
./scripts/ralph-once.sh --parent-issue … --child-issues … --branch … --prd … --e2e … --dry-run
```

Requires Cursor CLI (`agent`) and `git` only.

## Cloud backend

See `.cursor/skills/ralph-cloud-loop/SKILL.md`.

```bash
python3 scripts/launch-ralph-orchestrator.py --branch … -- \
  --parent-issue … --child-issues … --prd … --e2e … --backend cloud --push --max-iterations 50
```

When the epic is done, delete `progress.txt` (session-specific, not permanent docs).
