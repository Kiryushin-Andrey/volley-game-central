---
name: start-local-claude-session
description: Starts a new interactive local Claude Code CLI session in the project directory. Use when the user wants a new Claude Code session, claude CLI, terminal Claude, or local Claude agent (not cloud).
---

# Start a local Claude Code session

Launch a **new interactive** [Claude Code](https://code.claude.com/docs/en/quickstart) REPL in the terminal. Command: `claude`.

Not the same as:

- **Print / SDK one-shot** — `claude -p "query"` then exit (Ralph `local-claude` worker)
- **Web / desktop** — claude.ai/code or the desktop app (different product surface)

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| `claude` on `PATH` | Install per [quickstart](https://code.claude.com/docs/en/quickstart) |
| Login | First run prompts login; or `/login` inside a session |
| Project directory | `cd` to repo root before starting |

## Quick start

```bash
cd "$(git rev-parse --show-toplevel)"
claude
```

With an initial prompt:

```bash
claude "Review the auth flow in backend/src/routes"
```

## Workflow

1. **Confirm local interactive** — For unattended API/cloud, use Oz or Cursor cloud skills instead.
2. **cd to repo root** — Claude picks up `CLAUDE.md`, skills under `.claude/skills/`, etc.
3. **Start** — `claude` or `claude "first message"`.
4. **Fresh context when switching tasks** — User can `/clear` inside the session for a new topic without exiting.
5. **Detached session** — Use `tmux` if they need the REPL to survive disconnect (see below).

## Session variants

| Goal | Command |
|------|---------|
| New session (default) | `claude` |
| Continue most recent in cwd | `claude -c` / `claude --continue` |
| Resume by name/id | `claude -r` / `claude --resume [id]` |
| Fork from resume | `claude --resume <id> --fork-session` |
| Isolated git worktree | `claude -w` / `claude --worktree` |
| Fixed session UUID | `claude --session-id "<uuid>"` |

Inside the REPL: `/help`, `/resume`, `/clear`, `exit` or Ctrl+D to quit.

## Background / detached local session

```bash
SESSION_NAME="claude-$(basename "$(git rev-parse --show-toplevel)")"
tmux new-session -d -s "$SESSION_NAME" -c "$(git rev-parse --show-toplevel)" -- claude
echo "Attach: tmux attach -t $SESSION_NAME"
```

## Non-interactive (scripting only)

Ralph `local-claude` worker:

```bash
claude -p "Your prompt" --permission-mode acceptEdits
```

## Related

- Recursive Ralph: `ralph.config.json` with `"worker": "local-claude"` + `.ralph/scripts/ralph-chain-next.sh` (see `.ralph/README.md`)
- Repo skills path: `.claude/skills/`
