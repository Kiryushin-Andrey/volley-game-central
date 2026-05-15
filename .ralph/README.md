# Ralph loop state

Orchestrator: `scripts/ralph-player-levels-loop.py` (references only — no embedded PRD/E2E).

| File | Purpose |
|------|---------|
| `player-levels-state.json` | Completed issues + E2E suites A–D |
| `logs/` | Agent output per iteration |
| `screenshots/` | E2E screenshots (see E2E doc) |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |

Context files (read by the agent each pass):

- `CONTEXT.md`
- `docs/prd/player-levels-and-game-format.md`
- `docs/testing/e2e-player-levels-browser-agent.md`

Child issues are discovered via `gh` (body contains `## Parent` → parent issue URL).
Order: issue number ascending. E2E suites A/B/C = 1st/2nd/3rd child (see E2E doc §11).

## Usage

```bash
./scripts/ralph-player-levels-loop.py --help

# Defaults: parent #8, branch cursor/player-levels-c8a4
./scripts/ralph-player-levels-loop.py --dry-run
./scripts/ralph-player-levels-loop.py --push
./scripts/ralph-player-levels-loop.py --from 21

# Override discovery
./scripts/ralph-player-levels-loop.py --child-issues 20 21 22

# Full configuration via flags
./scripts/ralph-player-levels-loop.py \
  --repo Kiryushin-Andrey/volley-game-central \
  --parent-issue 8 \
  --branch cursor/player-levels-c8a4 \
  --base main
```
