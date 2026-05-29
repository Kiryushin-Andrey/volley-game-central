# Volleyball game registration

Telegram mini-app for scheduling volleyball sessions, registering players, and managing game administration.

## Language

**Positions game**:
A scheduled game played with assigned positions. One of three **Game format** options; not a priority players game. Subject to **Positions game level restrictions** when those are active.
_Avoid_: 5-1 game (use only in user-facing copy where the community already expects it, e.g. category labels)

**Game format**:
How a game is configured — exactly one of: **Recreational game**, **Positions game**, or **Priority players game**. Stored as a single three-value field: `recreational`, `positions`, or `priority_players`. Drives positions play, priority registration windows, and whether **Positions game level restrictions** apply.

**Recreational game**:
A standard game without assigned positions and without priority registration windows.
_Avoid_: Regular game

**Priority players game**:
A game that uses priority-player registration windows (10-day / 3-day rules) but is not a positions game. Player levels do not restrict access to these games.

**Player level**:
A skill tier assigned to a player by a **Global administrator** or **Technical Committee member**. Stored as `beginner`, `intermediate`, or `advanced`; unassigned players have no value (`null`). Used to gate access to positions games when restrictions are enabled.
_Avoid_: Level (ambiguous — could mean game difficulty or Nevobo class)

**Level pill**:
A read-only, color-coded label on the player-levels admin list, right-aligned on each row. Advanced: light green; intermediate: light yellow; beginner: light red. Unassigned players have no pill. Assignment happens in the player info dialog, not via the pill; changes save immediately. Once assigned, a level is only changed to another level — not cleared back to unassigned.

**Unassigned player**:
A registered player who has no player level set. **Global administrator**s and **Technical Committee member**s see the label “Unassigned” in the **Player info dialog** and on the **Player levels page** until a level is assigned. Treated like a newcomer for positions-game access when restrictions are enabled.

**Global administrator**:
A user with system-wide admin privileges (`isAdmin`). Has all **Technical Committee member** capabilities for player levels (same **Player info dialog** level fields at every entry point), plus broader club administration including payments and moderation in the dialog. Does not manage TC membership in the app (that flag is set in the database).
_Avoid_: Game administrator (day/positions assignment — different role)

**Technical Committee member** (TC member):
A user flagged for player-level stewardship (`is_tc` on the user record). Membership is granted or revoked by editing the database directly (no in-app admin UI for this flag). May use the **Player levels page** and open the **Player info dialog** from **Game details** (participant tap) and from the player levels list. Cannot access **Players hub**, game administrators, or priority players admin routes unless also **Global administrator**. May assign or change **Player level** in the dialog only on the **Player levels page**; elsewhere read-only. On **Game details**, may tap participants to open the dialog but does not gain other game-admin actions unless also **Assigned game administrator** or **Global administrator**.
_Avoid_: TC (use spelled-out term in glossary; “TC” is fine in UI labels if the club prefers)

**Assigned game administrator**:
A user assigned to run games for specific weekdays and formats via `game_administrators`. May manage games, rosters, and related flows for those assignments. Cannot view or change **Player level** or **Level assignment record** unless also a **Technical Committee member** or **Global administrator**.
_Avoid_: Restricted admin (informal), game administrator when meaning global admin

**Players hub**:
Admin landing page (toolbar “Players” → `/players`) with links to game administrators and player levels management. Shown only to **Global administrator**s.

**Player levels page**:
The list of all registered users with **Level pill**s, name filter, and row → **Player info dialog**. Toolbar “Players” for **Technical Committee member**s who are not global administrators opens this page directly (`/player-levels`), not the **Players hub**. The client loads the full admin user list once (~300 users) and keeps it in memory for name filtering on this page and for resolving **Player level** / **Level assignment record** when opening **Player info dialog** from **Game details** (no per-user fetch on each tap).

**Intermediate registration window**:
For positions games, an intermediate player may register (roster or waitlist) only starting 3 days before game start. Before that window, registration is rejected entirely — no early waitlist.

**Positions game level restrictions**:
When active, player levels determine who may register for **Positions games** only (beginner blocked; intermediate from 3 days out; advanced and unassigned unrestricted). Does not apply to recreational or priority players games. When inactive, level does not affect registration — useful for a phased rollout.

**Grandfathered registration**:
A player who is already on the roster or waitlist for a positions game keeps that spot when their level changes or when restrictions are turned on. They are not removed automatically.

**Level-blocked re-registration**:
After a level-blocked player unregisters from a positions game, they cannot re-join that game via self-serve registration while restrictions apply and their level still blocks them.

**Level-blocked registration (UX)**:
When restrictions block self-serve registration (e.g. beginner on a positions game), the join control is hidden — same pattern as when registration is not yet open. No level is shown in the UI; organizers handle questions out of band.

**Guest registration under level restrictions**:
A host who cannot self-register for a positions game also cannot register guests for that game. When the host may register, guests follow the usual guest rules only.

**Level assignment record**:
Who last set or changed a player's **Player level**, recorded as the setter's display name only in the UI (no date or time shown). Stored as references on the player; updated on every level change. Visible to **Global administrator**s and **Technical Committee member**s on the **Player levels page** (for assigned rows) and in the **Player info dialog**. Unassigned players have no record until a level is assigned.

**Player info dialog** (level context):
Modal showing a player's profile. Which sections appear depends only on the **viewer's role** (same at every entry point). **Global administrator**s see unpaid games, payment reminders, block/unblock, **Player level**, and **Level assignment record**. **Technical Committee member**s who are not global administrators see identity, **Player level**, and **Level assignment record** only. **Assigned game administrator**s without TC or global admin see the admin dialog without level fields. **Player level** is **editable** in the dialog only when opened from the **Player levels page**; at all other entry points (e.g. **Game details**, priority players, game administrators) stewards see level and audit **read-only**.

