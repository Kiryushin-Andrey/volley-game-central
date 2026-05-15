## Parent

https://github.com/Kiryushin-Andrey/volley-game-central/issues/8

## What to build

Enforce **positions game level restrictions** when `POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED` is truthy (`true` / `1`; unset or false = off). Only **`positions` format** games are affected; recreational and priority players games unchanged.

Extract a pure **positions game registration eligibility** module (unit-tested):

**Inputs:** `gameFormat`, `playerLevel | null`, `restrictionsEnabled`, `gameDateTime`, `now`, guest vs self, `hostCanSelfRegister`, existing registration (grandfathering), base registration open time from existing timing logic.

**Outputs:** `canSelfRegister`, effective `registrationOpensAt`, internal block reason (not exposed to players).

**Rules when restrictions on + positions game:**

| Level | Self-serve |
|-------|------------|
| `null`, `advanced` | Allowed per base timing |
| `intermediate` | Only from 3 days before start (roster or waitlist; no earlier waitlist) |
| `beginner` | Never |
| Already on roster/waitlist | Grandfathered; leaving applies level-blocked re-registration |
| Guest | Only if host can self-register |

**Backend:** integrate into self-serve register (403 when blocked); game detail returns `canSelfRegister` and effective open time for the current user.

**Frontend:** hide join button (and guest affordances when host blocked) like “registration not open yet”; never show level in UI.

Admin manual add-participant flows unchanged (past/readonly, no payment requests); level does not override those gates.

## Acceptance criteria

- [ ] Env var parsed at startup; default off when unset
- [ ] Eligibility module covered by unit tests (level × format × dates × grandfather × guest)
- [ ] Beginner cannot self-register or register guests on positions games when restrictions on
- [ ] Intermediate blocked until 3 days before start; advanced/unassigned unrestricted (subject to base timing)
- [ ] Grandfathered spots kept; no self-serve re-join after voluntary leave while still blocked
- [ ] Game detail drives hidden join button; no level leaked in errors or copy
- [ ] Recreational and priority players games unaffected when restrictions on

## Blocked by

- https://github.com/Kiryushin-Andrey/volley-game-central/issues/20
- https://github.com/Kiryushin-Andrey/volley-game-central/issues/21

## User stories (reference)

3–17, 39–42, 9–13, 40 from parent #8.
