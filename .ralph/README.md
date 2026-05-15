# Ralph loop state

Orchestrator: `scripts/ralph-player-levels-loop.py` (references only — no embedded PRD/E2E).

| File | Purpose |
|------|---------|
| `player-levels-state.json` | Completed issues, E2E suites, cloud session URLs |
| `logs/` | Agent output per iteration (local CLI or cloud SSE) |
| `screenshots/` | E2E screenshots (see E2E doc) |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |

Context files (read by the agent each pass):

- `CONTEXT.md`
- `docs/prd/player-levels-and-game-format.md`
- `docs/testing/e2e-player-levels-browser-agent.md`

Child issues are discovered via `gh` (body contains `## Parent` → parent issue URL).
Order: issue number ascending. E2E suites A/B/C = 1st/2nd/3rd child (see E2E doc §11).

## Local backend (default)

```bash
./scripts/ralph-player-levels-loop.py --help
./scripts/ralph-player-levels-loop.py --dry-run
./scripts/ralph-player-levels-loop.py --push
```

Requires Cursor CLI (`agent`) on your machine.

## Cloud backend

Each **implementation pass**, **E2E pass**, and **final pass** starts a **new** Cloud Agent session via the [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints). Sessions appear at [cursor.com/agents](https://cursor.com/agents) and in the Cursor desktop app (Agents / Cloud).

```bash
export CURSOR_API_KEY=...   # from Cursor Dashboard → Integrations

# Push integration branch first so cloud agents can check it out
git push -u origin cursor/player-levels-c8a4

./scripts/ralph-player-levels-loop.py \
  --backend cloud \
  --branch cursor/player-levels-c8a4 \
  --push

# Optional: env vars per session (secrets are better in dashboard)
./scripts/ralph-player-levels-loop.py --backend cloud \
  --cloud-env DEV_MODE=true \
  --cloud-env POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED=true
```

Prerequisites:

- Paid Cursor plan, GitHub app with write access to the repo
- [Cloud agent environment](https://cursor.com/docs/cloud-agent/setup) configured (`.cursor/environment.json` or dashboard snapshot) so E2E can run in the VM
- Integration branch exists on GitHub (`--push` before or during the loop)

Session URLs are stored in `player-levels-state.json` under `cloud_sessions` and printed at the end of the run.

## Common flags

| Flag | Purpose |
|------|---------|
| `--parent-issue` / `-p` | Parent epic (default 8) |
| `--child-issues 20 21 22` | Override GitHub discovery |
| `--branch` | Integration branch |
| `--from N` | Resume: skip lower issue numbers |
| `--skip-e2e` | Implementation only |
| `--dry-run` | Print prompts, no agents |
