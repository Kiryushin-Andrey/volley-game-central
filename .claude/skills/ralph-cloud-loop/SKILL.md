---
name: ralph-cloud-loop
description: Runs the generic Ralph loop with cloud orchestrator and separate cloud child sessions per step. Orchestrator discovers child GitHub issues, orders them by reading and reasoning about dependencies, then runs scripts/ralph-loop.sh. Use for Ralph loop, epic automation, or unattended multi-issue agent runs.
---

# Ralph cloud loop

Ralph pattern: [getting started](https://www.aihero.dev/getting-started-with-ralph) · [11 tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum)

The **orchestrator** discovers child slice issues, **orders them by dependency** (by reading issue text — not numeric sort, not regex on section headings), then runs `scripts/ralph-loop.sh`. The script runs slices **one at a time** in that order. It does not call GitHub.

Each child pass reads **PRD + `.ralph/progress.txt`**, runs **feedback loops** before commit, appends to **progress.txt**, and emits a completion sigil (`RALPH_*` or `<promise>…</promise>`).

Agent instructions live in **`.ralph/prompts/`** (`*-prompt.md`, `partials/*.md`; Handlebars: `{{var}}`, `{{#if}}`, `{{> partial}}` — see `prompts/README.md`). Edit those files to tune behavior; use `--prompts-dir` to override.

## Setup (TypeScript harness)

Requires **Node.js 18+**. Install once per clone (orchestrator and local runs):

```bash
cd "$(git rev-parse --show-toplevel)/scripts/ralph" && npm install
```

Entrypoints are shell wrappers around `tsx` (`scripts/ralph-loop.sh`, `scripts/launch-ralph-orchestrator.sh`). Implementation lives in `scripts/ralph/src/`.

## Your job before `ralph-loop.sh`

| Input | You supply |
|-------|------------|
| Parent issue # | Epic / PRD issue |
| Child issue #s | **Dependency-ordered** list for `--child-issues` |
| Integration branch | Single PR branch |
| PRD + E2E paths | Repo paths for this epic |

Optional: `--push` (required for cloud resume), `--cloud-env KEY=VAL`, `--cloud-model default` (Cursor API **Auto**; default is `default`), `--max-iterations N` (cap AFK cost), `--once` (HITL / single attempt per pass), `--max-slice N` (retries per child), `--feedback-loop` (override default typecheck builds).

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
3. **E2E suite mapping**: 1st child → Suite A, 2nd → B, etc. **Every iteration** runs **full Suites A–D** from the E2E plan before issue feature work. Any **Fail** must be fixed first (one per iteration). Issue work only when the gate has zero Fails. Update the E2E doc when behavior changes. Harness loops until `RALPH_ISSUE_COMPLETE #n`.
4. If two orderings are valid, prefer the order documented in the PRD or parent issue when stated; otherwise prefer foundational/data-model slices before UI-only or policy layers that assume them.

**Before step 3, write a short ordering note** (in your reply or orchestrator log), for example:

```text
Ordering: #20 (game format) and #21 (admin levels) — independent, run 20 then 21.
#22 (restrictions) needs format + player levels → last.
→ --child-issues 20 21 22
```

If dependencies are unclear, read related issues again or ask the user — do not guess an order that could run a dependent slice first.

---

## Step 3 — Run the loop

```bash
cd "$(git rev-parse --show-toplevel)"
cd scripts/ralph && npm install && cd ../..

./scripts/ralph-loop.sh \
  --backend cloud \
  --parent-issue <PARENT> \
  --child-issues <ordered numbers> \
  --branch <branch> \
  --prd <path> \
  --e2e <path> \
  --push \
  --max-iterations 50
```

Run in the **foreground**. Do **not** implement slices in the orchestrator session. Prefer `--max-iterations` on unattended runs.

### Example (player-levels)

After reasoning: format (#20) and admin (#21) before restrictions (#22):

```bash
source .ralph/examples/player-levels.sh
./scripts/ralph-loop.sh "${RALPH_LOOP_ARGS[@]}" \
  --child-issues 20 21 22 \
  --backend cloud --push
```

(`RALPH_LOOP_ARGS` does not include children — you add them after step 2.)

---

## Start from laptop

```bash
export CURSOR_API_KEY=...
./scripts/launch-ralph-orchestrator.sh --branch <branch> -- \
  --parent-issue 8 --prd … --e2e … --backend cloud --push
```

Omit `--child-issues` so the cloud orchestrator runs steps 1–2 from this skill, then adds the ordered list to the command.

The orchestrator Cloud Agent must run `npm install` under `scripts/ralph` before invoking the loop (see **Setup** above).

---

## Secrets

| Secret | Who |
|--------|-----|
| `CURSOR_API_KEY` | Orchestrator + child sessions |
| `gh` / GitHub access | Orchestrator (read issues for steps 1–2) |
| Cursor GitHub App | git clone/push in cloud VMs |

---

## After the run

Report: exit code, your **ordering note**, cloud session URLs from the loop output, and whether `.ralph/progress.txt` on the integration branch contains up-to-date `RALPH_*` sigils.

## Resume

Re-run the same command on a **fresh orchestrator VM** with the same `--branch` and `--child-issues`. The harness pulls the branch and skips issues already marked `RALPH_ISSUE_COMPLETE #n` in `.ralph/progress.txt` only (commit messages are ignored).
