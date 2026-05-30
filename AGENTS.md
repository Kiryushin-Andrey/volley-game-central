<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

## Cloud agents and Ralph

When the task says to **implement an epic with Ralph** (or to use the **ralph** skill), epic completion is **multi-session**. Read `.agents/skills/ralph/SKILL.md` and follow it before any feature work.

| Situation | What “done” means in **this** session |
|-----------|--------------------------------------|
| No `.ralph/ralph.config.json` on the integration branch | **Bootstrap only:** write Ralph config + progress, publish, `ralph-chain-next.sh --bootstrap`, then **stop**. Success = `RALPH_CHAINED`, not shipped feature code. |
| Config exists; `ralph-plan.sh` reports an issue or final | **One slice** (or final pass), update `progress.txt`, chain, then **stop**. |

This overrides generic “complete the full issue/PR in one session” guidance. Do **not** implement all child slices in the bootstrap session, even if the issue body is large or the parent issue asks for a full implementation.

**First actions:** run `./scripts/ralph-plan.sh`. If config is missing, you are bootstrap — do not edit `backend/src/`, `tg-mini-app/src/`, or feature tests until a worker session is chained.
