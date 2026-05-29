## Parent

https://github.com/Kiryushin-Andrey/volley-game-central/issues/8

**PRD:** `docs/prd/player-levels-and-game-format.md`  
**Glossary:** `CONTEXT.md` — **Player info dialog**

## What to build

Complete **player info dialog** and **game details** participant-tap behavior for global administrators and Technical Committee members.

**Dialog (all entry points):** sections depend on **viewer role** only — same rules everywhere:
- **Global administrator:** full dialog (payments, moderation, level + audit); level **editable** only when opened from **player levels page** (`allowLevelEdit`), **read-only** elsewhere
- **Technical Committee member** (not global admin): identity + **Player level** + **Level assignment record** only; same edit vs read-only rule
- **Assigned game administrator** (not TC or global admin): no level fields; existing admin sections unchanged

When the dialog opens without list row data (e.g. from **game details**), lazily load **player level profile** via `GET /player-levels/users/:userId`. Do **not** embed level on game registration/participant JSON.

**Game details:** `canOpenPlayerInfo = isGameAdmin || isTc` for roster/waitlist name taps. TC-only users do **not** gain remove-player, guest, payment, or other **assigned game administrator** controls.

## Acceptance criteria

- [ ] TC can tap participant on game details; dialog shows read-only level, **Unassigned** / **Set by** as applicable; no payment or moderation UI
- [ ] TC cannot remove players or use game-admin actions they did not have before
- [ ] Global admin on game details sees read-only level + audit outside player levels page; full dialog otherwise
- [ ] Assigned-only admin: participant dialog unchanged — no level fields
- [ ] Lazy fetch uses `GET /player-levels/users/:userId`; no `playerLevel` on public participant payloads
- [ ] E2E **E2E-LEVELS-009**: TC-only opens game, taps roster name, sees level read-only, no block/unpaid sections
- [ ] E2E **E2E-LEVELS-010**: global admin on game details sees read-only level (not editable) when not opened from player levels page
- [ ] E2E **E2E-LEVELS-011**: assigned-only admin taps participant — no level text in dialog
- [ ] `npm run test:e2e` green

## Blocked by

- #23 (TC role, `isTc` on session, player-levels admin routes)
- #24 (`GET /player-levels/users/:userId` and **Level assignment record** in API)

## User stories (reference)

34, 39–41, 45, 58.
