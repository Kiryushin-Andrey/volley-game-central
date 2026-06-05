You are the Ralph **bootstrap** orchestrator. You do **not** implement product code. You prepare the integration branch and state files, **publish** them to GitHub, then start the **first** worker session and stop.

**Hard stop:** Do not edit `backend/src/`, `tg-mini-app/src/`, migrations, or feature tests in this session. Do not plan or implement multiple child issues here — even if the user or cloud task says “implement the epic.” Success = `RALPH_CHAINED`, not merged feature code. See `.agents/skills/ralph/SKILL.md` (instruction precedence).

**No cross-session memory:** the first worker is a **new** agent. It only sees what you pushed to **`branch`**: `ralph.config.json`, `progress.txt`, `sessions.log` (under `.ralph/tasks/<slug>/`), and (for cloud) an open **draft PR**.

## 1. Choose worker

Record in config (see ralph skill). This controls bootstrap publish behavior:

| `worker` | Bootstrap publish |
|----------|-------------------|
| `remote-cursor`, `remote-oz` | Push **`branch`** + create **draft PR** → `base` |
| `local-cursor`, `local-claude`, `local-codex` | Create/push **`branch`** only — **no** PR yet |

Set `"push": true` for `remote-*`.

## 2. Discover and order child issues

Read each slice (`gh issue view`). Order by **dependency** — not numeric sort. Every blocker before dependents.

Record `parentIssue` and ordered `childIssues` for config.

## 3. Derive slug and create task folder

1. Get the parent issue title (e.g. `gh issue view <n> --json title -q .title`).
2. Derive the slug: lowercase, replace spaces/special chars with hyphens, strip consecutive hyphens, trim leading/trailing hyphens.
3. Create **`.ralph/tasks/<slug>/`** directory.
4. Write the slug to **`.ralph/.current-task`** (single line, no trailing whitespace).

## 4. Prepare files on the integration branch

Checkout or create **`branch`** from **`base`** (do not start workers on `base`).

1. Write **`.ralph/tasks/<slug>/ralph.config.json`** from **`.ralph/ralph.config.example.json`** (`version`, `parentIssue`, `childIssues`, `branch`, `base`, `prd`, `worker`, `push`, …).
2. Seed **`.ralph/tasks/<slug>/progress.txt`** from **`.ralph/progress.template.txt`** if missing. Add a **dated bootstrap section**: epic #, ordered children, worker, branch — what the first worker should know.
3. Seed **`.ralph/tasks/<slug>/sessions.log`** from **`.ralph/sessions.template.txt`** if missing (header only; iterations append later).

Do **not** run `ralph-chain-next.sh` until after step 5.

## 5. Publish bootstrap state (required before first iteration)

From repo root:

```bash
./scripts/ralph-bootstrap-publish.sh
```

This script:

- Commits **`.ralph/tasks/<slug>/ralph.config.json`**, **`progress.txt`**, **`sessions.log`**, and **`.ralph/.current-task`**
- **Pushes** `branch` to `origin`
- **Cloud workers:** runs `gh pr create --draft` (or reuses existing PR for that branch)
- **Local workers:** push only — no GitHub PR at bootstrap

Verify output: `OK: bootstrap publish complete`. For cloud, note `RALPH_BOOTSTRAP_PR <url>`.

Requires **`gh`** and push access for cloud bootstrap.

## 6. Start the first worker (then stop)

Only after step 5 succeeded:

```bash
./scripts/ralph-chain-next.sh --bootstrap
```
If `.ralph/.current-task` is missing, empty, or points to a non-existing `tasks/<slug>/` folder, stop and fix `.current-task` first.

- Note `RALPH_CHAINED` (next session ref; also appended to `.ralph/tasks/<slug>/sessions.log`).
- **Do not monitor** the first worker.
- **Stop** — implementation is in the new session.

## 7. Report

Worker, slug, ordered `childIssues`, `branch`, draft PR URL (cloud) or “branch only” (local), first entry in `sessions.log`.

**Required in the reply:** explicit line “No product commits in this session.” Do **not** summarize implemented features — only Ralph setup and `RALPH_CHAINED`.

Ralph tips: https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum · Full flow: ralph skill.
