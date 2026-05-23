---
name: ralph
description: Recursive Ralph epic automation — one agent session per iteration, chained via ralph-chain-next.sh. Use when the user wants Ralph, Ralph Wiggum, multi-issue slices, or epic automation. Bootstrap writes ralph.config.json; each session updates progress.txt and starts the next session (same worker unless user overrides).
---

# Ralph (recursive)

Ralph pattern: [getting started](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

## No memory between sessions

Each chained session is a **new agent with no chat history**. The next session does not know what you discussed or did in prose — only what is on the branch:

| Source | Use for |
|--------|---------|
| **`.ralph/ralph.config.json`** | Epic scope: ordered `childIssues`, `branch`, `prd`, `worker` |
| **`.ralph/progress.txt`** | Append-only log + `RALPH_*` sigils (what is done, what remains) |
| **`.ralph/sessions.log`** | Prior session URLs / local `tmux:` names |
| **`git`** on **`branch`** | Code, commits, PR state |

Write handoff into **`progress.txt`** (and push) before chaining. Do not assume the next agent read your summary message.

**No imperative loop script.** Each session:

1. Reads config + progress + git (see worker checklist below).
2. Works the **first incomplete** child issue, or **final pass** when all issues are complete in `progress.txt`.
3. Appends to **`progress.txt`** (`RALPH_ISSUE_COMPLETE #n` when that issue is fully done).
4. Runs **`./scripts/ralph-chain-next.sh`** — same **`worker`** from config unless the user explicitly chose another.
5. **Stops** after chaining; the **new** session continues.

Prompts: **`.ralph/prompts/`** (`bootstrap-prompt.md`, `iteration-prompt.md`, `final-pass-prompt.md`, `partials/`).

## Choose `worker` (bootstrap only)

Ask the **human** when unclear (local vs cloud, Cursor / Claude / Codex). Record the choice in `ralph.config.json`; chained sessions reuse it without re-asking.

| `worker` | Next session started by |
|----------|-------------------------|
| `local-cursor` | `tmux` + `agent -p` |
| `local-claude` | `tmux` + `claude -p` |
| `local-codex` | `tmux` + `codex` |
| `remote-cursor` | Cloud API + `CURSOR_API_KEY`, `"push": true` |
| `remote-oz` | Oz API + `WARP_API_KEY` + `OZ_ENVIRONMENT_ID`, `"push": true` |

## Setup

```bash
cd "$(git rev-parse --show-toplevel)/scripts/ralph" && npm install
```

Scripts: `scripts/ralph-bootstrap-publish.sh`, `scripts/ralph-chain-next.sh`, `scripts/ralph-render-prompt.sh`, `scripts/ralph-plan.sh`.

---

## Bootstrap (orchestrator — once per epic)

**Only** for starting an epic. You do **not** implement product slices. The bootstrap session also has **no** later memory — workers will not recall this chat.

### Step 1 — Discover child slices

Collect every GitHub issue for this epic. Use what is available:

- `gh issue list` / `gh issue view` on the parent and linked issues
- Repo copies under `docs/issues/` if present
- Parent issue body or PRD “implementation slices” section

Do **not** assume issue numbers sort correctly. Do **not** parse markdown headings mechanically (e.g. a fixed `## Blocked by` format).

### Step 2 — Order slices by dependency

For **each** child issue, read the full description and title. Build a dependency graph:

- What must exist before this slice can be implemented or E2E-tested?
- Which slices are independent (pick a safe serial order)?
- Which slice integrates work from others?

**Rules for `childIssues` in config:**

1. Every blocker appears **earlier** than the dependent issue.
2. Put parallel-safe slices consecutively before anything that needs both.
3. Prefer foundational / data-model slices before UI-only layers.
4. If the PRD or parent issue states an order, prefer that when valid.

Write a short **ordering note** in your bootstrap reply, e.g. `#20, #21 parallel → 20 then 21; #22 last → childIssues: [20, 21, 22]`.

If dependencies are unclear, read issues again or ask the human — do not guess.

### Step 3 — Write config on the integration branch

Create **`.ralph/ralph.config.json`** from **`.ralph/ralph.config.example.json`**:

| Field | Value |
|-------|--------|
| `parentIssue` | Epic issue # |
| `childIssues` | Ordered slice #s from step 2 |
| `branch` | Integration branch |
| `prd` | Epic PRD path |
| `worker` | From table above |
| `push` | `true` for `remote-*` |

Seed **`.ralph/progress.txt`** and **`.ralph/sessions.log`** (from `sessions.template.txt`) if missing. Commit and **push** so the first worker sees them.

### Step 4 — Start first worker session

```bash
cd "$(git rev-parse --show-toplevel)"
./scripts/ralph-chain-next.sh --bootstrap
```

- Note **`RALPH_CHAINED`** and the session ref (also in **`.ralph/sessions.log`** after push).
- **Do not monitor** that session — bootstrap ends here; the first worker runs elsewhere.
- **Stop** — implementation happens in the **new** session, not here.

Optional: if a **human** is in this same chat and wants a link, paste the URL once. Not required when chaining is automated.

More detail: **`.ralph/prompts/bootstrap-prompt.md`**.

---

## Worker iteration (each chained session — cold start)

You are a **new** session. Do not rely on orchestrator chat, prior URLs in the human’s head, or “what we said last time.”

### Start of session (mandatory)

1. `git pull origin <branch>` (from `ralph.config.json`).
2. Read **`.ralph/ralph.config.json`** — `childIssues`, `worker`, `prd`, `branch`.
3. Read **`.ralph/progress.txt`** (latest sections first) — open work, `RALPH_*` sigils.
4. Read **`.ralph/sessions.log`** — optional context on prior sessions.
5. Run **`./scripts/ralph-plan.sh`** — confirms `issue` / `final` / `done`.
6. If `issue`: `gh issue view <n>` for the issue in the rendered prompt / plan.
7. State in one sentence what this session will focus on, from files only.

Then follow the injected prompt (`iteration-prompt.md` or `final-pass-prompt.md`), especially **session-orientation** and **workflow** partials.

### End of session (mandatory)

1. Feedback loops + full `npm run test:e2e` per prompt.
2. Commit and **push** code and **`progress.txt`** together.
3. Chain next session:

```bash
./scripts/ralph-chain-next.sh --from-notes "issue #<n> pass"
```

| Output | Action |
|--------|--------|
| `RALPH_CHAINED <url\|tmux:…>` | Next session started; ref in **`sessions.log`** — **stop** (do not monitor it) |
| `RALPH_DONE` | Epic complete — summarize from `progress.txt` — **stop** |

**Do not** poll cloud/Oz APIs for the next run. **Do not** run another slice in this session after `ralph-chain-next.sh`.

---

## Human resume (not agent memory)

If the epic stopped mid-way, a **human or new orchestrator** runs on a machine with git access:

```bash
git pull origin <branch>
cat .ralph/sessions.log
grep RALPH_ .ralph/progress.txt | tail -20
./scripts/ralph-plan.sh
./scripts/ralph-chain-next.sh    # no --bootstrap
```

That starts the **next** session from `progress.txt`, not from old chat.

---

## Secrets

| Secret | When |
|--------|------|
| `CURSOR_API_KEY` | `remote-cursor` |
| `WARP_API_KEY` + `OZ_ENVIRONMENT_ID` | `remote-oz` |
| `gh` | Bootstrap discovery; workers viewing issues |
| CLIs on PATH | `local-*` |

---

## Switching runtime mid-epic

Only when the **human explicitly** asks. Edit `worker` in `ralph.config.json`, commit, push, then `ralph-chain-next.sh`.

See **`.ralph/README.md`** for file layout.
