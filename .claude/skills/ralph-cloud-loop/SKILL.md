---
name: ralph-cloud-loop
description: Runs the generic Ralph loop with a cloud orchestrator and separate cloud child sessions per implementation and E2E step. Use when user wants Ralph loop, epic automation, overnight/unattended agent runs, or to close laptop while a multi-issue loop runs.
---

# Ralph cloud loop

Generic orchestrator for a **parent GitHub issue** and its **child slice issues**. Domain logic lives in files you pass (`--prd`, `--e2e`, `CONTEXT.md`) and in GitHub issue bodies — not in the script.

| Layer | What | Where |
|-------|------|--------|
| **Orchestrator** | `scripts/ralph-loop.py --backend cloud` | One Cloud Agent (long-lived) |
| **Workers** | Each impl + each E2E pass | **New** Cloud Agent per pass |

Sessions: [cursor.com/agents](https://cursor.com/agents) and Cursor desktop.

## Required flags (every run)

```bash
--parent-issue <N>    # epic / PRD issue
--branch <name>       # integration branch (one combined PR)
--prd <path>          # PRD for this epic
--e2e <path>          # browser E2E plan (suite A/B/C = child order; §11 in doc)
```

`--repo` defaults to `git remote origin`. See `scripts/ralph-loop.py --help`.

## Example: player-levels epic

```bash
source .ralph/examples/player-levels.sh
python3 scripts/ralph-loop.py "${RALPH_LOOP_ARGS[@]}" --backend cloud --push
```

Or:

```bash
python3 scripts/ralph-loop.py \
  --parent-issue 8 \
  --branch cursor/player-levels-c8a4 \
  --prd docs/prd/player-levels-and-game-format.md \
  --e2e docs/testing/e2e-player-levels-browser-agent.md \
  --backend cloud --push
```

## Start orchestrator from laptop (then close laptop)

```bash
export CURSOR_API_KEY=...

python3 scripts/launch-ralph-orchestrator.py --branch cursor/my-feature -- \
  --parent-issue 8 \
  --prd docs/prd/my-feature.md \
  --e2e docs/testing/e2e-my-feature.md \
  --push
```

## You are a Cloud Agent (orchestrator session)

1. Confirm `CURSOR_API_KEY` and `gh`.
2. Run in **foreground** (do not background):

```bash
python3 scripts/ralph-loop.py --backend cloud \
  --parent-issue … --branch … --prd … --e2e … --push
```

3. Do not implement slices yourself — the script spawns child sessions.
4. Report `cloud_sessions` from `.ralph/ralph-state.json`.

## Resume / steering

- Resume: `--from <issue#>`
- Overrides: `.ralph/STEERING.md` (see `STEERING.example.md`)
- State: `.ralph/ralph-state.json` (gitignored)

## Caveats

- Orchestrator cloud session must stay alive until `ralph-loop.py` exits.
- Each child session is independent and interactive in the UI.
- Configure [cloud agent environment](https://cursor.com/docs/cloud-agent/setup) for your stack before E2E passes.
