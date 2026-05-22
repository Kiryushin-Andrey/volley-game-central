---
name: ralph-loop
description: Runs the Ralph loop for epic automation — discover and order child GitHub issues, run scripts/ralph-loop.sh in the foreground with proactive per-iteration updates. Supports local worker agents (Cursor CLI) or remote workers (Cursor Cloud, Warp Oz). Ask the user where workers should run when not clear from context. Use for Ralph loop, multi-issue agent runs, or orchestrating slice work.
---

# Ralph loop

Ralph pattern: [getting started](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

The **orchestrator** (you or a dedicated agent session) discovers child slice issues, **orders them by dependency** (by reading issue text — not numeric sort, not regex on section headings), then runs `scripts/ralph-loop.sh`. The harness runs slices **one at a time** in that order. It does not call GitHub.

Each **worker** iteration reads **PRD + `.ralph/progress.txt`**, runs **feedback loops** before commit, appends to **progress.txt**, and emits a completion sigil (`RALPH_*` or `<promise>…</promise>`).

Agent instructions live in **`.ralph/prompts/`** (`*-prompt.md`, `partials/*.md`; Handlebars: `{{var}}`, `{{#if}}`, `{{> partial}}` — see `prompts/README.md`). Edit those files to tune behavior; use `--prompts-dir` to override.

## Where should worker agents run?

**Before** you run `ralph-loop.sh`, decide where **slice worker** sessions execute. The orchestrator can stay in your current chat; workers are what the harness spawns per issue.

**Ask the user** when it is not already clear from their request or context, for example:

- They did not say local vs remote, or which remote platform.
- They said “run Ralph” without `--backend`, `--cloud-provider`, or “on my machine”.
- You are unsure whether they need `--push` for resume across machines.

Do **not** guess remote vs local if the tradeoff matters (laptop must stay on, API keys, Oz environment setup).

| Worker mode | When to use | Harness flags |
|-------------|-------------|---------------|
| **Local** | Interactive / HITL, learning prompts, same machine as the terminal running the loop | `--backend local` (default). Requires Cursor CLI (`agent`). |
| **Remote — Cursor** | Unattended AFK, close laptop; agents run on Cursor Cloud | `--backend cloud --cloud-provider cursor --push` + `CURSOR_API_KEY` |
| **Remote — Oz (Warp)** | Unattended on [Oz Platform](https://docs.warp.dev/agent-platform/cloud-agents/overview/) | `--backend cloud --cloud-provider oz --push` + `WARP_API_KEY` + `OZ_ENVIRONMENT_ID` |

Remote execution uses pluggable runners in `scripts/ralph/src/agents/` (Cursor API, Oz API). The loop only calls `runPrompt()`; it does not embed platform details.

**Orchestrator** (steps 1–2 + monitoring step 3) can be: this chat, a local shell, or `./scripts/launch-ralph-orchestrator.sh` (starts a **remote** orchestrator agent that then runs the loop in the foreground).

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
| **Worker mode** | Local, or remote + provider (confirm with user if unclear) |
| Parent issue # | Epic / PRD issue |
| Child issue #s | **Dependency-ordered** list for `--child-issues` |
| Integration branch | Single PR branch |
| PRD path | Feature epic PRD (`--prd`, required) |
| E2E | Defaults to `docs/playwright-e2e-scenarios.md` (optional `--e2e`) |

Optional: `--push` (required for **remote** resume), `--cloud-env KEY=VAL` (Cursor only), `--cloud-model` / `--oz-model-id`, `--max-iterations N`, `--max-slice N`, `--feedback-loop`.

| Remote provider | Secrets / config |
|-----------------|------------------|
| **cursor** | `CURSOR_API_KEY`, `--cloud-model` (default `default` = Auto) |
| **oz** | `WARP_API_KEY`, `OZ_ENVIRONMENT_ID` (or `--oz-environment-id`) |

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
2. **Parallel-safe slices** (no dependency between them): pick one order; put them consecutively before anything that needs both. The loop is serial — you are choosing a safe sequence, not spawning parallel agents.
3. **E2E gate**: **Every iteration** runs full **`npm run test:e2e`** (see `docs/playwright-e2e-scenarios.md`) before issue feature work. Fix one failing test before new scope. Update the checklist and `e2e/` specs when behavior changes. Harness loops until `RALPH_ISSUE_COMPLETE #n`.
4. If two orderings are valid, prefer the order documented in the PRD or parent issue when stated; otherwise prefer foundational/data-model slices before UI-only or policy layers that assume them.

**Before step 3, write a short ordering note** (in your reply or orchestrator log), for example:

```text
Workers: local (user machine). Ordering: #20, #21 independent → 20 then 21; #22 last.
→ --child-issues 20 21 22
```

If dependencies are unclear, read related issues again or ask the user — do not guess an order that could run a dependent slice first.

---

## Step 3 — Run the loop (foreground + proactive updates)

```bash
cd "$(git rev-parse --show-toplevel)"
cd scripts/ralph && npm install && cd ../..
```

**Local workers** (orchestrator terminal stays on this machine):

```bash
./scripts/ralph-loop.sh \
  --backend local \
  --parent-issue <PARENT> \
  --child-issues <ordered numbers> \
  --branch <branch> \
  --prd <path> \
  --max-iterations 50
```

**Remote workers — Cursor:**

```bash
./scripts/ralph-loop.sh \
  --backend cloud \
  --cloud-provider cursor \
  --parent-issue <PARENT> \
  --child-issues <ordered numbers> \
  --branch <branch> \
  --prd <path> \
  --push \
  --max-iterations 50
```

**Remote workers — Oz (Warp)** — Oz environment must include this repo and branch setup:

```bash
./scripts/ralph-loop.sh \
  --backend cloud \
  --cloud-provider oz \
  --oz-environment-id <OZ_ENV_UID> \
  --parent-issue <PARENT> \
  --child-issues <ordered numbers> \
  --branch <branch> \
  --prd <path> \
  --push \
  --max-iterations 50
```

Run in the **foreground** and **block until the process exits**. Do **not** background the loop (`&`, `nohup`, `disown`). Do **not** end your turn after only starting the script.

Do **not** implement slices in the orchestrator session — only discover, order, run the harness, and report.

### Monitor the loop and report without being asked

While `ralph-loop.sh` is running, **proactively** tell the user what just finished and what is next.

1. **Before** the loop: worker mode, ordering note, parent issue, `--child-issues`, branch.
2. **During** the loop: after **each** worker iteration completes, post an update **before** the next one starts.
3. **After** exit: final summary (exit code, session links if remote, sigils on branch).

| Harness stdout | Post to user |
|----------------|--------------|
| `=== issue-<n>-pass` or `(local)` / `(cursor)` / `(oz)` | Worker starting for issue #n |
| `Session: https://…` | Remote worker link (if printed) |
| `[cursor] run FINISHED` or `[oz] run SUCCEEDED` | Remote worker ended; harness checks `progress.txt` |
| `OK: RALPH_ISSUE_COMPLETE #n` | Issue #n done — note remaining issues |
| `=== final` / `OK: RALPH_ALL_COMPLETE` | Final pass milestone |
| `agent error`, `Stopped:`, non-zero exit | Failure — include log path from output |

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
  --backend local   # or cloud + provider + --push
```

Edit `example-epic.sh` with your epic’s parent issue, branch, and PRD path. Set worker mode in the script or after asking the user.

---

## Start a remote orchestrator from laptop

Use when the **orchestrator** itself should run remotely (you can close the laptop). Pass the same worker flags after `--` so the remote orchestrator runs the loop with the chosen backend.

```bash
export CURSOR_API_KEY=...
./scripts/launch-ralph-orchestrator.sh --branch <branch> -- \
  --parent-issue 8 --prd … --backend cloud --cloud-provider cursor --push
```

Oz:

```bash
export WARP_API_KEY=...
export OZ_ENVIRONMENT_ID=...
./scripts/launch-ralph-orchestrator.sh --branch <branch> --cloud-provider oz -- \
  --parent-issue 8 --prd … --backend cloud --cloud-provider oz --push
```

Omit `--child-issues` so the orchestrator runs steps 1–2 from this skill, then adds the ordered list.

---

## Secrets (remote workers / remote orchestrator)

| Secret | When |
|--------|------|
| `CURSOR_API_KEY` | Remote workers or orchestrator with `--cloud-provider cursor` |
| `WARP_API_KEY` + `OZ_ENVIRONMENT_ID` | Remote workers or orchestrator with `--cloud-provider oz` |
| `gh` / GitHub access | Orchestrator issue discovery (steps 1–2) |
| GitHub in remote environment | Remote workers clone/push the integration branch |

Local workers need Cursor CLI (`agent`) and git; no cloud API keys.

---

## After the run

Report: exit code, **worker mode**, ordering note, worker session URLs (if remote), and whether `.ralph/progress.txt` on the integration branch has up-to-date `RALPH_*` sigils. Per-iteration updates should already have been sent during step 3.

## Resume

Re-run the **same** command (same `--branch`, `--child-issues`, and worker mode). For remote workers use `--push`. The harness pulls the branch and skips issues already marked `RALPH_ISSUE_COMPLETE #n` in `.ralph/progress.txt` only.
