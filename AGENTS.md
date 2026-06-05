<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

## Cloud agents and Ralph

When the task says to **implement an epic with Ralph** (or to use the **ralph** skill), epic completion is **multi-session**. Read `.agents/skills/ralph/SKILL.md` and follow it before any feature work.

| Situation | What “done” means in **this** session |
|-----------|--------------------------------------|
| No task folder under `.ralph/tasks/` for this feature | **Bootstrap only:** derive slug, create `.ralph/tasks/<slug>/`, write Ralph config + progress + `.current-task`, publish, `ralph-chain-next.sh --bootstrap`, then **stop**. Success = `RALPH_CHAINED`, not shipped feature code. |
| `.ralph/.current-task` exists and `.ralph/tasks/<slug>/ralph.config.json` exists; `ralph-plan.sh` reports an issue or final | **One slice** (or final pass), update `progress.txt` under `tasks/<slug>/`, chain, then **stop**. |

This overrides generic “complete the full issue/PR in one session” guidance. Do **not** implement all child slices in the bootstrap session, even if the issue body is large or the parent issue asks for a full implementation.

**First actions:** read `.ralph/.current-task` for the active slug, then run `./scripts/ralph-plan.sh`. If no task folder exists, you are bootstrap — do not edit `backend/src/`, `tg-mini-app/src/`, or feature tests until a worker session is chained.
