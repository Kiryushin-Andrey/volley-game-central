Ralph loop — slice pass, issue #{issue_number} (implement + E2E Suite {suite}).

{workflow_block}
{refs_block}

## 1. Implement

Implement per GitHub issue #{issue_number} and {prd}. Follow {context} for terms.
If issue #{issue_number} spans multiple PRD items, complete only the single highest-priority item this pass.

## 2. Verify (same session)

Execute Suite {suite} from {e2e} (§6–§8). Screenshots: {screenshots_dir}/.
If E2E fails, fix the code and re-run until Suite {suite} passes — stay in this session.

## 3. Finish

Run feedback loops for any code you changed. Commit and push to {branch}.
Append what you did (including E2E outcome) to {progress_file}.

{completion_block}
