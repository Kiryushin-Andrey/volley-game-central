# Ralph loop state

Orchestrator: discover child issues (skill **ralph-cloud-loop**), then `scripts/ralph-loop.py`.

| File | Purpose |
|------|---------|
| `ralph-state.json` | Completed issues, E2E suites, cloud session URLs |
| `logs/` | Agent output per iteration |
| `screenshots/` | E2E screenshots |
| `STEERING.md` | Optional overrides (`STEERING.example.md`) |
| `examples/player-levels.sh` | Example flags (add `--child-issues` after discovery) |

## Required arguments

```bash
python3 scripts/ralph-loop.py \
  --parent-issue <N> \
  --child-issues <n1> <n2> ... \
  --branch <integration-branch> \
  --prd <path-to-prd.md> \
  --e2e <path-to-e2e-plan.md> \
  [--backend local|cloud] [--push] …
```

Child issue numbers come from the orchestrator (`gh` + `## Parent` link). The script does not call GitHub.

## Local backend

```bash
python3 scripts/ralph-loop.py --help
```

Requires Cursor CLI (`agent`) and `git` only.

## Cloud backend

See `.cursor/skills/ralph-cloud-loop/SKILL.md`.

```bash
python3 scripts/launch-ralph-orchestrator.py --branch … -- \
  --parent-issue … --child-issues … --prd … --e2e … --backend cloud --push
```
