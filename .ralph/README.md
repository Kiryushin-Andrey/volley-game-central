# Ralph loop state

Orchestrator: `scripts/ralph-player-levels-loop.sh` (references only — no embedded PRD/E2E).

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

Override: `RALPH_CHILD_ISSUES="20 21 22"` or `RALPH_PARENT_ISSUE=8`.
