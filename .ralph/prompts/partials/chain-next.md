## Chain the next iteration (mandatory when more work remains)

After **commit and push** of code and **{{progress_file}}**:

```bash
cd "$(git rev-parse --show-toplevel)"
./scripts/ralph-chain-next.sh --from-notes "{{#if has_issue}}issue #{{issue_number}}{{else}}iteration{{/if}}"
```

1. If output includes **`RALPH_CHAINED`** — note the session ref (cloud URL or `tmux:name`). For cloud, **post that URL in chat** for the user. **Stop this session**; do not continue coding here.
2. If output is **`RALPH_DONE`** — epic complete; summarize and stop (no new session).
3. **`sessions.log`** — the script appends the **new** session and commits **{{sessions_file}}** so you can audit the full chain on the branch.

Use the **`worker`** in **{{config_file}}** for the next session unless the user explicitly requested a different runtime (then update config before chaining).

Do **not** run a foreground multi-iteration loop script — recursive Ralph chains one session at a time.
