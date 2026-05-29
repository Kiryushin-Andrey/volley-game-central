## Parent

https://github.com/Kiryushin-Andrey/volley-game-central/issues/8

**PRD:** `docs/prd/player-levels-and-game-format.md` (Technical Committee role)  
**Glossary:** `CONTEXT.md`

## What to build

Introduce the **Technical Committee member** role end-to-end so TC users can manage **player levels** on the **player levels page** without being **global administrators**.

**Data:** add `is_tc` boolean on users (default false). Membership is set in the database only (no in-app grant UI). Extend dev-mode user bootstrap so E2E can create TC-only users (`isTc` flag on dev login / test helpers).

**API:** replace global-admin-only guard on player-levels routes with **`isAdmin || isTc`** access for `GET /player-levels/users` and `PATCH /player-levels/users/:userId`. Expose `isTc` on `/users/me`; continue omitting `playerLevel` from session for everyone.

**UI:** allow TC on `/player-levels` (list, name filter, assign level in dialog with immediate save). Toolbar **Players** for TC-only (`isTc && !isAdmin`) navigates directly to `/player-levels`, not the **Players hub**. Redirect TC-only users away from `/players`, `/game-administrators`, and priority-players admin routes. **Global administrators** keep existing hub behavior. **Assigned game administrators** who are not TC or global admin remain blocked from player levels.

Do not add audit columns, level tier filter, or game-details participant taps in this slice.

## Acceptance criteria

- [ ] Migration adds `is_tc` on users
- [ ] `isAdmin || isTc` auth: TC and global admin can list/PATCH levels; participant and assigned-only admin receive 403
- [ ] `/users/me` includes `isTc`; no `playerLevel` on session
- [ ] TC-only: toolbar **Players** → player levels page; cannot open Players hub or other global-admin player routes
- [ ] Global admin flows from #21 still pass
- [ ] E2E **E2E-LEVELS-005**: TC-only user opens player levels and assigns a level via dialog
- [ ] E2E **E2E-LEVELS-006**: TC-only user redirected from `/players` (hub)
- [ ] `npm run test:e2e` green (existing + new scenarios documented in `docs/playwright-e2e-scenarios.md`)

## Blocked by

None — can start immediately (#20–#22 complete on integration branch).

## User stories (reference)

36–38, 44, 59; TC/global admin access for 29–30, 57 (assign only).
