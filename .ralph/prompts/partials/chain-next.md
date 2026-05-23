## Chain the next iteration (mandatory when more work remains)

After **commit and push** of code and **{{progress_file}}**:

```bash
cd "$(git rev-parse --show-toplevel)"
./scripts/ralph-chain-next.sh --from-notes "{{#if has_issue}}issue #{{issue_number}}{{else}}iteration{{/if}}"
```

1. If output includes **`RALPH_CHAINED <session-ref>`** — the script has started the **next** session and appended it to **{{sessions_file}}** (committed). **Stop this session immediately.**
2. If output is **`RALPH_DONE`** — epic complete; summarize from **{{progress_file}}** and stop (no new session).
3. **Do not monitor** the next session — no polling, no waiting for it to finish, no streaming its logs. The next agent is independent; your job ends when chain-next exits.

Use the **`worker`** in **{{config_file}}** for the next session unless the user explicitly requested a different runtime (then update config before chaining).

Do **not** run a foreground multi-iteration loop script — recursive Ralph chains one session at a time.
