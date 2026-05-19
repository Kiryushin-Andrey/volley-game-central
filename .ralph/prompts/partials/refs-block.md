Read in the repo (required):

**Project-wide (E2E gate — whole app):**
- `docs/playwright-e2e-scenarios.md` (same as {{e2e}} when using defaults)
- `e2e/` — Playwright specs (`npm run test:e2e`)

**This epic / iteration:**
- {{context}}
- {{prd}} (parent #{{parent_issue}} — feature scope only; not the E2E gate scope)
- {{progress_file}}
{{#if has_steering}}
- {{steering_file}} (steering — highest priority)
{{/if}}
{{#if has_issue}}
- GitHub issue #{{issue_number}}: {{issue_url}}
{{/if}}

Work on branch {{branch}} (base {{base}}). One PR for parent #{{parent_issue}}.
