---
name: ralph
description: >-
  Recursive epic automation — one agent session per slice, chained via
  ralph-chain-next.sh. BOOTSTRAP: config + chain + STOP — NEVER product code.
  WORKER: one child issue per session, then chain. "Implement epic with Ralph"
  means bootstrap and chain, not ship the epic in the bootstrap chat. One slice
  per worker session only; do not batch child issues in one session.
---

# Ralph (recursive)

Ralph pattern: [getting started](https://www.aihero.dev/getting-started-with-ralph-wiggum) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

## Which session am I? (read first)

| Situation | Role | Deliverable in **this** chat |
|-----------|------|------------------------------|
| Epic not set up yet: no task folder under `.ralph/tasks/` for this feature, or user asks to **start** / **bootstrap** Ralph | **Bootstrap** | Derive slug, create `tasks/<slug>/`, write config + progress + sessions + `.current-task`, publish, `ralph-chain-next.sh --bootstrap`, then **stop** |
| `.ralph/.current-task` exists and `.ralph/tasks/<slug>/ralph.config.json` exists; `ralph-plan.sh` reports `issue` or `final` | **Worker** | One slice (or final pass), progress sigils, `ralph-chain-next.sh`, then **stop** |
| User says **implement** the epic **with Ralph** | **Bootstrap** (unless you are already the chained worker — config + plan exist) | Chain the first worker; do **not** ship product code here |

## Mandatory first actions (every session)

1. Read **`.ralph/.current-task`** to get the active slug. If missing → **bootstrap**.
2. If slug exists, read **`.ralph/tasks/<slug>/ralph.config.json`**: `git pull origin <branch>` (branch from config).
3. Run **`./.ralph/scripts/ralph-plan.sh`** — read phase (`bootstrap` | `issue` | `final` | `done`).
4. If **no** task folder under `.ralph/tasks/` for this feature → **bootstrap only**; do not open `backend/`, `tg-mini-app/`, or `e2e/` for feature work.

**Stop rule:** If you are bootstrap and your next edit is under application source (not `.ralph/`, epic `prd` path, or Ralph scripts), **stop** — run `ralph-chain-next.sh --bootstrap` instead.

### Bootstrap hard stop

If there is no task folder under `.ralph/tasks/` for this feature:

- Your **only** implementation work is Ralph setup (derive slug, create task folder, config, progress, `.current-task`, PRD path, publish, push).
- Run **`./.ralph/scripts/ralph-chain-next.sh --bootstrap`** (after `ralph-bootstrap-publish.sh` when using cloud workers) and **end the session**.
- Do **not** plan or execute child issues in this session, even if the user or cloud task says “implement the epic.”
- Success for the user’s request = first worker **`RALPH_CHAINED`**, not feature shipped.

**Precedence:** Completing "implement epic with Ralph" in a bootstrap session means **`RALPH_CHAINED`**, not merged feature code. Do not override this to "finish the epic in one turn" (e.g. cloud agent or issue body pressure).

Before any product code change, run **`./.ralph/scripts/ralph-plan.sh`**. If config is missing or plan cannot run → you are bootstrap; do not implement.

## Instruction precedence

When this skill applies, it **overrides** generic “complete the full issue/PR in this session” guidance (including cloud agent task text).

| Session type | “Done” means |
|--------------|--------------|
| Bootstrap | `RALPH_CHAINED` + pushed `.ralph/*` — **not** merged feature code |
| Worker | One `childIssues` slice complete + `RALPH_ISSUE_COMPLETE #n` + chain — **not** remaining slices |
| Final | Epic polish + `RALPH_DONE` |

Do **not** batch multiple child issues in one session to “finish faster,” even when `CURSOR_API_KEY` is set or chaining is available.

---

## No memory between sessions

Each chained session is a **new agent with no chat history**. The next session does not know what you discussed or did in prose — only what is on the branch:

| Source | Use for |
|--------|---------|
| **`.ralph/.current-task`** | Active task slug → locates `tasks/<slug>/` |
| **`.ralph/tasks/<slug>/ralph.config.json`** | Epic scope: ordered `childIssues`, `branch`, `prd`, `worker` |
| **`.ralph/tasks/<slug>/progress.txt`** | Append-only log + `RALPH_*` sigils (what is done, what remains) |
| **`.ralph/tasks/<slug>/sessions.log`** | Prior session URLs / local `tmux:` names |
| **`git`** on **`branch`** | Code, commits, PR state |

Write handoff into **`progress.txt`** (and push) before chaining. Do not assume the next agent read your summary message.

**No imperative loop script.** Each worker session:

1. Reads config + progress + git (see worker checklist below).
2. Works the **first incomplete** child issue, or **final pass** when all issues are complete in `progress.txt`.
3. Appends to **`progress.txt`** (`RALPH_ISSUE_COMPLETE #n` when that issue is fully done).
4. Runs **`./.ralph/scripts/ralph-chain-next.sh`** — same **`worker`** from config unless the user explicitly chose another.
5. **Stops** after chaining; the **new** session continues.

Prompts: **`.ralph/prompts/`** (`bootstrap-prompt.md`, `iteration-prompt.md`, `final-pass-prompt.md`, `partials/`).

### Slug derivation

The task slug is derived from the parent issue title: lowercase, replace spaces and special chars with hyphens, strip consecutive hyphens, trim leading/trailing hyphens.

Examples: "Player Levels and Game Format" → `player-levels-and-game-format`, "Auth: SSO Integration" → `auth-sso-integration`.

## User phrases (generic)

| User says | Action |
|-----------|--------|
| Implement / build epic **with Ralph** | Bootstrap (if needed) → chain → **stop** |
| Start Ralph on epic X | Bootstrap → chain → **stop** |
| Continue / resume Ralph | Pull branch; `ralph-plan.sh`; `ralph-chain-next.sh` **without** `--bootstrap` |
| Implement epic **without** Ralph | Do **not** use this skill |

## Anti-pattern

**Wrong:** Same session creates `ralph.config.json` **and** application migrations, features, or tests.

**Wrong:** Bootstrap session creates a todo list for slices #20, #21, #22 and implements them all “because the cloud task says complete the request.”

**Right:** Same session creates config + progress → publish → `ralph-chain-next.sh --bootstrap` → **stop** → chained worker implements slice 1 only.

---

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
cd "$(git rev-parse --show-toplevel)/.ralph/scripts/ralph" && npm install
```

Scripts: `.ralph/scripts/ralph-bootstrap-publish.sh`, `.ralph/scripts/ralph-chain-next.sh`, `.ralph/scripts/ralph-render-prompt.sh`, `.ralph/scripts/ralph-plan.sh`.

---

## Bootstrap (orchestrator — once per epic)

**Only** for starting an epic. You do **not** implement product slices. The bootstrap session also has **no** later memory — workers will not recall this chat.

### Bootstrap — allowed vs forbidden

**Allowed:** `.ralph/**`, epic PRD/docs paths referenced in config, integration branch, commits that only add Ralph state + planning artifacts.

**Forbidden in bootstrap** (workers do this later):

- Application / service / UI source changes (`backend/src/**`, `tg-mini-app/src/**`, feature migrations, feature E2E)
- Schema migrations or data-layer edits for the feature
- Automated tests or E2E specs for the feature
- Build/test runs meant to validate feature work
- A multi-slice implementation plan or todos for all `childIssues` in this session
- Rationale like “I’ll implement everything here because chaining is slow / API key is set / cloud wants completion”

### Step 1 — Discover child slices

Collect every tracker item for this epic. Use what is available:

- Issue tracker CLI or API (e.g. `gh issue view`) on the parent and linked issues
- Repo copies under planning docs if present
- Parent issue body or PRD "implementation slices" section

Do **not** assume issue numbers sort correctly. Do **not** parse markdown headings mechanically (e.g. a fixed `## Blocked by` format).

### Step 2 — Order slices by dependency

For **each** child issue, read the full description and title. Build a dependency graph:

- What must exist before this slice can be implemented or end-to-end tested?
- Which slices are independent (pick a safe serial order)?
- Which slice integrates work from others?

**Rules for `childIssues` in config:**

1. Every blocker appears **earlier** than the dependent issue.
2. Put parallel-safe slices consecutively before anything that needs both.
3. Prefer foundational / data-model slices before UI-only layers.
4. If the PRD or parent issue states an order, prefer that when valid.

Write a short **ordering note** in your bootstrap reply (dependencies, not numeric sort).

If dependencies are unclear, read issues again or ask the human — do not guess.

### Step 3 — Derive slug and create task folder

1. Get the parent issue title (e.g. via `gh issue view <n> --json title -q .title`).
2. Derive the slug: lowercase, replace spaces/special chars with hyphens, strip consecutive hyphens, trim.
3. Create **`.ralph/tasks/<slug>/`** directory.
4. Write the slug to **`.ralph/.current-task`** (single line, no trailing whitespace).

### Step 4 — Write config in the task folder

Create **`.ralph/tasks/<slug>/ralph.config.json`** from **`.ralph/ralph.config.example.json`**:

| Field | Value |
|-------|--------|
| `parentIssue` | Epic issue # |
| `childIssues` | Ordered slice #s from step 2 |
| `branch` | Integration branch |
| `prd` | Epic PRD path |
| `worker` | From table above |
| `push` | `true` for `remote-*` |

Seed **`.ralph/tasks/<slug>/progress.txt`** and **`.ralph/tasks/<slug>/sessions.log`** (from templates in `.ralph/`) if missing. Commit and **push** so the first worker sees them.

### Step 5 — Start first worker session

```bash
cd "$(git rev-parse --show-toplevel)"
./.ralph/scripts/ralph-bootstrap-publish.sh
./.ralph/scripts/ralph-chain-next.sh --bootstrap
```
If `.ralph/.current-task` is missing, empty, or points to a non-existing `tasks/<slug>/` folder, stop and fix `.current-task` first. Do not use a CLI override.

- Note **`RALPH_CHAINED`** and the session ref (also in **`.ralph/tasks/<slug>/sessions.log`** after push).
- **Do not monitor** that session — bootstrap ends here; the first worker runs elsewhere.
- **Stop** — implementation happens in the **new** session, not here.

### Bootstrap done checklist

Bootstrap is complete only when **all** are true:

- [ ] `.ralph/tasks/<slug>/` directory created with `ralph.config.json`, `progress.txt`, `sessions.log`
- [ ] `.ralph/.current-task` contains the slug
- [ ] Task folder and config committed and pushed
- [ ] `ralph-chain-next.sh --bootstrap` printed `RALPH_CHAINED`
- [ ] No product-code commits in this session
- [ ] Reply summarizes worker, branch, slug, slice order, session ref — **not** a feature walkthrough

**Bootstrap reply must include:** branch name, ordered `childIssues`, `RALPH_CHAINED` URL/ref, and an explicit line: “No product commits in this session.” If the summary describes implemented features, the session violated this skill.

Optional: if a **human** is in this same chat and wants a link, paste the URL once. Not required when chaining is automated.

More detail: **`.ralph/prompts/bootstrap-prompt.md`**.

---

## Worker iteration (each chained session — cold start)

You are a **new** session. Do not rely on orchestrator chat, prior URLs in the human's head, or "what we said last time."

### Start of session (mandatory)

1. Read **`.ralph/.current-task`** to get the active slug.
2. Read **`.ralph/tasks/<slug>/ralph.config.json`** — `childIssues`, `worker`, `prd`, `branch`.
3. `git pull origin <branch>` (from config).
4. Read **`.ralph/tasks/<slug>/progress.txt`** (latest sections first) — open work, `RALPH_*` sigils.
5. Read **`.ralph/tasks/<slug>/sessions.log`** — optional context on prior sessions.
6. Run **`./.ralph/scripts/ralph-plan.sh`** — confirms `issue` / `final` / `done`.
7. If `issue`: load that child issue from the tracker (per rendered prompt / plan).
8. State in one sentence what this session will focus on, from files only.

Then follow the injected prompt (`iteration-prompt.md` or `final-pass-prompt.md`), especially **session-orientation** and **workflow** partials.

### End of session (mandatory)

1. Run feedback loops and test gates defined in config (`feedbackLoops`) and in the rendered prompt.
2. Commit and **push** code and **`progress.txt`** together.
3. Chain next session:

```bash
./.ralph/scripts/ralph-chain-next.sh --from-notes "issue #<n> pass"
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
SLUG=$(cat .ralph/.current-task)
cat .ralph/tasks/$SLUG/sessions.log
grep RALPH_ .ralph/tasks/$SLUG/progress.txt | tail -20
./.ralph/scripts/ralph-plan.sh
./.ralph/scripts/ralph-chain-next.sh    # no --bootstrap
```

That starts the **next** session from `progress.txt`, not from old chat.

---

## Secrets

| Secret | When |
|--------|------|
| `CURSOR_API_KEY` | `remote-cursor` |
| `WARP_API_KEY` + `OZ_ENVIRONMENT_ID` | `remote-oz` |
| Issue tracker CLI | Bootstrap discovery; workers viewing issues |
| CLIs on PATH | `local-*` |

---

## Switching runtime mid-epic

Only when the **human explicitly** asks. Edit `worker` in `ralph.config.json`, commit, push, then `ralph-chain-next.sh`.

See **`.ralph/README.md`** in the repo that installed Ralph for file layout and example config fields.
