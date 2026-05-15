# Ralph loop state

Orchestrator: `scripts/ralph-loop.py` — generic driver; pass epic-specific paths on the command line.

| File | Purpose |
|------|---------|
| `ralph-state.json` | Completed issues, E2E suites, cloud session URLs |
| `logs/` | Agent output per iteration |
| `screenshots/` | E2E screenshots (path referenced in your E2E doc) |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |
| `examples/player-levels.sh` | Example flags for the player-levels epic |

## Required arguments

```bash
python3 scripts/ralph-loop.py \
  --parent-issue <N> \
  --branch <integration-branch> \
  --prd <path-to-prd.md> \
  --e2e <path-to-e2e-plan.md> \
  [--backend local|cloud] [--push] …
```

The script discovers child issues from GitHub (`## Parent` → parent issue) or `--child-issues`.

## Local backend

```bash
./scripts/ralph-loop.py --help
source .ralph/examples/player-levels.sh
python3 scripts/ralph-loop.py "${RALPH_LOOP_ARGS[@]}" --dry-run
```

Requires Cursor CLI (`agent`).

## Cloud backend

Each implementation, E2E, and final pass spawns a **new** Cloud Agent. Run the orchestrator in cloud so your laptop can sleep:

```bash
export CURSOR_API_KEY=...
python3 scripts/launch-ralph-orchestrator.py --branch cursor/my-feature -- \
  $(source .ralph/examples/player-levels.sh 2>/dev/null; printf '%s\n' "${RALPH_LOOP_ARGS[@]}") \
  --backend cloud --push
```

Or skill **`ralph-cloud-loop`**. See `.cursor/skills/ralph-cloud-loop/SKILL.md`.

## Migration

Renamed from `ralph-player-levels-loop.py` / `player-levels-state.json`:

- `scripts/ralph-loop.py`
- `.ralph/ralph-state.json`

Old shims forward to the new names. To resume, rename state file or pass `--state-file .ralph/player-levels-state.json`.
