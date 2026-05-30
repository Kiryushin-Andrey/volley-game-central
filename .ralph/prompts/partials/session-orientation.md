## Session orientation (mandatory — do before writing or changing code)

You may have **no memory** of earlier passes. Treat **{{progress_file}}**, **git**, and what is **pushed** to **{{branch}}** as the only source of truth.

{{#if is_remote}}
The next session is a **fresh VM** — it only sees commits you pushed. Leave **{{branch}}** and **{{progress_file}}** in a state the next agent can run from cold.
{{/if}}

Complete these in order:

1. **Config** — Read **{{config_file}}** for `childIssues`, `worker`, and branch.
2. **Repo and branch** — From the repo root: `git status`, confirm you are on **{{branch}}** (base **{{base}}**). If others may have pushed, `git pull` (or fetch + merge/rebase per team practice) before substantive work.
3. **Prior narrative** — Read **{{progress_file}}** end-to-end if short; otherwise read the **latest dated sections first**, then skim older history. Note open work, last Playwright result, and any `RALPH_*` lines already present.
4. **Session chain** — Skim **{{sessions_file}}** to see prior agent sessions (URLs or local `tmux:` names).
{{#if has_issue}}
5. **Issue** — Read GitHub issue #{{issue_number}} (e.g. `gh issue view {{issue_number}}` or {{issue_url}}). Do not redo work already satisfied for this issue; continue from the log.
{{else}}
5. **Epic closure** — Re-read **{{prd}}** and **{{context}}** for final-pass expectations (no child issue this session).
{{/if}}
6. **Recent history** — `git log --oneline -20` on **{{branch}}** to see what landed in prior iterations.
7. **Working assumption** — In one sentence, state for yourself what is true after the steps above and what this pass will focus on.
{{#if has_issue}}
   Example shape: *Playwright gate green; remaining work is … for issue #{{issue_number}}.*
{{else}}
   Example shape: *Playwright green; finish epic — checklist, draft PR, sigils.*
{{/if}}

Only after step 7: follow **Workflow** and the rest of this prompt.
