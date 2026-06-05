---
name: start-oz-cloud-session
description: Starts a new Oz (Warp) cloud agent run via the Oz API and returns the session link. Use when the user wants an Oz cloud session, Warp cloud agent, remote-oz worker, or mentions WARP_API_KEY and OZ_ENVIRONMENT_ID.
---

# Start an Oz Cloud session

Create a **new** cloud agent run on the [Oz Platform](https://docs.warp.dev/agent-platform/cloud-agents/overview/) (Warp). Each run gets a `run_id` and a shareable session URL (`session_link` or `https://oz.warp.dev/runs/...`).

For Ralph multi-issue loops, use `ralph` with `--worker remote-oz` instead of this skill.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| `WARP_API_KEY` | Oz / Warp API key |
| `OZ_ENVIRONMENT_ID` | Environment UID with repo + tooling configured — [oz.warp.dev](https://oz.warp.dev/) |
| Credits / plan | Cloud runs consume Warp credits; see [billing](https://docs.warp.dev/agent-platform/cloud-agents/team-access-billing-and-identity/) |

Optional: `jq`, `curl` for the helper script.

## Quick start

```bash
export WARP_API_KEY=...
export OZ_ENVIRONMENT_ID=...

./.ralph/scripts/start-oz-cloud-session.sh \
  --title "Short run title" \
  "Your task prompt here"
```

Prints `url=...` and the session link. Capture the URL if you need to record it. **Do not** poll or wait for completion unless the user **explicitly** asked you to watch this run.

## Workflow

1. **Confirm environment** — `OZ_ENVIRONMENT_ID` must match a configured environment (branch, secrets, MCP). Wrong env → agent lacks context.
2. **Push branch if needed** — Environments usually clone from GitHub; ensure the target branch exists on the remote before starting long AFK work.
3. **Start run** — Helper script or API `POST /agent/run`. The run executes asynchronously on Oz infrastructure.
4. **Record URL (if needed)** — Save `session_link` (or `https://oz.warp.dev/runs/{run_id}`). **Stop** — do not monitor the run.

## Ralph / recursive chaining

When **`ralph-chain-next.sh`** starts the next Oz session:

- **Fire-and-forget** — exit after create + URL; do not poll `GET /agent/runs/{run_id}` from the previous session.
- **Do not** monitor the next session from the current agent.
- **`sessions.log`** on the branch lists chained sessions for humans and cold-start workers.

Optional: paste the URL in chat only if a **human** in the same thread asked for it — not required for Ralph iteration handoff.

## Helper script options

```bash
./.ralph/scripts/start-oz-cloud-session.sh --help
```

| Flag | Effect |
|------|--------|
| `--title` | Run title (default: truncated prompt) |
| `--environment-id` | Overrides `OZ_ENVIRONMENT_ID` |
| `--config-name` | Oz config name (default: `ad-hoc`) |
| `--model-id` | Optional model |
| `--auto-pr` | `create_pr: true` |

## API (manual)

```bash
curl -fsS \
  -H "Authorization: Bearer $WARP_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST https://app.warp.dev/api/v1/agent/run \
  -d '{
    "prompt": "…",
    "title": "…",
    "config": {
      "environment_id": "'"$OZ_ENVIRONMENT_ID"'",
      "name": "ad-hoc"
    }
  }'
```

Docs: [Oz API and SDK](https://docs.warp.dev/reference/api-and-sdk/), [cloud agents overview](https://docs.warp.dev/agent-platform/cloud-agents/overview/).

## Related

- Recursive Ralph: `scripts/ralph-chain-next.sh` with `"worker": "remote-oz"` in `.ralph/ralph.config.json` (see `.ralph/README.md`, ralph skill)
