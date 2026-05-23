---
name: start-local-cursor-session
description: Starts a new interactive local Cursor Agent CLI session (agent command) in the project directory. Use when the user wants a new local Cursor session, Cursor CLI agent, terminal agent, or to run agent on this machine (not cloud).
---

# Start a local Cursor session

Open a **new interactive** [Cursor Agent CLI](https://cursor.com/docs/cli/using) session on the user's machine. Default command: `agent` (also packaged as `cursor-agent` on some installs).

Distinct from:

- **Cloud** — use `start-cursor-cloud-session` or `&` in the CLI to hand off to cloud
- **One-shot / CI** — `agent -p --force -- "prompt"` (non-interactive; Ralph `local-cursor` worker)

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| `agent` on `PATH` | Install Cursor Agent CLI; verify with `agent about` or `agent status` |
| Auth | `agent login` if `agent status` shows logged out |
| Project directory | Run from repo root (`cd "$(git rev-parse --show-toplevel)"`) |

## Quick start (new interactive session)

```bash
cd "$(git rev-parse --show-toplevel)"
agent
```

With an initial prompt:

```bash
agent "Explain this repo and list the main apps"
```

## Workflow

1. **Confirm local vs cloud** — If they want AFK / laptop-closed work, switch to `start-cursor-cloud-session`.
2. **cd to repo root** — So rules, skills, and `.cursor/` apply.
3. **Start session** — Bare `agent` for empty chat, or quoted prompt for first message.
4. **Optional isolation** — `agent --worktree` uses a new git worktree under `~/.cursor/worktrees` instead of dirtying the main checkout.
5. **Tell the user how to attach** — They interact in that terminal (or IDE terminal tab). For background work on this machine, use `tmux` (see below).

## Session variants

| Goal | Command |
|------|---------|
| Brand-new chat | `agent` or `agent create-chat` (prints id for scripting) |
| Continue latest | `agent resume` or `agent --continue` |
| Resume by id | `agent --resume <thread-id>` |
| Plan-first | `agent --plan` or `agent --mode plan` |
| Isolated checkout | `agent --worktree` |
| List past chats | `agent ls` |

## Background / detached local session

When the user wants a **new** session that keeps running after you disconnect:

```bash
SESSION_NAME="cursor-$(basename "$(git rev-parse --show-toplevel)")"
tmux new-session -d -s "$SESSION_NAME" -c "$(git rev-parse --show-toplevel)" -- agent
echo "Attach: tmux attach -t $SESSION_NAME"
```

Adjust tmux config if the environment provides one (e.g. cloud VMs may use `/exec-daemon/tmux.portal.conf`).

## Non-interactive (scripting only)

Ralph and CI use print mode — **not** a new interactive session:

```bash
agent -p --force -- "Implement issue #42"
```

See `scripts/ralph/src/workers/registry.ts` (`local-cursor`).

## Related

- Cloud: `start-cursor-cloud-session`
- Ralph local worker: `scripts/ralph-loop.sh --worker local-cursor` (see `.ralph/README.md`)
