---
name: start-cursor-cloud-session
description: Starts a new Cursor Cloud Agent session via the Cloud Agents API and returns the session URL. Use when the user wants a Cursor cloud session, cloud agent, remote Cursor worker, AFK Cursor run, or mentions CURSOR_API_KEY and a new cloud VM.
---

# Start a Cursor Cloud session

Spin up a **new** [Cursor Cloud Agent](https://cursor.com/docs/cloud-agent/api/endpoints) on Cursor-hosted infrastructure. Each create returns a durable agent plus an initial run and a URL like `https://cursor.com/agents/...`.

This is for **one-off or hand-off cloud work**. For multi-issue Ralph loops, use the `ralph` skill with `--worker remote-cursor` instead.

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| `CURSOR_API_KEY` | [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) |
| GitHub remote | Repo URL comes from `git remote origin` unless you pass `--repo-url` |
| Pushed branch (typical) | With `workOnCurrentBranch: true`, the agent only sees commits already on the remote branch |

Optional: `jq`, `curl` (used by the helper script).

## Quick start

From the repo root, after pushing the branch the agent should use:

```bash
export CURSOR_API_KEY=...
git push -u origin "$(git branch --show-current)"

./scripts/start-cursor-cloud-session.sh \
  --branch "$(git branch --show-current)" \
  "Your task prompt here"
```

The script prints `url=...` and the session link on the last line. **Paste that URL in chat** for the user — do not rely on collapsed terminal output alone (same rule as `ralph` for `remote-cursor`).

## Workflow

1. **Confirm intent** — New cloud VM vs continuing an existing agent (follow-up runs use `POST /v1/agents/{id}/runs`, not this skill).
2. **Prepare git** — Checkout the integration branch; `git push` so the cloud VM can pull it when using `--work-on-branch` (default).
3. **Start session** — Run the helper script or `curl` (see API below).
4. **Deliver URL** — Send the `agent.url` in a normal assistant message immediately.
5. **Monitor** — User opens the URL in browser or app; poll `GET /v1/agents/{id}/runs/{runId}` or stream SSE if you need status in automation.

## Helper script options

```bash
./scripts/start-cursor-cloud-session.sh --help
```

| Flag | Effect |
|------|--------|
| `--branch NAME` | `repos[].startingRef` (default: current branch) |
| `--work-on-branch` / `--no-work-on-branch` | Push to starting ref vs new `cursor/...` branch (default: work on branch) |
| `--auto-pr` | `autoCreatePR: true` |
| `--model ID` | Model id (`default` = Auto) |
| `--env KEY=VAL` | Session `envVars` (repeatable) |

## API (manual)

```bash
curl -fsS -u "$CURSOR_API_KEY:" \
  -H "Content-Type: application/json" \
  -X POST https://api.cursor.com/v1/agents \
  -d '{
    "prompt": { "text": "…" },
    "model": { "id": "default" },
    "repos": [{ "url": "https://github.com/org/repo", "startingRef": "my-branch" }],
    "workOnCurrentBranch": true,
    "autoCreatePR": false
  }'
```

Response fields to capture: `agent.url`, `agent.id`, `run.id`. Docs: [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints).

## In-app handoff (interactive CLI)

From a **local** Cursor CLI session, prefix a message with `&` to push work to the cloud without calling the API yourself. See [Using Agent in CLI](https://cursor.com/docs/cli/using).

## Related

- Recursive Ralph: `scripts/ralph-chain-next.sh` with `"worker": "remote-cursor"` in `.ralph/ralph.config.json` (see `.ralph/README.md`, ralph skill)
