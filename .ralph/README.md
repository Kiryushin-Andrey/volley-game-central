# Ralph loop state

Orchestrator: find child issues, **order by dependency** (read + reason — skill **ralph**), choose **`--worker`**, run `scripts/ralph-loop.sh` in the **foreground**, and **proactively report** after each iteration (see skill + `prompts/orchestrator-prompt.md`).

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

After **each** worker run, the harness pulls the sprint branch and re-reads `progress.txt` to decide whether an issue is done (not the streamed agent log). Remote Cursor SSE streams have **no** fetch timeout; if the stream drops, the harness polls run status until `FINISHED`, then still checks `progress.txt`.

## Remote resume

1. Start a new orchestrator (fresh VM is fine) with the same `--branch`, `--child-issues`, and **`--worker`** (a `remote-*` value).
2. Use `--push` so workers keep `progress.txt` on the remote branch.
3. The harness runs `git pull` on the sprint branch, parses `RALPH_ISSUE_COMPLETE #n` (or legacy `RALPH_SLICE_COMPLETE #n`) **in `progress.txt` only**, and skips finished issues.
4. If a milestone exists only in a commit message and not in `progress.txt`, the loop will **not** treat it as done — update `progress.txt` and push.

## Worker placement (`--worker`)

| `--worker` | Runs on | CLI / API |
|------------|---------|------------|
| **`local-cursor`** (default) | This machine | `agent` |
| **`local-claude`** | This machine | `claude` |
| **`local-codex`** | This machine | `codex exec` |
| **`remote-cursor`** | Cursor Cloud | `CURSOR_API_KEY` + `--push` |
| **`remote-oz`** | Warp Oz | `WARP_API_KEY` + `OZ_ENVIRONMENT_ID` + `--push` |

If the user has not chosen, ask before running (see skill **ralph**).

Deprecated: `--backend`, `--cloud-provider`, `--agent-cmd` (mapped to `--worker` with a warning).

## Loop modes

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
  [--worker local-cursor] \
  [--e2e docs/playwright-e2e-scenarios.md] \
  [--push] [--once] [--max-iterations N] \
  [--prompts-dir .ralph/prompts] …
```

Run `./scripts/ralph-loop.sh --help` for all workers and flags.

- **`--prd`** — feature-specific epic PRD (required).
- **`--e2e`** — optional; defaults to project-wide Playwright checklist. Do not point this at feature-only browser-agent plans.

Child issue numbers and **order** come from the orchestrator. The script does not call GitHub.

## Local workers

Requires the CLI for your `--worker` on `PATH` (`agent`, `claude`, or `codex`), plus `git`, Node.js 18+, and Playwright deps (`npx playwright install` if needed).

## Remote orchestrator (optional)

See `.cursor/skills/ralph/SKILL.md`.

```bash
./scripts/launch-ralph-orchestrator.sh --branch … --worker remote-cursor -- \
  --parent-issue … --child-issues … --prd … --worker remote-cursor --push --max-iterations 50
```

When the epic is done, remove or trim `progress.txt` on the branch in a cleanup commit.
