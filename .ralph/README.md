# Ralph recursive loop

Each **iteration is one agent session** with **no memory** of prior chats. When it finishes, it updates **`.ralph/progress.txt`**, runs **`scripts/ralph-chain-next.sh`** to start the **next** session (same `worker` from config unless the human changed it), appends the new session to **`.ralph/sessions.log`**, commits, and **stops**. The next agent reads only **config**, **progress.txt**, **sessions.log**, and **git** — not your conversation.

Pattern: [Getting started with Ralph](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

Skill: **ralph** (`.cursor/skills/ralph`, `.claude/skills/ralph`, `.agents/skills/` via docs).

## State on the integration branch

| File | Purpose |
|------|---------|
| `ralph.config.json` | Epic config: ordered `childIssues`, `branch`, `prd`, `worker`, `push`, … |
| `progress.txt` | Append-only narrative + `RALPH_*` sigils (resume source of truth) |
| `sessions.log` | Append-only registry: tab-separated `session_ref` + `notes` per line; seed from `sessions.template.txt` |
| `prompts/` | Handlebars templates for bootstrap / iteration |

There is **no** `ralph-state.json`. Resume by `git pull` on the sprint branch and reading `progress.txt` + `sessions.log`.

## Scripts

```bash
cd scripts/ralph && npm install   # once per clone
```

| Script | Role |
|--------|------|
| `scripts/ralph-chain-next.sh` | Plan next phase, render prompt, **start** next session, append `sessions.log`, commit, exit |
| `scripts/ralph-render-prompt.sh` | Render a prompt to stdout or `.ralph/.next-prompt.md` |
| `scripts/ralph-plan.sh` | JSON: next phase (`issue` / `done`) from progress |
| `scripts/start-cursor-cloud-session.sh` | Used by chain-next for `remote-cursor` |
| `scripts/start-oz-cloud-session.sh` | Used by chain-next for `remote-oz` |

Implementation: `scripts/ralph/src/` — prompt rendering, plan, chain-next, bootstrap-publish (no imperative loop runner; `ralph-loop.ts` / `loop.ts` / `agents/*` were removed in the recursive refactor).

## Bootstrap (once per epic)

1. Orchestrator discovers and orders child issues (skill **ralph**).
2. Writes **`.ralph/ralph.config.json`**, seeds **`progress.txt`** (with bootstrap section) and **`sessions.log`** on the integration branch.
3. **Publish** (before any worker):

   ```bash
   ./scripts/ralph-bootstrap-publish.sh
   ```

   - **Cloud** (`remote-*`): push branch + **draft PR** via `gh`
   - **Local** (`local-*`): push branch only (no PR yet)

4. Start first worker:

   ```bash
   ./scripts/ralph-chain-next.sh --bootstrap
   ```

5. Orchestrator **stops**; first iteration runs in the new session.

See **`bootstrap-prompt.md`**.

## Each iteration

Prompt: `iteration-prompt.md` (issue # from plan). The **last** child issue includes epic-closure steps in the same prompt.

At end of session (after push + progress update):

```bash
./scripts/ralph-chain-next.sh --from-notes "issue #N pass"
```

- **`RALPH_CHAINED <url|tmux:…>`** — next session started; **stop** current session.
- **`RALPH_DONE`** — all child issues have `RALPH_ISSUE_COMPLETE` in progress; epic finished.

## Worker (`ralph.config.json` → `worker`)

| `worker` | Next session started by |
|----------|-------------------------|
| `local-cursor` | Detached `tmux` + `agent -p` |
| `local-claude` | Detached `tmux` + `claude -p` |
| `local-codex` | Detached `tmux` + `codex` |
| `remote-cursor` | `start-cursor-cloud-session.sh` (API) |
| `remote-oz` | `start-oz-cloud-session.sh` (API) |

Use `"push": true` for `remote-*` so each fresh VM sees the branch.

## Resume after interruption

1. Ensure `ralph.config.json` and `progress.txt` on the branch are current.
2. Run **`./scripts/ralph-chain-next.sh`** (no `--bootstrap`) — starts the next incomplete issue, or prints `RALPH_DONE` when all slices are complete.
3. Inspect **`sessions.log`** for all session URLs/refs.

## Cleanup

When the epic is done, trim or remove `progress.txt` / `sessions.log` in a cleanup commit if desired.
