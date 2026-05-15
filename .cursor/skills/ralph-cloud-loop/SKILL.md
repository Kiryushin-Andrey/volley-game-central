---
name: ralph-cloud-loop
description: Runs the Ralph player-levels loop with a cloud orchestrator and separate cloud child sessions per step. Use when user wants Ralph loop, player levels automation, overnight/unattended runs, or to close laptop while the loop runs.
---

# Ralph cloud loop

Run the full Ralph loop **without keeping a laptop open**:

| Layer | What | Where it runs |
|-------|------|----------------|
| **Orchestrator** | `ralph-player-levels-loop.py --backend cloud` | One Cloud Agent session (long-lived) |
| **Workers** | Each impl pass + each E2E pass | **New** Cloud Agent session per step (API) |

You can watch and interact with **every** session at [cursor.com/agents](https://cursor.com/agents) and in the Cursor desktop app.

## Prerequisites (once)

1. **Cursor API key** — [Dashboard → Integrations](https://cursor.com/dashboard/integrations) → `CURSOR_API_KEY`
2. **GitHub** — Cursor GitHub App with write access; `gh` auth or `GH_TOKEN` in [cloud secrets](https://cursor.com/dashboard/cloud-agents)
3. **Cloud environment** — [Cloud agent setup](https://cursor.com/docs/cloud-agent/setup) so `dev-start.sh`, DB, and browser E2E work in the VM (`.cursor/environment.json` or dashboard snapshot)
4. **Integration branch on GitHub** — push before starting, e.g. `cursor/player-levels-c8a4`

## Option A — Start orchestrator from laptop (then close laptop)

```bash
export CURSOR_API_KEY=...

python3 scripts/launch-ralph-cloud-orchestrator.py -- \
  --parent-issue 8 \
  --branch cursor/player-levels-c8a4 \
  --push
```

This creates **one** orchestrator Cloud Agent that runs the loop in the **foreground**. When the command returns, open the printed URL; you may close the laptop while that session runs.

## Option B — You are already a Cloud Agent (this session)

If the user asked to run the Ralph loop in cloud and you are a Cloud Agent:

1. Confirm `CURSOR_API_KEY` and `gh` are available in this environment.
2. From repo root, run in the **foreground** (do not background; the VM must stay alive for the whole loop):

```bash
python3 scripts/ralph-player-levels-loop.py \
  --backend cloud \
  --parent-issue 8 \
  --branch cursor/player-levels-c8a4 \
  --push
```

3. Do **not** implement slices yourself — the script spawns child sessions.
4. On completion, report exit code and paste `cloud_sessions` URLs from `.ralph/player-levels-state.json`.

Pass through any user flags (`--from`, `--skip-e2e`, `--child-issues`, `--cloud-env KEY=VAL`, etc.).

## Option C — Dry-run (no API spend)

```bash
python3 scripts/ralph-player-levels-loop.py --dry-run --backend cloud --child-issues 20 21 22
```

## Resume

```bash
python3 scripts/ralph-player-levels-loop.py --backend cloud --from 21 ...
```

State: `.ralph/player-levels-state.json` (committed only if you choose — usually gitignored).

## Steering

Add `.ralph/STEERING.md` (see `STEERING.example.md`) for mid-run overrides; child prompts include it when present.

## Docs

- Loop script: `scripts/ralph-player-levels-loop.py --help`
- State/logs: `.ralph/README.md`
- Domain: `CONTEXT.md`, PRD, E2E plan paths in script defaults

## Caveats

- **Orchestrator session must stay running** until the script exits; do not `nohup` the orchestrator inside cloud (the VM may stop when the agent run ends).
- **Child sessions** are independent; you can open any of them while the orchestrator waits on the API.
- **Billing**: one orchestrator run plus one cloud session per step (and per retry).
- **Secrets**: prefer dashboard secrets over `--cloud-env` for tokens.
