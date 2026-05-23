---
name: start-local-codex-session
description: Starts a new interactive local OpenAI Codex CLI session (codex TUI) in the project directory. Use when the user wants a new Codex session, codex CLI, terminal Codex, or local Codex agent (not cloud).
---

# Start a local Codex session

Launch the **interactive Codex CLI TUI** with `codex`. Full-screen terminal UI for conversational coding in the repo.

Not the same as:

- **`codex exec`** — non-interactive run for scripts/CI (Ralph `local-codex` worker)
- **Codex Cloud tasks** — `codex cloud` subcommand (separate from this local TUI)

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| `codex` on `PATH` | [Codex CLI](https://developers.openai.com/codex/cli/features) |
| Auth | `codex login` on first use |
| Project directory | Prefer repo root; or `codex --cd /path/to/repo` |

## Quick start

```bash
cd "$(git rev-parse --show-toplevel)"
codex
```

With an initial prompt:

```bash
codex "Map the API routes and suggest test gaps"
```

Low-friction defaults for local work (from Codex docs):

```bash
codex --sandbox workspace-write --ask-for-approval on-request
```

## Workflow

1. **Confirm interactive TUI** — For headless automation, use `codex exec` (Ralph) not a new TUI session.
2. **cd or `--cd`** — Set working root to the git repo.
3. **Start** — `codex` or `codex "initial prompt"`.
4. **Fresh chat in same TUI** — `/new` or `/clear` (see [slash commands](https://developers.openai.com/codex/cli/slash-commands)).
5. **Detached** — `tmux` wrapper below if the session should outlive SSH.

## Session variants

| Goal | Command |
|------|---------|
| New interactive session | `codex` |
| Resume picker | `codex resume` |
| Most recent in cwd | `codex resume --last` |
| Resume by id + prompt | `codex resume <ID> "continue …"` |
| Fork conversation | `codex fork` (see `codex fork --help`) |

Exit: Ctrl+C or `/exit` inside the TUI.

## Background / detached local session

```bash
SESSION_NAME="codex-$(basename "$(git rev-parse --show-toplevel)")"
tmux new-session -d -s "$SESSION_NAME" -c "$(git rev-parse --show-toplevel)" -- codex
echo "Attach: tmux attach -t $SESSION_NAME"
```

## Non-interactive (scripting only)

Ralph `local-codex` worker:

```bash
codex exec --sandbox workspace-write --ask-for-approval never "Your prompt"
```

See `scripts/ralph/src/workers/registry.ts`.

## Related

- Repo Codex skills: `.agents/skills/` (Codex); Cursor also loads `.cursor/skills/`.
- Ralph: `ralph` skill, `--worker local-codex`
