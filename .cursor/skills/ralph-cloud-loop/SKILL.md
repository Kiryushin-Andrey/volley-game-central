---
name: ralph-cloud-loop
description: Runs the generic Ralph loop with cloud orchestrator and separate cloud child sessions per step. Orchestrator discovers child GitHub issues via gh, then runs scripts/ralph-loop.py. Use for Ralph loop, epic automation, or unattended multi-issue agent runs.
---

# Ralph cloud loop

The **orchestrator** (you, or a Cloud Agent session) discovers child issues, then runs `scripts/ralph-loop.py`, which spawns a **new** Cloud Agent per implementation and per E2E pass. The Python script does **not** call GitHub; only `git` (+ `CURSOR_API_KEY` for cloud backend).

## Your job before `ralph-loop.py`

Collect these, then run the script once in the **foreground**:

| Input | Example |
|-------|---------|
| Parent issue # | `8` |
| Child issue #s (ordered) | `20 21 22` |
| Integration branch | `cursor/player-levels-c8a4` |
| PRD path | `docs/prd/player-levels-and-game-format.md` |
| E2E plan path | `docs/testing/e2e-player-levels-browser-agent.md` |

Optional: `--push`, `--from N`, `--skip-e2e`, `--cloud-env KEY=VAL`.

## Step 1 — Discover child issues (orchestrator only)

Slice issues created via `/to-issues` include a **## Parent** link to the epic. Discover with `gh` (needs `gh auth` or `GH_TOKEN` in this environment — **not** required for `ralph-loop.py` itself):

```bash
REPO="$(gh repo view --json nameWithOwner -q .)"   # or owner/repo
PARENT=8

gh issue list --repo "$REPO" --state all --limit 200 --json number,body \
  | jq -r --argjson parent "$PARENT" '
      .[]
      | select(.number != $parent)
      | select(.body | test("## Parent[\\s\\S]*?/issues/" + ($parent | tostring) + "\\b"))
      | .number
    ' | sort -n
```

Sanity-check the list (count, order = slice order for E2E suites A/B/C). If discovery fails, read `docs/issues/` or the parent issue and list numbers manually.

**Record the space-separated numbers** for `--child-issues`.

## Step 2 — Run the loop

```bash
cd "$(git rev-parse --show-toplevel)"

python3 scripts/ralph-loop.py \
  --backend cloud \
  --parent-issue "$PARENT" \
  --child-issues 20 21 22 \
  --branch cursor/player-levels-c8a4 \
  --prd docs/prd/player-levels-and-game-format.md \
  --e2e docs/testing/e2e-player-levels-browser-agent.md \
  --push
```

Do **not** implement slices in the orchestrator session — only run the script. Do **not** background the script.

### Example profile (player-levels)

Discover children (step 1), then:

```bash
source .ralph/examples/player-levels.sh
# RALPH_LOOP_ARGS has parent, branch, prd, e2e — add discovered children:
python3 scripts/ralph-loop.py "${RALPH_LOOP_ARGS[@]}" --child-issues 20 21 22 --backend cloud --push
```

## Start from laptop (orchestrator in cloud)

```bash
export CURSOR_API_KEY=...
python3 scripts/launch-ralph-orchestrator.py --branch cursor/my-feature -- \
  --parent-issue 8 --child-issues 20 21 22 \
  --prd docs/prd/my-feature.md --e2e docs/testing/e2e-my-feature.md --push
```

The launch prompt tells the cloud orchestrator to follow this skill (discover if `--child-issues` omitted from args).

## Secrets

| Secret | Who needs it |
|--------|----------------|
| `CURSOR_API_KEY` | Orchestrator + child sessions (`--backend cloud`) |
| `GH_TOKEN` / `gh auth` | **Orchestrator only** (step 1 discovery) |
| GitHub App (Cursor) | git clone/push in cloud VMs — no extra PAT usually |

## After the run

Report exit code and `cloud_sessions` from `.ralph/ralph-state.json`. Sessions: [cursor.com/agents](https://cursor.com/agents).

## Resume

Re-run discovery if needed, then:

```bash
python3 scripts/ralph-loop.py ... --from 21
```

(state in `.ralph/ralph-state.json`)
