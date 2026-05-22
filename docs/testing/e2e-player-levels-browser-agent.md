# E2E testing plan: Player levels & game format (browser agent)

Plan for end-to-end verification using a **browser-controlled agent** (e.g. Cursor computer-use). Assumes local dev stack, not Telegram WebApp embedding.

**Parent PRD:** [Issue #8](https://github.com/Kiryushin-Andrey/volley-game-central/issues/8)  
**Slices:** [#20](https://github.com/Kiryushin-Andrey/volley-game-central/issues/20) (game format) · [#21](https://github.com/Kiryushin-Andrey/volley-game-central/issues/21) (player levels admin) · [#22](https://github.com/Kiryushin-Andrey/volley-game-central/issues/22) (restrictions)

---

## 1. Goals

- Verify each vertical slice demoably in the **mini-app UI** plus observable API/DB effects.
- Use **deterministic personas** (global admin, regular players per level) via dev login.
- Avoid Telegram-only flows; use **browser + DEV_MODE** auth.
- Prefer **visible outcomes** (button present/absent, list order, pills, select options) over implementation details.
- Record **screenshots** at pass/fail for join-button and admin list states.

---

## 2. Environment setup

### 2.1 Start stack

```bash
./dev-start.sh
# Backend: http://localhost:3000
# Mini-app: http://127.0.0.1:3001
```

Confirm `DEV_MODE=true` (script sets it). Open **`http://127.0.0.1:3001`** in the browser (not `localhost` if the app assumes 127.0.0.1).

### 2.2 Database access (agent or shell)

```bash
psql "postgresql://postgres:postgres@localhost:5432/volley_game_central"
```

### 2.3 Restrictions toggle (slice #22 only)

Default: restrictions **off** when env unset.

For enforcement tests, restart backend with:

```bash
export POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED=true
# restart backend process only
```

To turn off again: unset variable and restart.

### 2.4 Agent session hygiene

| Action | How |
|--------|-----|
| Switch user | Header **Logout** → phone auth again with different number |
| Avoid cookie bleed | Use separate browser profiles for parallel personas, or always logout before switching |
| See future games | As global admin: Games list → enable **Show all scheduled games** |
| See games not on Sun/Thu | Category multiselect includes **other** (default filter is **sunday** only; games on Mon–Sat except Thu are `other`) |
| Open a game by id | Navigate to `/game/:id` when the card is hidden by category filter |
| Hard refresh after deploy | Full page reload if API behavior changed mid-run |

---

## 3. Test personas (dev login)

Use **distinct Dutch-style test phones** (+31 prefix in UI; enter local digits only).

| Persona | Phone (local digits) | Dev login | DB after slice #21 |
|---------|----------------------|-----------|---------------------|
| **Global Admin** | `610000001` | Display name `Admin E2E`, **Administrator** checked | `is_admin = true` |
| **Player Unassigned** | `610000002` | `Unassigned Player` | `player_level` NULL |
| **Player Advanced** | `610000003` | `Advanced Player` | `advanced` |
| **Player Intermediate** | `610000004` | `Intermediate Player` | `intermediate` |
| **Player Beginner** | `610000005` | `Beginner Player` | `beginner` |
| **Non-admin** | `610000006` | `Regular User` (no admin checkbox) | not admin |

**After logging in as Global Admin**, assign levels via Player levels UI (slice #21), or pre-seed:

```sql
-- After migration adds player_level column:
UPDATE users SET player_level = 'advanced'    WHERE phone_number LIKE '%610000003';
UPDATE users SET player_level = 'intermediate' WHERE phone_number LIKE '%610000004';
UPDATE users SET player_level = 'beginner'     WHERE phone_number LIKE '%610000005';
-- 610000002 stays NULL
```

### 3.1 Login steps (every persona)

1. Open `http://127.0.0.1:3001`
2. If unauthenticated: phone auth modal appears
3. Enter phone local digits → **Dev Login** path (no SMS)
4. Enter display name (+ admin checkbox if needed) → **Dev Login**
5. Confirm header shows display name and games list loads

---

## 4. Agent navigation map

| Area | URL / entry |
|------|-------------|
| Games list | `/` |
| Game details | `/game/:id` (click card) |
| Create game | Admin toolbar **+** → `/games/new` |
| Players hub | Admin toolbar **people icon** → `/players` |
| Game administrators | `/game-administrators` or hub link |
| Player levels | `/player-levels` or hub link |
| Logout | Header control |

### 4.1 What to look for (stable UI cues)

| Feature | Pass signal | Fail signal |
|---------|-------------|-------------|
| Game format select | Exactly three options: recreational / positions / priority players | Two toggles “Playing 5-1” + “With priority players” |
| Level pill | Green / yellow / red badge right-aligned on row | Pill on unassigned row |
| Join game | Primary button **Join Game** visible | Button absent (not disabled with level text) |
| Leave game | **Leave Game** when registered | — |
| Level in player UI | Never visible on game details for non-admin | Any “beginner/intermediate/advanced” label for regular user |
| Players hub | Two links: Game administrators, Player levels | Toolbar opens game administrators directly |

---

## 5. Fixture helpers (SQL)

Run as **Global Admin** or via `psql` before UI steps.

### 5.1 Set game start relative to “now” (timing tests)

```sql
-- Game starts in 7 days (intermediate should NOT join when restrictions on)
UPDATE games SET date_time = NOW() + INTERVAL '7 days' WHERE id = <GAME_ID>;

-- Game starts in 2 days (intermediate SHOULD join when restrictions on)
UPDATE games SET date_time = NOW() + INTERVAL '2 days' WHERE id = <GAME_ID>;

-- Game starts in 12 hours (everyone past registration-open if base is 10 days — adjust per env)
UPDATE games SET date_time = NOW() + INTERVAL '12 hours' WHERE id = <GAME_ID>;
```

After changing `date_time`, reload game details in browser.

### 5.2 Read game format (post–slice #20)

```sql
SELECT id, title, game_format, date_time FROM games ORDER BY id DESC LIMIT 5;
```

### 5.3 Grandfathering setup

1. Restrictions **off**
2. Beginner joins positions game via UI
3. Turn restrictions **on** (env + restart)
4. Beginner still on roster; join button hidden for other beginners not on list

---

## 6. Test suites

### Suite A — Slice #20: Game format enum

**Pre:** Implementation of #20 merged; migrations applied.

| ID | Steps | Expected |
|----|--------|----------|
| A1 | Login as **Global Admin** → Create game | Form has **one select** `#gameFormat` (three formats), not two toggles |
| A2 | Create **Recreational** game (future date; use a **Sunday** datetime or +2 days within registration window — see §10) | Game saves; details show no positions/priority-only behavior |
| A3 | Create **Positions** game (same date guidance as A2) | `game_format = positions` in DB; category/badge reflects positions where applicable |
| A4 | Create **Priority players** game (same date guidance as A2) | `game_format = priority_players`; **not** treated as positions game |
| A5 | Open a game from A2–A4: card on home **or** direct `/game/:id` | Loads without error; format visible in edit form `#gameFormat` |
| A6 | **Priority players** game (id from A4) as **Unassigned** (`610000002`) via `/game/:id` | Priority disclaimer / 10-day vs 3-day behavior unchanged from before (join window differs for priority list — smoke only) |
| A7 | **Recreational** game as **Beginner** with restrictions **on** (if #22 already shipped) | Join **not** blocked by level (recreational exempt) |

**Demo checkpoint:** Three created games in DB with distinct `game_format`; on home list after **Show all scheduled games** + category **other** (if dates are not Sunday/Thursday), or open each via `/game/:id`.

---

### Suite B — Slice #21: Player levels admin

**Pre:** #21 merged; restrictions still **off**.

| ID | Steps | Expected |
|----|--------|----------|
| B1 | **Global Admin** → toolbar Players icon | Lands on **Players** hub with two links |
| B2 | Hub → **Game administrators** | Existing page loads |
| B3 | Hub → **Player levels** | List loads; unassigned group first |
| B4 | Find **Unassigned Player** | No level pill |
| B5 | Click **Unassigned Player** → set **Beginner** in dialog | Saves immediately; red pill appears; no “unassigned” option after first assign |
| B6 | Filter box: type partial name | List filters client-side; still responsive |
| B7 | Change same player **Beginner → Advanced** | Pill turns green |
| B8 | Logout → **Regular User** (non-admin) → navigate to `/players` or `/player-levels` | Blocked or redirected; no admin list |
| B9 | Logout → **Regular User** → open any game | No level shown anywhere |
| B10 | **Beginner** opens **Positions** game (restrictions off) | **Join Game** still visible (no enforcement this slice) |

**Demo checkpoint:** Admin can assign levels; non-admin never sees levels.

---

### Suite C — Slice #22: Positions level restrictions

**Pre:** #20 + #21 done; `POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED=true`; backend restarted.

Create one **Positions** game per timing bucket via admin (or SQL adjust `date_time`):

| Game alias | `date_time` | Purpose |
|------------|-------------|---------|
| `POS-FAR` | now + 7 days | Intermediate blocked |
| `POS-NEAR` | now + 2 days | Intermediate allowed |
| `POS-ANY` | now + 5 days | Advanced / unassigned |

| ID | Persona | Game | Expected |
|----|---------|------|----------|
| C1 | **Beginner** | `POS-NEAR` | No **Join Game**; no guest/add flow that bypasses |
| C2 | **Advanced** | `POS-FAR` | **Join Game** visible (subject to normal registration-open rules) |
| C3 | **Unassigned** | `POS-FAR` | Same as advanced |
| C4 | **Intermediate** | `POS-FAR` | No **Join Game** |
| C5 | **Intermediate** | `POS-NEAR` | **Join Game** visible; can join roster or waitlist |
| C6 | **Beginner** | **Priority players** game | Join **not** blocked by level |
| C7 | **Beginner** | **Recreational** game | Join **not** blocked by level |
| C8 | **Advanced** | `POS-NEAR` → join → leave | After leave, **Join Game** hidden if policy blocks re-join (N/A for advanced — should re-join allowed) |
| C9 | **Beginner** | `POS-NEAR` → join while restrictions **off**, then env **on** | Still on list (**grandfather**) |
| C10 | **Beginner** | C9 after unregister | Cannot self-join again |
| C11 | **Beginner** on `POS-NEAR` | Guest registration UI | Hidden/disabled (host cannot register guests) |
| C12 | **Advanced** on `POS-NEAR` | Guest registration | Follows normal guest rules (smoke: control visible if within guest window) |
| C13 | Restrictions **off** (restart) | **Beginner** on new `POS-NEAR` | **Join Game** visible |

**API cross-check (optional agent shell):**

```bash
# As beginner cookie/session — expect 403 on register
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/games/<ID>/register \
  -H "Cookie: auth_token=<token>" 
```

**Demo checkpoint:** Join button visibility matches level matrix; no level strings in player-facing UI.

---

### Suite D — Full regression (post all slices)

| ID | Scenario |
|----|----------|
| D1 | Admin **manual add participant** on past/readonly game still works for **Beginner** (existing gates only) |
| D2 | Game edit: change format recreational → positions (or vice versa) saves and details update |
| D3 | Players list sort: unassigned → advanced → intermediate → beginner, A–Z within group |
| D4 | `true/true` legacy row (if seeded) shows as recreational and behaves recreationally |

---

## 7. Suggested agent execution order

```mermaid
flowchart TD
  setup[Setup stack + personas]
  A[Suite A - Game format]
  B[Suite B - Player levels admin]
  env[Enable restrictions env + restart]
  C[Suite C - Restrictions]
  D[Suite D - Regression]
  setup --> A --> B --> env --> C --> D
```

1. Run **setup** once (personas + admin login check).
2. **Suite A** after #20.
3. **Suite B** after #21 (can parallel with A if two browser profiles).
4. Enable env → **Suite C** after #22.
5. **Suite D** before merge to main.

---

## 8. Recording & reporting

For each test ID, agent should capture:

- **Screenshot** of game details (join button area) for C* cases
- **Screenshot** of player levels list for B* cases
- **Note** game `id` and `date_time` used
- **Pass/Fail/Blocked** with one-line reason

Template:

```text
[C4] FAIL — Intermediate on POS-FAR (id=42): Join Game visible; expected hidden.
Screenshot: artifacts/c4-intermediate-far.png
```

---

## 9. Out of scope for this E2E plan

- Telegram WebApp initData auth and real group-membership checks
- Bunq payments and payment-request-sent participant locks
- Production env var rollout (only local toggle)
- Load testing 300+ users on player levels list
- Mobile viewport / Telegram theme specifics (optional smoke only)

---

## 10. Known limitations & mitigations

| Limitation | Mitigation |
|------------|------------|
| Registration-open uses 10-day default for non-priority games | Use “Show all scheduled games”; set `date_time` within open window or use SQL |
| Intermediate 3-day rule needs clock alignment | Use SQL `date_time` offsets; document “now” at test start |
| Single browser session | Strict logout between personas |
| Default category filter is Sunday | For Suite A create/edit smoke, pick a Sunday `date_time`, or add **other** (and Thu categories if needed) in the multiselect |
| Dev login sets `isAdmin` only at create | Use checkbox on first login or SQL `UPDATE users SET is_admin = true` |
| `player_level` column absent before #21 | Run Suite B/C only after migration |

---

## 11. Issue mapping

| Suite | GitHub issue | Env |
|-------|--------------|-----|
| A | #20 | default |
| B | #21 | restrictions off |
| C | #22 | `POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED=true` |
| D | #8 (parent) | both states |