## Relationships

- Only a **Positions game** is subject to **Positions game level restrictions**
- A **Priority players game** uses priority registration timing but is not a **Positions game**
- **Game format** determines whether positions apply, whether priority windows apply, and whether level restrictions can apply
- An **Unassigned player** has no **Player level** until a **Global administrator** or **Technical Committee member** assigns one
- A **Global administrator** may perform every **Technical Committee member** action on player levels; a **Technical Committee member** who is not a global administrator may not perform global-admin-only actions
- An **Assigned game administrator** without TC or global admin role cannot view or change **Player level**
- **Technical Committee member**s who are not **Global administrator**s do not see payment or moderation sections in the **Player info dialog**
- **Technical Committee member**s may tap participants on **Game details** to open **Player info dialog** without gaining other game-admin capabilities
- Every **Player level** change updates the **Level assignment record** for that player
- **Positions game level restrictions** control whether **Player level** affects registration for **Positions games**
- **Grandfathered registration** protects existing spots; **Level-blocked re-registration** applies only after the player leaves voluntarily
- **Global administrator**s use **Players hub**; **Technical Committee member**s without global admin use **Player levels page** from the toolbar

## Example dialogue

> **Dev:** "Should Saturday's game with positions block beginners?"
> **Domain expert:** "Yes — any **Positions game** uses the same rules, not only Thursdays."

## Flagged ambiguities

- "5-1 game" vs **Positions game** — resolved: prefer **Positions game** / "with positions" in domain language; legacy UI may still say "5-1".
- Intermediate early waitlist — resolved: no registration at all until the 3-day window opens.
- How restrictions are toggled — resolved: globally on/off via `POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED` (unset or false = off); inactive by default at deploy.
- Existing registrations when level changes — resolved: **Grandfathered registration**; no auto-remove.
- Admin adding players — resolved: same rules as today (game must be past or readonly; no payment requests sent yet); player level does not relax those gates.
- Where level is edited — resolved: assign/change in **Player info dialog** for stewards at any entry point; **Level pill** on each row is display-only.
- Player-levels search — resolved: name filter above the list (client-side or debounced API); not search inside the dialog.
- Who manages levels — resolved: **Global administrator** or **Technical Committee member** (`isAdmin` or `is_tc`); **Assigned game administrator** excluded unless they also hold one of those roles.
- **Game format** vs level restrictions — resolved: only **Positions game** is level-gated; **Priority players game** is not a positions game and has no level restrictions.
- "Regular game" naming — resolved: **Recreational game**.
- Game storage shape — resolved: one three-value **Game format** field (`recreational` | `positions` | `priority_players`) replaces the two booleans in the data model and UI.
- Level assignment UX — resolved: immediate save in dialog; no “clear to unassigned” action.
- Players hub — resolved: title “Players” at `/players`; links **Game administrators** → `/game-administrators`, **Player levels** → `/player-levels`.
- TC toolbar navigation — resolved: **Technical Committee member** without global admin: toolbar **Players** → **Player levels page** only; no **Players hub**.
- Blocked registration UX — resolved: hide join button when level blocks registration; no level revealed in UI (Option A if an error is ever needed elsewhere).
- Guests vs levels — resolved: **Guest registration under level restrictions** (Option A).
- Player level storage — resolved: nullable `beginner` | `intermediate` | `advanced` on the user.
- Player-levels list loading — resolved: load all users once (~300), filter client-side; list order: unassigned → advanced → intermediate → beginner, alphabetical within each group.
- Legacy `withPositions` + `withPriorityPlayers` both true — resolved: none expected; if any exist, migrate to `recreational`.
- Level assignment audit — resolved: **Level assignment record**; display setter **display name only** (no timestamp); show on **Player levels page** and **Player info dialog** for TC/global admin; nothing for unassigned until first assignment.
- Level edit surfaces — resolved: dialog **sections** are **role-based only**; **Player level** is **editable** only on **Player levels page**, read-only in the dialog at all other entry points.
- TC membership management — resolved: `is_tc` set manually in the database; no grant/revoke UI or API in the app.
- TC player info dialog scope — resolved: TC (non–global-admin) sees identity + level + **Level assignment record** only; no unpaid games, reminders, or block/unblock.
- TC game details access — resolved: **Technical Committee member** (including TC-only) can tap roster/waitlist on **Game details** to open **Player info dialog** only (`canOpenPlayerInfo`); read-only level there; no remove player, guests, payments, or other **Assigned game administrator** controls unless they also hold that role or **Global administrator**.
- Assigned admin level visibility — resolved: **Assigned game administrator** without TC/global admin sees no level fields in **Player info dialog** or elsewhere.
- Player info dialog behavior — resolved: which sections appear is determined by **viewer role** only (same at every entry point); whether **Player level** is editable depends on opening from **Player levels page** vs elsewhere (read-only).
- TC admin route access — resolved: TC-only users cannot navigate to **Players hub**, game administrators, or priority players pages; they use **Player levels page** and **Game details** participant dialog only.
- Unassigned steward display — resolved: show “Unassigned” to stewards in dialog and on player levels page; no **Level assignment record** until first assignment.
- Session exposes isTc — resolved: `/users/me` includes `isTc` for client routing and UI checks; `playerLevel` remains omitted for all users on that endpoint.
- Player levels client cache — resolved: preload full admin list for **Global administrator** and **Technical Committee member**; use cache for dialog level/audit on game taps; refresh list after a level PATCH.
