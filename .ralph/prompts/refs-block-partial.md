Read in the repo (required):
- {{context}}
- {{prd}}  (parent #{{parent_issue}})
- {{e2e}}
- {{progress_file}}
{{#if has_steering}}
- {{steering_file}}  (steering — highest priority)
{{/if}}
{{#if has_issue}}
- GitHub issue #{{issue_number}}: {{issue_url}}
{{/if}}
Work on branch {{branch}} (base {{base}}). One PR for parent #{{parent_issue}}.
