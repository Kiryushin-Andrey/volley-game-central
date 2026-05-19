# STEERING.md (optional)

Copy to `.ralph/STEERING.md` (gitignored) to override Ralph behavior for one sprint.

Example overrides:

- Run `npm run test:e2e:auth` only while iterating on auth (not recommended for final sign-off).
- Extra feedback loop: `cd backend && npm run build` must pass before every commit.
- Skip final pass draft PR; human opens PR manually.
