---
name: ralph
description: Use when the user wants Ralph, Ralph Wiggum, epic automation, or multi-issue agent orchestration. Discover and order child GitHub issues, run scripts/ralph-loop.sh with --worker (local-cursor, local-claude, local-codex, remote-cursor, remote-oz). Proactive per-iteration updates. Ask which --worker when not clear from context.
---

# Ralph

Ralph pattern: [getting started](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

The **orchestrator** (you or a dedicated agent session) discovers child slice issues, **orders them by dependency** (by reading issue text — not numeric sort, not regex on section headings), then runs `scripts/ralph-loop.sh`. The harness runs slices **one at a time** in that order. It does not call GitHub.

Each **worker** iteration reads **PRD + `.ralph/progress.txt`**, runs **feedback loops** before commit, appends to **progress.txt**, and emits a completion sigil (`RALPH_*` or `<promise>…</promise>`).

Agent instructions live in **`.ralph/prompts/`** (`*-prompt.md`, `partials/*.md`; Handlebars: `{{var}}`, `{{#if}}`, `{{> partial}}` — see `prompts/README.md`). Edit those files to tune behavior; use `--prompts-dir` to override.

## Where should worker agents run? (`--worker`)

**Before** you run `ralph-loop.sh`, choose **`--worker`** — where each slice iteration runs. The orchestrator can stay in your current chat; workers are what the harness spawns per issue.

**Ask the user** when it is not already clear from their request or context, for example:

- They did not specify `--worker` (or legacy `--backend`).
- They said “use Ralph” without saying local vs remote or which agent (Cursor / Claude / Codex).
- You are unsure whether they need `--push` for resume across machines.

Do **not** guess if the tradeoff matters (laptop on vs AFK, API keys, Oz environment).

| `--worker` | CLI / platform | When to use |
|------------|----------------|-------------|
| **`local-cursor`** (default) | `agent` on PATH | Interactive / HITL; Cursor local agent |
| **`local-claude`** | `claude` on PATH | Claude Code CLI (`claude -p`, `acceptEdits`) |
| **`local-codex`** | `codex` on PATH | Codex CLI (`codex exec`, workspace-write) |
| **`remote-cursor`** | Cursor Cloud API | Unattended AFK + `CURSOR_API_KEY` + `--push` |
| **`remote-oz`** | [Warp Oz](https://docs.warp.dev/agent-platform/cloud-agents/overview/) | Unattended + `WARP_API_KEY` + `OZ_ENVIRONMENT_ID` + `--push` |

No custom binary paths — install the CLI so the command name is on `PATH`. Remote runners live in `scripts/ralph/src/agents/`.

**Orchestrator** (steps 1–2 + monitoring step 3) can be: this chat, a local shell, or `./scripts/launch-ralph-orchestrator.sh` (starts a **remote** orchestrator agent that then runs the harness in the foreground).

Use `--once` for a single worker attempt per issue (HITL). Use `--max-iterations N` to cap AFK cost on unattended runs.

## Setup (TypeScript harness)

Requires **Node.js 18+**. Install once per clone:

```bash
cd "$(git rev-parse --show-toplevel)/scripts/ralph" && npm install
```

Entrypoints: `scripts/ralph-loop.sh`, `scripts/ralph-once.sh`, `scripts/launch-ralph-orchestrator.sh` (remote orchestrator only). Implementation: `scripts/ralph/src/`.

## Your job before `ralph-loop.sh`

| Input | You supply |
|-------|------------|
| **`--worker`** | One of the table above (confirm with user if unclear) |
| Parent issue # | Epic / PRD issue |
| Child issue #s | **Dependency-ordered** list for `--child-issues` |
| Integration branch | Single PR branch |
| PRD path | Feature epic PRD (`--prd`, required) |
| E2E | Defaults to `docs/playwright-e2e-scenarios.md` (optional `--e2e`) |

Optional: `--push` (required for **`remote-*`** resume), `--cloud-env KEY=VAL` (`remote-cursor`), `--cloud-model` / `--oz-model-id`, `--max-iterations N`, `--max-slice N`, `--feedback-loop`.

Deprecated (still accepted with a warning): `--backend`, `--cloud-provider`, `--agent-cmd`.

---

## Step 1 — Find child slices

Collect every GitHub issue that belongs to this epic (slice / vertical-slice work under the parent). Use whatever works in your environment:

- `gh issue list` / `gh issue view` on the parent and linked issues
- Repo copies under `docs/issues/` if present
- Parent issue body or PRD “implementation slices” section

Do **not** assume issue numbers sort correctly. Do **not** parse markdown headings mechanically (e.g. do not rely on a fixed `## Blocked by` format).

---

## Step 2 — Order slices by dependency (reasoning)

For **each** child issue, read the full description (and title). Build a mental dependency graph:

- What must exist before this slice can be implemented or E2E-tested?
- Which slices only touch disjoint areas and can run in any order relative to each other?
- Which slice integrates or depends on behavior introduced by others?

**Rules for the list you pass to `--child-issues`:**

1. **Every blocker must appear earlier** than the issue that depends on it.
2. **Parallel-safe slices** (no dependency between them): pick one order; put them consecutively before anything that needs both. The harness is serial — you are choosing a safe sequence, not spawning parallel agents.
3. **E2E gate**: **Every iteration** runs full **`npm run test:e2e`** (see `docs/playwright-e2e-scenarios.md`) before issue feature work. Fix one failing test before new scope. Update the checklist and `e2e/` specs when behavior changes. Harness repeats until `RALPH_ISSUE_COMPLETE #n`.
4. If two orderings are valid, prefer the order documented in the PRD or parent issue when stated; otherwise prefer foundational/data-model slices before UI-only or policy layers that assume them.

**Before step 3, write a short ordering note** (in your reply or orchestrator log), for example:

```text
Worker: local-claude. Ordering: #20, #21 independent → 20 then 21; #22 last.
→ --child-issues 20 21 22
```

If dependencies are unclear, read related issues again or ask the user — do not guess an order that could run a dependent slice first.

---

## Step 3 — Run Ralph (foreground + proactive updates)

```bash
cd "$(git rev-parse --show-toplevel)"
cd scripts/ralph && npm install && cd ../..
```

**Local worker** (example: Claude Code — swap `--worker` for `local-cursor` or `local-codex`):

```bash
./scripts/ralph-loop.sh \
  --worker local-claude \
  --parent-issue <PARENT> \
  --child-issues <ordered numbers> \
  --branch <branch> \
  --prd <path> \
  --max-iterations 50
```

**Remote — Cursor:**

```bash
./scripts/ralph-loop.sh \
  --worker remote-cursor \
  --parent-issue <PARENT> \
  --child-issues <ordered numbers> \
  --branch <branch> \
  --prd <path> \
  --push \
  --max-iterations 50
```

**Remote — Oz** — environment must include this repo and branch setup:

```bash
./scripts/ralph-loop.sh \
  --worker remote-oz \
  --oz-environment-id <OZ_ENV_UID> \
  --parent-issue <PARENT> \
  --child-issues <ordered numbers> \
  --branch <branch> \
  --prd <path> \
  --push \
  --max-iterations 50
```

Run in the **foreground** and **block until the process exits**. Do **not** background the harness (`&`, `nohup`, `disown`). Do **not** end your turn after only starting the script.

Do **not** implement slices in the orchestrator session — only discover, order, run the harness, and report.

### Monitor and report without being asked

While `ralph-loop.sh` is running, **proactively** tell the user what just finished and what is next.

1. **Before** the run: `--worker`, ordering note, parent issue, `--child-issues`, branch.
2. **During** the run: post updates as harness output arrives — do not batch URLs until the end.
3. **After** exit: final summary (exit code, all session URLs collected, sigils on branch).

#### Cloud session URLs in **chat** (`remote-*` workers) — required

The harness prints each new remote session to stdout/stderr and appends to **`.ralph/logs/live-sessions.log`**:

```text
RALPH_CLOUD_SESSION issue-22-pass1-iter1 https://cursor.com/agents?id=…
```

**Critical:** URLs only in Shell/terminal tool output are **hidden** (collapsed “orchestrator output”). The user will **not** see them unless you put them in a **normal assistant message** in the thread.

**As soon as** a new session exists, send a **user-visible chat message** (not thinking-only, not tool logs alone), for example:

```markdown
**Ralph — issue #22 (pass 1)** — cloud worker started

https://cursor.com/agents?id=…
```

Rules:

- **One chat message per new URL** — when the iteration starts, not when the whole loop finishes.
- **Do not** wait until `ralph-loop.sh` exits to list URLs.
- Track URLs you already posted; never duplicate the same link.
- Local workers (`local-*`) have no cloud session URL — skip this block.

**How to get URLs in real time**

1. **Streaming Shell** — if partial output is available, on every `RALPH_CLOUD_SESSION` or `Session:` line, **send the chat message above immediately**, then keep monitoring.
2. **Poll while the loop runs** (required if Shell buffers until exit):
   - Start the loop with logging:  
     `./scripts/ralph-loop.sh … 2>&1 | tee -a .ralph/logs/live.log`  
     (background `&` is OK if you can still run other tools.)
   - Between checks (or on a timer), **Read** `.ralph/logs/live-sessions.log` or run  
     `grep RALPH_CLOUD_SESSION .ralph/logs/live-sessions.log | tail -5`
   - For **each new** line, send a **chat message** with that URL before doing anything else.
3. Do **not** tell the user to expand terminal output to find URLs — you paste them in chat.

| Harness signal | You must |
|----------------|----------|
| `RALPH_CLOUD_SESSION <title> <url>` | **Chat message** with `<url>` now |
| `Session: https://…` | Same (legacy line; still post in chat) |
| `=== issue-<n>-pass` + `(remote-*)` | Expect a session URL seconds later; post when it appears |
| `[cursor] run FINISHED` or `[oz] run SUCCEEDED` | Remote worker ended; harness checks `progress.txt` |
| `OK: RALPH_ISSUE_COMPLETE #n` | Issue #n done — note remaining issues |
| `=== final` / `OK: RALPH_ALL_COMPLETE` | Final pass milestone |
| `agent error`, `Stopped:`, non-zero exit | Failure — include log path and any `Session:` URL from that iteration |

If stdout is slow or buffered (common with remote workers), poll the branch:

```bash
git pull origin <branch>
grep RALPH_ .ralph/progress.txt | tail -20
```

### Example epic

```bash
source .ralph/examples/example-epic.sh
./scripts/ralph-loop.sh "${RALPH_LOOP_ARGS[@]}" \
  --child-issues <n1> <n2> <n3> \
  --worker local-cursor   # or local-claude, local-codex, remote-* + --push
```

Edit `example-epic.sh` with your epic’s parent issue, branch, and PRD path. Set worker mode in the script or after asking the user.

---

## Start a remote orchestrator from laptop

Use when the **orchestrator** itself should run remotely (you can close the laptop). Pass the same `--worker` after `--`.

```bash
export CURSOR_API_KEY=...
./scripts/launch-ralph-orchestrator.sh --branch <branch> --worker remote-cursor -- \
  --parent-issue 8 --prd … --worker remote-cursor --push
```

Oz:

```bash
export WARP_API_KEY=...
export OZ_ENVIRONMENT_ID=...
./scripts/launch-ralph-orchestrator.sh --branch <branch> --worker remote-oz -- \
  --parent-issue 8 --prd … --worker remote-oz --push
```

Omit `--child-issues` so the orchestrator runs steps 1–2 from this skill, then adds the ordered list.

---

## Secrets

| Secret | When |
|--------|------|
| (none extra) | `local-*` — install `agent`, `claude`, or `codex` on PATH |
| `CURSOR_API_KEY` | `--worker remote-cursor` |
| `WARP_API_KEY` + `OZ_ENVIRONMENT_ID` | `--worker remote-oz` |
| `gh` / GitHub access | Orchestrator issue discovery (steps 1–2) |
| GitHub in remote environment | `remote-*` workers clone/push the integration branch |

---

## After the run

Report: exit code, **`--worker`**, ordering note, worker session URLs (if `remote-*`), and whether `.ralph/progress.txt` on the integration branch has up-to-date `RALPH_*` sigils. Per-iteration updates should already have been sent during step 3.

## Resume

Re-run the **same** command (same `--branch`, `--child-issues`, and `--worker`). For `remote-*` use `--push`. The harness pulls the branch and skips issues already marked `RALPH_ISSUE_COMPLETE #n` in `.ralph/progress.txt` only.
