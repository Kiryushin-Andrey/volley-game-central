# Ralph recursive loop

Each **iteration is one agent session** with **no memory** of prior chats. When it finishes, it updates **`progress.txt`**, runs **`.ralph/scripts/ralph-chain-next.sh`** to start the **next** session (same `worker` from config unless the human changed it), appends the new session to **`sessions.log`**, commits, and **stops**. The next agent reads only **config**, **progress.txt**, **sessions.log**, and **git** — not your conversation.

Pattern: [Getting started with Ralph](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

Skill: **ralph** (`.cursor/skills/ralph`, `.claude/skills/ralph`, `.agents/skills/` via docs).

## Directory layout

Harness files (templates, prompts, examples) live directly under `.ralph/`. Feature-specific state lives under **`.ralph/tasks/<slug>/`**, where `<slug>` is derived from the parent issue title (lowercase, hyphens, no special chars — e.g. `player-levels-and-game-format`).

```
.ralph/
  .current-task                          # contains the slug of the active task
  ralph.config.example.json              # template for new configs
  progress.template.txt                  # template for new progress files
  progress.example.txt                   # example progress file
  sessions.template.txt                  # template for new sessions logs
  STEERING.example.md                    # optional per-sprint overrides template
  README.md                              # this file
  prompts/                               # Handlebars templates
  examples/                              # example scripts
  tasks/
    <slug>/                              # one folder per epic/feature
      ralph.config.json                  # epic config for this feature
      progress.txt                       # append-only narrative + RALPH_* sigils
      sessions.log                       # append-only session registry
```

**`.current-task`** — a single line containing the active task slug. Written during bootstrap; read by workers to locate `tasks/<slug>/`. This file must be committed so chained sessions resolve the same task folder from branch state.

## State on the integration branch

| File | Purpose |
|------|---------|
| `.ralph/tasks/<slug>/ralph.config.json` | Epic config: ordered `childIssues`, `branch`, `prd`, `worker`, `push`, … |
| `.ralph/tasks/<slug>/progress.txt` | Append-only narrative + `RALPH_*` sigils (resume source of truth) |
| `.ralph/tasks/<slug>/sessions.log` | Append-only registry of every chained session (URL or `tmux:name`); seed from `sessions.template.txt` |
| `.ralph/prompts/` | Handlebars templates for bootstrap / iteration / final |
| `.ralph/.current-task` | Active task slug (committed with branch state) |

There is **no** `ralph-state.json`. Resume by `git pull` on the sprint branch and reading `progress.txt` + `sessions.log` under the task's slug folder.

### Slug derivation

The slug is derived from the parent issue title: lowercase, replace spaces/special chars with hyphens, strip consecutive hyphens, trim leading/trailing hyphens. Examples:

- "Player Levels and Game Format" → `player-levels-and-game-format`
- "Auth: SSO Integration" → `auth-sso-integration`
- "Fix #123 — Login Bug" → `fix-123-login-bug`

The slug is used as the folder name under `tasks/` and is read from `.current-task`.

## Scripts

```bash
cd .ralph/scripts/ralph && npm install   # once per clone
```

| Script | Role |
|--------|------|
| `.ralph/scripts/ralph-chain-next.sh` | Plan next phase, render prompt, **start** next session, append `sessions.log`, commit, exit |
| `.ralph/scripts/ralph-render-prompt.sh` | Render a prompt to stdout or `.ralph/.next-prompt.md` |
| `.ralph/scripts/ralph-plan.sh` | JSON: next phase (`issue` / `final` / `done`) from progress |
| `.ralph/scripts/start-cursor-cloud-session.sh` | Used by chain-next for `remote-cursor` |
| `.ralph/scripts/start-oz-cloud-session.sh` | Used by chain-next for `remote-oz` |

Implementation: `.ralph/scripts/ralph/src/` (prompt rendering + chaining only).

Ralph scripts should resolve the active task exclusively from `.ralph/.current-task`. If `.current-task` is missing, empty, or points to a non-existing `tasks/<slug>/` folder, they should error and stop.

## Bootstrap (once per epic)

1. Orchestrator discovers and orders child issues (skill **ralph**).
2. **Derives the slug** from the parent issue title.
3. Creates **`.ralph/tasks/<slug>/`** and writes **`ralph.config.json`**, seeds **`progress.txt`** and **`sessions.log`** there.
4. Writes the slug to **`.ralph/.current-task`**.
5. **Publish** (before any worker):

   ```bash
   ./.ralph/scripts/ralph-bootstrap-publish.sh
   ```

   - **Cloud** (`remote-*`): push branch + **draft PR** via `gh`
   - **Local** (`local-*`): push branch only (no PR yet)

6. Start first worker:

   ```bash
   ./.ralph/scripts/ralph-chain-next.sh --bootstrap
   ```

7. Orchestrator **stops**; first iteration runs in the new session.

See **`bootstrap-prompt.md`**.

## Each iteration

Prompt: `iteration-prompt.md` (issue # from plan) or `final-pass-prompt.md`.

Worker reads `.ralph/.current-task` to find the active slug, then reads config from `.ralph/tasks/<slug>/ralph.config.json`.

At end of session (after push + progress update):

```bash
./.ralph/scripts/ralph-chain-next.sh --from-notes "issue #N pass"
```

- **`RALPH_CHAINED <url|tmux:…>`** — next session started; **stop** current session.
- **`RALPH_DONE`** — `RALPH_ALL_COMPLETE` in progress; epic finished.

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

1. Read **`.ralph/.current-task`** for the active slug (or check `tasks/` for existing folders).
2. Ensure `ralph.config.json` and `progress.txt` under `.ralph/tasks/<slug>/` on the branch are current.
3. Run **`./.ralph/scripts/ralph-chain-next.sh`** (no `--bootstrap`) — starts the next incomplete issue or final pass.
4. Inspect **`.ralph/tasks/<slug>/sessions.log`** for all session URLs/refs.
If step 1 does not resolve to an existing `tasks/<slug>/` folder, scripts should fail fast and you should fix `.ralph/.current-task` before retrying.

## Cleanup

When the epic is done, trim or remove the task folder under `.ralph/tasks/<slug>/` in a cleanup commit if desired.
