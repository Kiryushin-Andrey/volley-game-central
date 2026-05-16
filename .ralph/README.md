# Ralph loop state

Orchestrator: find child issues, **order by dependency** (read + reason — skill **ralph-cloud-loop**), then `scripts/ralph-loop.sh`.

Implementation: TypeScript under `scripts/ralph/` (run via `tsx`).

Pattern: [Getting started with Ralph](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

| File / folder | Purpose |
|---------------|---------|
| `prompts/` | Agent prompt templates (edit `.md` files; see `prompts/README.md`) |
| `ralph-state.json` | Harness progress on the **machine running `ralph-loop`** (gitignored; not on the integration branch) |
| `progress.template.txt` | Seed for new `progress.txt` (committed; edit header comments here) |
| `progress.txt` | Session log for agents — **commit and push on the integration branch** each pass (cloud VMs only see the branch) |
| `logs/` | Agent stdout per iteration (gitignored; stays on the loop host) |
| `screenshots/` | E2E screenshots (gitignored) |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |
| `examples/player-levels.sh` | Example flags (add `--child-issues` after discovery) |

## Cloud vs loop host

| Artifact | Loop host (orchestrator) | Integration branch (cloud child VMs) |
|----------|--------------------------|--------------------------------------|
| `ralph-state.json` | Written by the harness when sigils appear in logs | Not used — each child is a new VM |
| `progress.txt` | Optional local copy if you run locally | **Source of truth** — agents append and must push |
| `logs/` | SSE / local agent output for sigil detection | Not shared |

Child Cloud Agents do not share a filesystem with the process that runs `ralph-loop.ts`. They only share **git**. The harness advances issues using **completion lines in cloud logs**, not by reading `ralph-state.json` from the repo.

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

Use `--push` so seeded and agent-updated `progress.txt` reaches the branch. When the epic is done, remove `progress.txt` from the branch in a cleanup commit (or leave a short “epic complete” note).
