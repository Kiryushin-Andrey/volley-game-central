# Steering (optional)

Copy to `STEERING.md` in this folder while the Ralph loop runs.
The next agent iteration will treat this as highest-priority overrides.

Example:

- Production quality: maintainable code, match existing patterns in the repo.
- Skip E2E Suite D for now.
- Extra feedback loop: `cd backend && npm run build` must pass before every commit.
- Prioritize architectural / integration risk in issue #22 before polish.
