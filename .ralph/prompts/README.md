# Ralph prompt templates

Edit these markdown files to change what agents see. Templates use **[Handlebars](https://handlebarsjs.com/)** (`scripts/ralph`).

## Files

| Template | When |
|----------|------|
| `bootstrap-prompt.md` | Orchestrator sets up config and runs first `ralph-chain-next.sh --bootstrap` |
| `iteration-prompt.md` | One session on the current incomplete child issue |
| `final-pass-prompt.md` | All children complete; epic closure + `RALPH_ALL_COMPLETE` |
| `partials/` | Shared blocks (`workflow`, `session-orientation`, `chain-next`, …) |

Legacy names removed: `loop-iteration-prompt.md`, `orchestrator-prompt.md` (replaced by recursive flow).

## Template variables and paths

Template variables like `{{config_file}}`, `{{progress_file}}`, `{{sessions_file}}` resolve to paths under `.ralph/tasks/<slug>/`. For example, `{{config_file}}` resolves to `.ralph/tasks/my-epic/ralph.config.json`.

## Render locally

```bash
./scripts/ralph-render-prompt.sh --phase issue --issue-number 20
./scripts/ralph-plan.sh
```

Context is built in `scripts/ralph/src/render-context.ts` from `ralph.config.json` + `progress.txt` under `.ralph/tasks/<slug>/`.

## Chain partial

Every iteration and final pass includes **`partials/chain-next.md`**: commit, run `ralph-chain-next.sh`, record next session in `sessions.log`, **stop** (no monitoring the next run).
