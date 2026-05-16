When one PRD item is done but more remain for issue #{issue_number} (commit + append progress first):
RALPH_ITEM_COMPLETE #{issue_number}
(or <promise>RALPH_ITEM_COMPLETE #{issue_number}</promise>)

When every PRD item for issue #{issue_number} is done AND Suite {suite} passes:
RALPH_SLICE_COMPLETE #{issue_number}
(or <promise>RALPH_SLICE_COMPLETE #{issue_number}</promise>)
