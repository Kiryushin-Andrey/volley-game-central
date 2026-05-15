# Ralph loop state

Used by `scripts/ralph-player-levels-loop.sh`.

| File | Purpose |
|------|---------|
| `player-levels-state.json` | Tracks completed issues (#20–#22), E2E suites A–D, final pass |
| `logs/` | Agent stdout per implementation / E2E / final iteration |
| `screenshots/` | Browser E2E screenshots (Suite A–D) |
| `STEERING.md` | Optional human overrides (create from `STEERING.example.md`) |

## E2E mapping

| Issue | Suite | Promise |
|-------|-------|---------|
| #20 | A | `RALPH_E2E_COMPLETE SUITE_A` |
| #21 | B | `RALPH_E2E_COMPLETE SUITE_B` |
| #22 | C | `RALPH_E2E_COMPLETE SUITE_C` |
| Final | D | `RALPH_E2E_COMPLETE SUITE_D` |

Plan: `docs/testing/e2e-player-levels-browser-agent.md`

Reset: delete `player-levels-state.json` to re-run all slices.
