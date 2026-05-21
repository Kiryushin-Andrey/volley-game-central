# Ralph loop state

Orchestrator: find child issues, **order by dependency** (read + reason — skill **ralph-cloud-loop**), then `scripts/ralph-loop.sh`.

Implementation: TypeScript under `scripts/ralph/` (run via `tsx`).

Pattern: [Getting started with Ralph](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

| File / folder | Purpose |
|---------------|---------|
| `prompts/` | Agent prompt templates (edit `.md` files; see `prompts/README.md`) |
| `progress.template.txt` | Seed for new `progress.txt` (committed) |
| `progress.txt` | **Sprint resume source** — agents append narrative + `RALPH_*` sigils; commit on integration branch each pass |
| E2E plan (`--e2e`) | Full **Suites A–D** run every iteration before feature work; update specs when behavior changes |
| `logs/` | Agent stdout per iteration on the loop host (gitignored) |
| `screenshots/` | E2E screenshots (gitignored) |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |
| `examples/player-levels.sh` | Example flags (add `--child-issues` after discovery) |

There is **no** `ralph-state.json`. The harness resumes **only** by reading `.ralph/progress.txt` on the sprint branch after `git pull`. Sigils in commit messages are **not** used.

## Cloud resume

1. Start a new orchestrator (fresh VM is fine) with the same `--branch` and `--child-issues`.
2. Use `--push` so agents keep `progress.txt` on the remote branch.
3. The harness runs `git pull` on the sprint branch, parses `RALPH_ISSUE_COMPLETE #n` (or legacy `RALPH_SLICE_COMPLETE #n`) **in `progress.txt` only**, and skips finished issues.
4. If a milestone exists only in a commit message and not in `progress.txt`, the loop will **not** treat it as done — update `progress.txt` and push.

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

When the epic is done, remove or trim `progress.txt` on the branch in a cleanup commit.
