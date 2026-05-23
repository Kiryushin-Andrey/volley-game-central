---
name: ralph
description: Recursive Ralph epic automation — one agent session per iteration, chained via ralph-chain-next.sh. Use when the user wants Ralph, Ralph Wiggum, multi-issue slices, or epic automation. Bootstrap writes ralph.config.json; each session updates progress.txt and starts the next session (same worker unless user overrides).
---

# Ralph (recursive)

Ralph pattern: [getting started](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

**No imperative loop script.** Each session:

1. Works the **first incomplete** child issue (or **final pass** when all issues are complete in `progress.txt`).
2. Appends handoff to **`.ralph/progress.txt`** (and `RALPH_ISSUE_COMPLETE #n` when done).
3. Runs **`./scripts/ralph-chain-next.sh`** to start the **next** session with the same **`worker`** from **`.ralph/ralph.config.json`** (unless the user explicitly chose another runtime).
4. Records the new session in **`.ralph/sessions.log`** (committed by the script).
5. **Stops** — the next agent continues in the new session.

Prompts: **`.ralph/prompts/`** (`bootstrap-prompt.md`, `iteration-prompt.md`, `final-pass-prompt.md`, `partials/`).

## Choose `worker` (before bootstrap)

Ask when unclear (local vs cloud, Cursor / Claude / Codex).

| `worker` | Next session |
|----------|----------------|
| `local-cursor` | `tmux` + `agent -p` |
| `local-claude` | `tmux` + `claude -p` |
| `local-codex` | `tmux` + `codex` |
| `remote-cursor` | Cloud Agents API + `CURSOR_API_KEY`, `"push": true` |
| `remote-oz` | Oz API + `WARP_API_KEY` + `OZ_ENVIRONMENT_ID`, `"push": true` |

Helper skills: `start-cursor-cloud-session`, `start-oz-cloud-session`, `start-local-*-session` (manual starts; chain-next uses the scripts automatically).

## Setup

```bash
cd "$(git rev-parse --show-toplevel)/scripts/ralph" && npm install
```

Scripts: `scripts/ralph-chain-next.sh`, `scripts/ralph-render-prompt.sh`, `scripts/ralph-plan.sh`.

---

## Bootstrap (orchestrator — once per epic)

You are **not** the slice worker. Do **not** implement product code.

### Step 1 — Find child slices

Same as before: `gh`, `docs/issues/`, PRD. **Order by dependency** (reasoning, not numeric sort).

### Step 2 — Write config on the integration branch

Create **`.ralph/ralph.config.json`** from **`.ralph/ralph.config.example.json`**:

| Field | You supply |
|-------|------------|
| `parentIssue` | Epic issue # |
| `childIssues` | Ordered slice #s |
| `branch` | Integration branch |
| `prd` | Epic PRD path |
| `worker` | From table above |
| `push` | `true` for `remote-*` |

Seed **`.ralph/progress.txt`** and **`.ralph/sessions.log`** (from `sessions.template.txt`) if missing. Commit and **push**.

### Step 3 — Start first iteration

```bash
cd "$(git rev-parse --show-toplevel)"
./scripts/ralph-chain-next.sh --bootstrap
```

- Read **`RALPH_CHAINED`** and the session ref.
- **Cloud:** post the URL in a **normal chat message** immediately (not only in terminal output).
- **Stop** this orchestrator session.

Optional orchestrator text: see **`.ralph/prompts/bootstrap-prompt.md`**.

---

## Worker iteration (every chained session)

Rendered prompt is injected when the session is created (cloud) or via tmux (local). At session start, follow **session-orientation** in the prompt: read **config**, **progress.txt**, **sessions.log**, `git pull`.

At session end:

```bash
./scripts/ralph-chain-next.sh --from-notes "issue #<n> pass"
```

| Output | Meaning |
|--------|---------|
| `RALPH_CHAINED <url\|tmux:…>` | Next session started — **stop here** |
| `RALPH_DONE` | Epic complete (`RALPH_ALL_COMPLETE`) |

**Cloud:** post each new chained URL in chat for the user.

**Do not** run a multi-iteration loop in one session.

---

## Audit session chain

```bash
git pull origin <branch>
cat .ralph/sessions.log
grep RALPH_ .ralph/progress.txt | tail -20
./scripts/ralph-plan.sh
```

---

## Resume after failure

1. Fix `progress.txt` / branch if needed; push.
2. Run **`./scripts/ralph-chain-next.sh`** (no `--bootstrap`) — picks next issue or final from progress.
3. Continue from the new session URL in `sessions.log`.

---

## Secrets

| Secret | When |
|--------|------|
| `CURSOR_API_KEY` | `remote-cursor` |
| `WARP_API_KEY` + `OZ_ENVIRONMENT_ID` | `remote-oz` |
| `gh` | Bootstrap issue discovery |
| CLIs on PATH | `local-*` |

---

## Switching runtime mid-epic

Only when the **user explicitly** asks. Edit `worker` in `ralph.config.json`, commit, push, then `ralph-chain-next.sh`.

See **`.ralph/README.md`** for file layout and script details.
