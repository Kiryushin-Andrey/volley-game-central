## E2E gate (required every iteration — before issue feature work)

**Policy:** Do not advance issue #{{issue_number}} scope until the full epic E2E gate is green (no **Fail**). Fixing E2E failures has **higher priority** than new feature work this iteration.

### 1. Run the full suite

Follow {{e2e}}:

- Environment **§2** (stack, DB, restrictions env when testing Suite C).
- Personas **§3**.
- **All scenarios in Suites A, B, C, and D** (**§6**), in the order suggested in **§7**.
- Record each test ID as **Pass**, **Fail**, or **Blocked** using the template in **§8**.
- Screenshots under {{screenshots_dir}}/ for failures and for cases listed in §8.

This iteration’s primary slice is Suite **{{suite}}** (issue #{{issue_number}}), but the gate always includes **A + B + C + D**.

### 2. If anything **Failed**

- Do **not** start new feature work for the issue until Failures are cleared.
- Investigate failures; pick **one** Fail to fix this iteration (smallest root cause).
- Re-run **full Suites A–D** after the fix before committing.
- Append to {{progress_file}}: E2E status table, which Fail you fixed, and remaining Fails.

You may end a **partial iteration** with only E2E repair work (no issue sigil).

### 3. **Blocked** vs **Fail**

- **Fail** — built behavior is wrong or regressed; must be fixed before feature work.
- **Blocked** — scenario cannot run yet (e.g. migration missing, slice not merged). Allowed only when documented in {{progress_file}} with reason. **Blocked does not excuse Fail.** You may proceed with issue feature work only when there are **zero Fails** (Blocked is OK).

### 4. When the gate is green (no Fail)

You may work on issue #{{issue_number}} per {{prd}} and the GitHub issue.

**E2E spec hygiene (same iteration when you change product behavior):**

- If you add or change behavior, update **{{e2e}}** (and any automated tests in the repo, if present) so scenarios match the app.
- Do **not** emit `RALPH_ISSUE_COMPLETE #{{issue_number}}` until:
  - acceptance criteria for the issue are met, **and**
  - full Suites **A–D** pass with **no Fail**, **and**
  - {{e2e}} reflects the shipped behavior for this issue (when applicable).

### 5. Before commit / end of iteration

Re-run **full Suites A–D** after all code and {{e2e}} edits. Do not commit if any Fail remains.
