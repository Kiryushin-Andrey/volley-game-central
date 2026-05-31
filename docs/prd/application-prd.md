# Haarlem Volley Bot — Product Requirements Document

**Document type:** Full-application PRD (current product behavior)  
**Audience:** Product managers, designers, and engineers rebuilding or validating the product  
**Perspective:** Written as if the product does not exist yet — describes what to build, not how it is implemented  
**Last aligned with codebase:** May 2026  

---

## 1. Product overview

### 1.1 Vision

Haarlem Volley Bot is a **volleyball game registration and hall-fee collection** product for a non-profit recreational volleyball community in Haarlem, Netherlands. Members discover scheduled sessions, sign up (or join a waitlist), bring guests when allowed, and pay their share of court rental after games. Organizers create games, manage rosters, assign skill tiers for competitive sessions, and collect payments through a Dutch banking integration (Bunq).

The product is delivered primarily as a **Telegram Mini App** (embedded in Telegram) with a **web browser** fallback that uses the same screens but adds a site header, logout, and display-name editing.

### 1.2 Problems solved

| Problem | How the product addresses it |
|--------|------------------------------|
| Scattered sign-up (chats, spreadsheets) | Central schedule with live capacity and waitlist |
| Fair access to popular slots | Registration windows, optional skill gating for positions games |
| Collecting hall fees | Per-game pricing, payment requests after games, pay links, reminders |
| Organizer workload | Game administrators per weekday/format, admin tools on game pages |
| Skill-appropriate competitive play | Internal player levels (invisible to regular players) for positions games when enabled |

### 1.3 What the product is not

- Not a league management or match-statistics platform  
- Not a profit-making booking marketplace  
- Not a public website for anonymous browsing — users must authenticate to use the schedule  
- Not responsible for teaching volleyball rules or Nevobo classification (community norms are explained in help copy only)

### 1.4 Success criteria (product level)

- A member can find the next suitable game, register, and pay without leaving Telegram when possible  
- An organizer can run a full game lifecycle: create → registrations → readonly lock → payment requests → reconciliation  
- Skill gating for positions games can be rolled out in two phases: assign levels first, enforce later  
- Payment and registration rules are enforced consistently on the server; the UI reflects eligibility without exposing internal tiers to regular players  

---

## 2. Users and roles

### 2.1 Personas

| Persona | Description |
|---------|-------------|
| **Participant** | Registers for games, may add guests, pays after games |
| **Guest (non-user)** | Named person added by a participant; not a separate login |
| **Global administrator** | Full club operations: all games, payments config, player moderation, game administrator assignments, player levels |
| **Assigned game administrator** | Runs games for specific weekday + format assignments (e.g. Thursday positions); can create/edit/manage those games |
| **Technical Committee member (TC)** | Manages internal **player levels** only; no payment moderation or game-administrator management unless also global admin |

### 2.2 Role capabilities summary

| Capability | Participant | Assigned game admin | TC (not global admin) | Global admin |
|------------|:-----------:|:-------------------:|:---------------------:|:------------:|
| View upcoming/past games (default window) | Yes | Yes | Yes | Yes |
| Register / leave / guest (when rules allow) | Yes | Yes | Yes | Yes |
| Create game (+) | No | For assigned day/format | No | Yes |
| Edit/delete game, roster admin tools | No | For assigned games | No | Yes |
| Players hub, game administrators, Bunq settings | No | No | No | Yes |
| Player levels page | No | No | Yes (direct nav) | Yes (via hub) |
| Player info: block, unpaid, reminders | No | On games they admin | No | Yes |
| Player info: edit level | No | No | On player levels page only | On player levels page only |
| Tap player on game details for info dialog | No | Yes | Yes (read-only level) | Yes |

TC membership and global admin flags are **granted outside the app** (database); there is no in-app UI to promote users to TC.

### 2.3 Authentication methods

1. **Telegram** — User opens the Mini App from the club bot; identity comes from Telegram. Registration for games may require membership in the club Telegram group (enforced server-side for Telegram users).  
2. **Phone number** — User enters Dutch mobile number (`+31` prefix fixed in UI), receives SMS one-time code (production), or uses **dev login** (development only: name + optional admin/TC flags, no SMS).  
3. **New phone users** — After code verification, if no account exists, user must choose a **unique display name** (availability checked live).

### 2.4 Platforms and shell differences

| Aspect | Telegram Mini App | Web browser |
|--------|-------------------|-------------|
| App chrome | Telegram native back button, main button (Join/Leave) | Site header: brand link home, display name (editable), Logout |
| Theme | Follows Telegram theme | Follows system light/dark via CSS |
| Deep link | Bot `start` parameter can open a specific game (`game_<id>`) | URL path `/game/:id` |
| Session | Telegram init data | HTTP-only session cookie after phone auth |
| Auto-refresh | App polls server build version every 60s and reloads if backend redeployed | Same |

---

## 3. Information architecture

### 3.1 Route map (authenticated)

| Route | Screen name | Who typically visits |
|-------|-------------|----------------------|
| `/` | Games home | Everyone |
| `/game/:gameId` | Game details | Everyone |
| `/games/new` | Create game | Global admin, assigned game admin |
| `/game/:gameId/edit` | Edit game settings | Game admin for that game |
| `/players` | Players hub | Global admin only |
| `/game-administrators` | Game administrators | Global admin |
| `/player-levels` | Player levels | Global admin, TC |
| `/bunq-settings` | Bunq integration (club default) | Global admin |
| `/bunq-settings/user/:userId` | Bunq integration (per game admin) | Global admin |
| `/check-payments` | Global payment check | Reachable by URL (password gate); not linked in main nav |

### 3.2 Unauthenticated

| Screen | Purpose |
|--------|---------|
| Landing | Choose Telegram (opens bot) or Phone auth |
| Phone auth overlay | Multi-step login / signup |

### 3.3 Navigation patterns

- **Games home** is the default home after login.  
- **Game card tap** → game details.  
- **Telegram back** on game details, create/edit, admin subpages → previous screen (usually games home).  
- **Browser** uses header brand link for home; game details error state offers “Back to Games”.  
- **TC-only** users see “Manage player levels” on games home instead of Players hub.  
- **Global admin** sees icon toolbar: Players, Bunq settings, Create game.  
- **Assigned game admin** sees Create game only (no Players/Bunq icons).

Unauthorized direct URL access to admin routes redirects: TC → player levels or home; non-admin → home or parent admin route per rules.

---

## 4. Domain concepts (product language)

### 4.1 Game

A scheduled volleyball session with:

- Date and time  
- Location name (required) and optional maps URL  
- Optional title  
- Maximum players (capacity for active roster)  
- Unregister deadline (hours before start; default 5)  
- Cost (see pricing)  
- **Game format** (exactly one): recreational or positions  
- **Readonly** flag — when on, participants cannot self-register or leave; organizers manage roster manually  
- Optional **seasonal tag** for visual theming only: Halloween, New Year, March 8  
- **Category** (derived for UX, not a separate field): Thursday 5-1, Sunday, Other — based on weekday + format  

### 4.2 Game format

| Format | User-facing label (create/edit) | Meaning |
|--------|--------------------------------|---------|
| Recreational | Recreational game | Open style; no assigned positions; standard registration window |
| Positions | With positions | 5-1 style assigned positions; may use skill gating when enabled |

Help text on the form: *Recreational: open registration for everyone. With positions: 5-1 assigned positions.*

### 4.3 Registration states

| State | Meaning |
|-------|---------|
| **Active (roster)** | Counts toward `maxPlayers`; user is “in” the game |
| **Waitlist** | Registered but over capacity; promoted in registration order when someone leaves |
| **Guest** | Separate roster row with guest name; linked to inviter; own spot (may be waitlisted independently) |

Badges: **You're in** (active), **Waitlist**.

### 4.4 Registration timing (defaults)

| Rule | Days before game | Notes |
|------|------------------|-------|
| Standard self-registration opens | 10 | Recreational and positions games |
| Guest registration opens | 3 | Host must also be allowed to register |
| Unregister deadline | 5 hours before start (configurable per game 0–48h) | Waitlisted users may always leave |

Server may return a precise `registrationOpensAt` datetime (e.g. level-based 3-day window for intermediate on positions games). UI shows: *You can register for this game starting from {date} ({N} days before the game).*

### 4.5 Player level (internal)

| Level | Purpose |
|-------|---------|
| Unassigned | Newcomer; treated like unrestricted for positions gating when restrictions on |
| Beginner | Blocked from self-serve positions games when restrictions on |
| Intermediate | May register for positions games only from 3 days before start (no early waitlist) |
| Advanced | Unrestricted for positions games |

**Not shown** to regular participants anywhere. Join button is **hidden** when blocked (not an error explaining level).

**Grandfathering:** If already on roster or waitlist when level or restrictions change, spot is kept.  
**Re-registration:** After leaving while blocked, cannot self-serve re-join until eligible.  
**Guests:** If host cannot self-register, cannot register guests for that game.

Restrictions apply only to **positions** format and only when globally enabled (off by default at deploy).

### 4.6 Game administrator assignment

Links a user to:

- Day of week (Monday–Sunday)  
- Whether the assignment is for **5-1 positions** games on that day  

From this assignment, organizers may configure optional **per-user Bunq settings** (payment collection for games they run).

### 4.7 Pricing

| Mode | Organizer enters | Participant sees |
|------|------------------|------------------|
| Per participant | Price per person | `€X.XX per participant` |
| Total game cost | Total hall cost | `€X.XX per participant` computed as total ÷ max players (for upcoming games, display capped at €15.00 per participant until game is past) |

Payment amount of zero hides price line.

### 4.8 Payments lifecycle

1. Game takes place (or becomes past / readonly).  
2. Game admin sends **payment requests** (requires Bunq enabled + password).  
3. Participants receive link via Telegram/SMS (out of band — not simulated in UI tests).  
4. **Unpaid games** appear on games home with **Pay now** (opens Bunq link in new tab).  
5. Admin can **check payments** (per game or global) with Bunq password; marks paid/unpaid on roster after requests sent.  
6. Admin can send **payment reminder** from player info dialog.

### 4.9 Blocked user

Global admin blocks with a **reason** string. Blocked user cannot register or add guests; reason shown in player info and in registration-blocked dialogs.

---

## 5. Screen specifications

### 5.1 Landing (unauthenticated)

**Purpose:** Entry point for web users; Telegram users typically skip this by opening the bot.

**Content:**

- Title: **Welcome**  
- Subtitle: **Choose how you want to continue:**  
- Primary actions:  
  - **Telegram** — link to configured bot (`https://t.me/{bot}`); disabled style if bot not configured  
  - **Phone number** — opens phone auth overlay  
- Expandable **How it works:**  
  - Community description (Haarlem, non-profit, welcome to join)  
  - Registration via Telegram or phone; notifications for payments and changes  
  - Fees cover hall rental only  
  - Link to GitHub source repository  
- Hint if Telegram bot name missing: *Telegram bot name is not configured.*

**States:** None beyond static content.

---

### 5.2 Phone authentication (overlay)

**Purpose:** Sign in or create account with phone.

#### Step A — Phone number

| Element | Behavior |
|---------|----------|
| Phone field | Fixed `+31` prefix; local digits only |
| Note | SMS code will be sent (production) |
| **Continue** | Starts auth; disabled if empty or busy; shows **Sending…** |
| Dev-only: Display name | Required for dev login |
| Dev-only: Administrator checkbox | Grants global admin |
| Dev-only: Technical Committee checkbox | Grants TC |
| Dev-only: **Dev Login** | Skips SMS |
| Dev note | *Dev mode: No SMS verification required* |

**Errors:** Failed to start auth; dev validation messages; dev login failed.

#### Step B — Verification code

| Element | Behavior |
|---------|----------|
| Six digit boxes | Auto-advance, paste support, auto-submit when complete |
| **Resend code** | 60-second cooldown |
| **Cancel** | Return to phone step |

**Errors:** Invalid/expired code; session not initialized; resend rate limit.

#### Step C — Display name (new users only)

| Element | Behavior |
|---------|----------|
| Display name field | Placeholder *e.g. John Doe* |
| Availability | Checking… / Name is available / This name is already taken |
| **Continue** | Disabled if empty, taken, checking, or busy |

**Success:** Close overlay; reload app to authenticated home.

---

### 5.3 Games home (`/`)

**Purpose:** Browse games; pay outstanding fees; admin entry points.

#### Section: Your unpaid games (conditional)

Shown when: user has unpaid past games **and** filter is **Upcoming** **and** there are unpaid items.

| Element | Content |
|---------|---------|
| Heading | **Your unpaid games** |
| Each row | Amount €X.XX, date/time, optional location |
| **Pay now** | Opens payment URL in new tab |
| **Show upcoming games** | If unpaid section was hiding the list, reveals main content |

#### Section: Filters and admin toolbar

**Category multi-select** (upcoming only):

- Options: **Thursday 5-1**, **Sunday**, **Other**  
- Placeholder: **Select categories**  
- Persisted on device; default if empty: **Sunday** only  
- Deselecting all categories → empty list  

**Admin / power-user controls** (see role matrix):

| Control | Label | Effect |
|---------|-------|--------|
| Radio | **Upcoming** / **Past** | Switches game list mode |
| Checkbox | **Show all scheduled games** (upcoming) | Includes games outside default registration visibility |
| Checkbox | **Show fully paid games** (past) | Includes past games where everyone paid |
| Icon | Players | → Players hub |
| Icon | Settings (cog) | → Bunq settings |
| Icon | Plus | → Create game |
| Link | Manage player levels | TC-only → Player levels |

#### Section: Game cards

Each card shows:

- Date: **Today**, **Tomorrow**, or *{day} {month}, {weekday}, {time}*  
- Location (upcoming): 📍 name as external maps link  
- Badge if user registered: **You're in** or **Waitlist**  
- Optional game title  
- Stats:  
  - Upcoming in window: registered / max  
  - Upcoming outside window: total registered / max  
  - Past: paid count / total registered  
- Left border color: **yellow** = positions game; **green** = recreational  
- Seasonal decorations on card when tagged  

**Interaction:** Tap card → game details.

#### States

| State | UI |
|-------|-----|
| Initial load | Full-page spinner + **Loading…** |
| Reload | Inline spinner in list area |
| Error | **Error**, **Failed to load games**, **Retry** |
| Empty | **No games available** |

---

### 5.4 Game details (`/game/:gameId`)

**Purpose:** View one game; register, leave, guests, admin operations.

#### Header block

- Optional title  
- Date/time + location (maps link)  
- User badge: **You're in** / **Waitlist**  
- Price: **€X.XX per participant** (if cost > 0)  
- **Category info** (Thursday 5-1 or Sunday only): one-line summary + info icon → full category modal  
- **Seasonal banner** (if tagged): Halloween / New Year / March 8 themed message  
- **Readonly banner** if locked: *🔒 This game is readonly. Registration and deregistration are closed…*  
- **Payments collected by** (past game, after payment requests): avatar + name of collecting admin  

#### Admin icon toolbar (game admin only)

| Icon | Action |
|------|--------|
| Add participant | Toggle user search to add existing user |
| Edit | → Edit game settings |
| Delete | Confirm → delete upcoming game |
| Send payment requests | Password dialog → send to unpaid (past/readonly, Bunq on) |
| Check payments | Password dialog → refresh paid status |

#### Players area

- Header stats: upcoming `active / max (+waitlist)`; past `paid / active`  
- **Add guest** button (when rules allow)  
- Active players list: avatar, name, **You**, guest “Invited by …”, volleyball icon if bringing ball  
- **Waiting List** section (upcoming only)  
- Empty: **No players registered yet** / **Be the first to join this game!**  
- Info text footer (registration timing, leave deadline)  
- Processing overlay: **Processing…**

#### Primary action

| Context | Telegram | Web |
|---------|----------|-----|
| Can join | Main button **Join Game** | Button **Join Game** |
| Registered, can leave | Main button **Leave Game** | Button **Leave Game** |
| Readonly / past / blocked / closed | No button | No button |
| Busy | **Processing…** | **Processing…** |

**Join flow:** Bring-ball dialog → register API.  
**Leave flow:** Confirm **Leave Game** → unregister.

#### Participant row actions

- Self/guest remove (trash) when allowed  
- Waitlist: **Leave waitlist** always available  
- Admin on past/readonly: remove player; after payment requests, **Paid** / **Unpaid** toggle instead of remove  
- Tap row → Player info dialog (admin / TC)

#### States

| State | UI |
|-------|-----|
| Loading | Full-page spinner |
| Not found | **Error**, **Game not found**, **Back to Games** (web) |
| Load error | **Failed to load game details** |

---

### 5.5 Create game (`/games/new`)

**Purpose:** Schedule a new session.

| Field | Label | Constraints / notes |
|-------|-------|---------------------|
| Date/time | **Game Date & Time:** | Required; date-time picker |
| Capacity | **Maximum Players:** | 2–100 |
| Unregister deadline | **Unregister Deadline (hours before game):** | 0–48; help explains freeze |
| Pricing mode | Toggle | **Specify total game cost** ↔ **Specify game cost per participant** |
| Amount | **Cost per Participant (€):** or **Total Game Cost (€):** | Total mode shows live per-player preview |
| Location name | **Location name:** | Required |
| Maps URL | **Location link (Maps URL):** | Optional |
| Title | **Game Title (optional):** | Max 255 chars |
| Format | **Game format:** | Dropdown: Recreational / With positions |
| Readonly | **Readonly (close registration)** | Toggle + help |

**Actions:** **Cancel** (back), **Create Game** / **Creating…**

**States:** Loading defaults; optional error loading defaults; inline submit error.

**Defaults:** Server may suggest next date/time/location/price.

---

### 5.6 Edit game settings (`/game/:gameId/edit`)

Same fields as create.

| Element | Label |
|---------|-------|
| Title | **Edit Game Settings** |
| Save | **Save Changes** / **Saving…** |
| Cancel | Returns to game details without saving |

Metadata can be edited even on past games after payment requests; roster rules differ (see admin scenarios).

---

### 5.7 Players hub (`/players`)

**Purpose:** Admin menu for people management.

| Element | Content |
|---------|---------|
| Title | **Players** |
| Link | **Game administrators** |
| Link | **Player levels** |

**Access:** Global admin only. Others redirected.

---

### 5.8 Game administrators (`/game-administrators`)

**Purpose:** Define who runs which weekday/format.

#### List

| Element | Content |
|---------|---------|
| Empty | **No administrator assignments yet.** / **Create one to get started.** |
| Row | Avatar + name (→ player info), weekday badge, optional **5-1** badge |
| Icons | Bunq settings for that user |
| Delete | Confirm deletion |
| **Add Assignment** | Opens form |

#### Create form — **New Assignment**

| Field | Content |
|-------|---------|
| Day of week | Monday–Sunday |
| **5-1 positions game** | Checkbox |
| User | Search **Search for a user…** |
| Actions | **Cancel**, **Create** / **Creating…** |

**Validation:** Must select user.

---

### 5.9 Player levels (`/player-levels`)

**Purpose:** Assign internal skill tiers.

| Element | Content |
|---------|---------|
| Title | **Player levels** |
| Name filter | **Filter by name…** |
| Level filter | Multi-select: Unassigned, Advanced, Intermediate, Beginner (default all) |
| Row | Avatar, name, color **level pill** (if assigned), **Set by {name}** |
| Empty filter | **No players match your filter.** |
| Tap row | Player info dialog with **editable** level buttons |

**Sort order:** Unassigned → Advanced → Intermediate → Beginner; alphabetical within group.

**Access:** Global admin or TC. Others → home.

---

### 5.10 Bunq settings (`/bunq-settings` and `/bunq-settings/user/:id`)

**Purpose:** Connect Dutch Bunq bank API for payment requests.

| State | Content |
|-------|---------|
| Disabled | Explanation + **Enable Bunq Integration** |
| Enabled | Account selector, **Install Webhook**, **Update API Key**, **Disable Integration** (confirm) |
| Per-user variant | Shows assigned game administrator’s name in title |

**Enable form fields:** API Key, API Key Name (User-Agent label), Password (encryption).

**Monetary account selector:** Enter password → load accounts → pick account → saves immediately.

---

### 5.11 Check payments (`/check-payments`)

**Purpose:** Bulk reconcile all unpaid games.

On open: password dialog **Enter Bunq API Password** with explanation. Success shows alert with message and returns home. Invalid password keeps dialog open.

---

### 5.12 Browser header (authenticated web only)

| Element | Behavior |
|---------|----------|
| Brand **Haarlem Volley Bot** | Link to `/` |
| Display name | Click → edit display name dialog |
| **Logout** | Clears session; landing page |

---

## 6. Dialog and modal catalog

### 6.1 Edit display name (browser)

| Field | **Display name** |
| Actions | Cancel, Save |

### 6.2 Bring a ball (registration)

| Copy | **Will you bring a volleyball?** + encouragement (~1 ball per 4–5 players) |
| Actions | **No, I won't bring one**; **Yes, I'll bring one! 🏐** |
| Busy | **Registering...** |

### 6.3 Register guest

| Field | **Guest Name:** (max 255) |
| Admin past/readonly | **Invited by:** user search (required) |
| Expandable | **Guest invitation rules:** payment one request for host+guests; inform guests; separate spots/waitlist |
| Submit | **Register Guest** / **Registering...** |

### 6.4 Player details

**Title:** **Player details**

**Sections by viewer:**

| Section | Global admin | Assigned game admin | TC |
|---------|:------------:|:-------------------:|:--:|
| Avatar, name, Telegram ID/username, phone | Yes | Yes | Yes |
| Unpaid games + **Send payment reminder** | Yes | Yes | No |
| Player level (edit on player levels page only) | Yes | No | Yes |
| **Set by {name}** attribution | Yes | No | Yes |
| Block / Unblock | Yes | Yes | No |

Block uses system prompt for reason. Unblock confirms.

### 6.5 Password (Bunq operations)

Used for: install webhook, send payment requests, check payments (game or global).

| Field | Password |
| Actions | Cancel, Submit / **Processing...** |
| Error | Inline, e.g. **Invalid password** |

### 6.6 Category information (game details)

**Inline:** `{Thursday 5-1 | Sunday}: {short description}` + info icon.

**Modal:** Full category text including:

- Skill expectations (Thursday 5-1 vs Sunday social)  
- Registration freeze 5 hours before game  
- Payment within 24 hours after game; warnings and ban policy  
- Links to Telegram and WhatsApp community chats  

### 6.7 Confirmation popups (native-style)

Used for: leave game, unregister guest, remove player, mark paid/unpaid, delete game, disable Bunq, delete assignments.

Typical pattern: title, message, **Cancel** + destructive confirm.

### 6.8 Alert popups

| Scenario | Examples |
|----------|----------|
| Registration blocked | **Registration blocked** + reason (user block) |
| Guest blocked / timing | **Guest registration blocked** / **not available** |
| Telegram group required | **Cannot register** + optional **Join group** button |
| Payment batch done | **Payment requests sent** / **Payment check completed** |
| Errors | **Error** + message |

Fallback in browser without dialog provider: `window.confirm` / `alert`.

---

## 7. End-to-end scenarios

### 7.1 First-time participant (Telegram)

1. User opens club bot Mini App.  
2. Automatically authenticated.  
3. Lands on games home (Sunday filter default may hide Thursday games).  
4. Opens a Sunday recreational game in registration window.  
5. Taps **Join Game** → ball dialog → confirms.  
6. Sees **You're in** on details and home.  
7. After game, admin sends payment requests.  
8. User sees **Your unpaid games** on home → **Pay now**.

### 7.2 First-time participant (phone, web)

1. Opens site → **Welcome** → **Phone number**.  
2. Enters number → SMS code → enters name (unique) → home.  
3. Edits display name from header if needed.  
4. Same registration flow as Telegram (web button instead of main button).

### 7.3 Waitlist promotion

1. Game is full (active roster = max).  
2. Participant B joins → **Waitlist** badge.  
3. Participant A leaves before unregister deadline.  
4. B moves to active roster (order preserved).

### 7.4 Guest registration

1. Within 3 days of game; host eligible.  
2. **Add guest** → enter name → rules disclaimer available.  
3. Guest appears with inviter attribution.  
4. Host may unregister guest via trash + confirm.

### 7.5 Positions game with level restrictions enabled

1. Beginner: no join button; generic “cannot register” if timing would allow but level blocks.  
2. Intermediate >3 days out: info text with open date (*3 days before*).  
3. Advanced / unassigned: join when standard window open.  
4. Intermediate already on roster before restriction: keeps spot.

### 7.6 Readonly game

1. Admin enables readonly on create or edit.  
2. Participants see banner; no join/leave.  
3. Admin adds/removes players and guests (guests need inviter on past/readonly before payments).

### 7.7 Past game administration

1. Game datetime passes.  
2. Admin adds missing participant before payment requests.  
3. Admin sends payment requests (password).  
4. Roster shows Paid/Unpaid; remove disabled.  
5. **Check payments** syncs from Bunq.  
6. Admin edits title/location still allowed.

### 7.8 Blocked user

1. Admin opens player info → **Block** → enters reason.  
2. User attempts join → popup with reason.  
3. Admin **Unblock** restores access.

### 7.9 Assigned game administrator

1. Global admin creates assignment: Thursday + 5-1 + user.  
2. Assigned admin sees **Create game** but not Players/Bunq.  
3. Creates Thursday positions game successfully.  
4. Attempting Wednesday game → forbidden.  
5. Can manage that game’s roster and payments like global admin for that game only.

### 7.10 Technical Committee workflow

1. TC logs in (TC flag set externally).  
2. **Manage player levels** on home → filters list → assigns **Intermediate** on player levels page.  
3. Opens game details → taps player → sees level read-only.  
4. Cannot open `/players` or game administrators (redirect).

### 7.11 Bunq setup (global admin)

1. **Bunq Settings** → enable with API credentials.  
2. Select monetary account.  
3. Install webhook (password).  
4. After a past game, send payment requests from game details.  
5. Participant pays via link; admin checks payments.

### 7.12 Deep link to game

1. User opens bot with `start=game_123`.  
2. After auth, app navigates to `/game/123`.

### 7.13 Unpaid games gate on home

1. User has unpaid items and opens app on upcoming view.  
2. Sees unpaid block first; main list hidden until **Show upcoming games**.

### 7.14 Seasonal game

1. Game has tag Halloween / New Year / March 8.  
2. Card and details show themed visuals + short festive note.  
3. Registration behavior unchanged.

---

## 8. Business rules reference

### 8.1 Registration eligibility (participant)

Must pass all:

- Authenticated, not blocked  
- Telegram users: in required Telegram group  
- Game exists, not readonly (for self-serve)  
- Inside registration window (format- and level-aware)  
- Not already registered (for join)  
- Capacity or waitlist available  
- For guests: host eligible, guest window open, guest name valid  

### 8.2 Leave eligibility

- Waitlist: always  
- Active roster: until unregister deadline hours before start  

### 8.3 Roster capacity

- Active spots capped at `maxPlayers`  
- Additional registrations → waitlist ordered by creation time  
- Leaving active spot promotes earliest waitlist  

### 8.4 Admin roster changes

| Game phase | Add participant | Remove | Guest add |
|------------|-----------------|--------|-----------|
| Upcoming, open | Not via admin search (use normal registration) | — | Self-serve if allowed |
| Upcoming, readonly | Yes | Yes | Admin + inviter if past/readonly rules |
| Past, no payment requests | Yes | Yes | Admin + inviter |
| Past, payment requests sent | No new adds | No remove; Paid/Unpaid only | No new guests |

### 8.5 Game deletion

- Only **upcoming** games  
- Game admin confirms deletion  
- Navigates away after success  

### 8.6 Display and filtering

- **Categories** filter upcoming list client-side after fetch  
- **Past/upcoming** and **show all** alter API query (admin/assigned admin)  
- Game list card border colors encode positions vs non-positions  
- Stats on cards depend on past vs upcoming and readonly  

### 8.7 Notifications (out of app UI, product behavior)

The system sends Telegram/SMS messages for scenarios including:

- Registration opening soon (recreational games in a narrow window)  
- Reminder ~24h before game with unregister deadline  
- Payment request links after admin action  
- Payment reminders from admin  

Exact copy and channels are backend concerns; the app triggers payment request and reminder **actions** only.

---

## 9. Visual design notes

### 9.1 Theming

- Respects Telegram light/dark in Mini App  
- Browser uses CSS variables aligned with Telegram theme colors where possible  

### 9.2 Seasonal tags

| Tag | Card/detail treatment |
|-----|----------------------|
| Halloween | Orange theme, leaves, pumpkins; banner about spooky evening |
| New Year | Snow, tree, gifts; festive banner |
| March 8 | Flowers, petals; spring banner |

Tags are assigned in data (not in create/edit form in current product).

### 9.3 Level pills (admin only)

| Level | Pill color |
|-------|------------|
| Advanced | Light green |
| Intermediate | Light yellow |
| Beginner | Light red |
| Unassigned | No pill; label “Unassigned” in dialog/list |

---

## 10. Content and copy inventory (key strings)

Product should implement these user-visible strings consistently:

- Landing: **Welcome**, **Choose how you want to continue:**, **Telegram**, **Phone number**, **How it works**  
- Auth: **Phone number**, **Continue**, **Enter code**, **Resend code**, **Your display name**, **Name is available**, **This name is already taken**  
- Home: **Your unpaid games**, **Pay now**, **Show upcoming games**, **Upcoming**, **Past**, **No games available**, **You're in**, **Waitlist**  
- Game: **Join Game**, **Leave Game**, **Add guest**, **Register guest**, **Waiting List**, **You're in**, readonly banner, **€{amount} per participant**  
- Admin: **Create New Game**, **Edit Game Settings**, **Add Participant**, **Send payment requests…**, **Check payment status…**  
- Players: **Players**, **Game administrators**, **Player levels**  
- Bunq: **Bunq Settings**, **Enable Bunq Integration**, **Install Webhook**  

Category modal contains long-form English community rules (see Category Information dialog).

---

## 11. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Availability | Graceful error states with retry on games home |
| Session | Secure HTTP-only cookies for web; Telegram init validation for Mini App |
| Fresh deploy | Client reloads when server build timestamp changes |
| Accessibility | Buttons with titles/aria-labels on icon actions; keyboard Escape on modals |
| Privacy | Player levels never shown to non-admin/TC viewers |
| Locale | Dates/times formatted for en-GB style in UI; community content in English |
| Performance | Player levels list loads all users once (~300) then filters client-side |

---

## 12. Out of scope (current product)

- In-app TC or global admin promotion UI  
- Public game browsing without login  
- Real-time chat between participants  
- Court diagram / position assignment per player on screen  
- Refunds and partial payments UI beyond paid/unpaid toggle  
- Multi-language UI  
- Native iOS/Android apps outside Telegram  
- Automated second-field booking when Sunday game exceeds 22 players (described in category text as manual organizer action)  

---

## 13. Assumptions and dependencies

- Organizers have a Bunq business account if using integrated payments  
- Telegram bot and Mini App URL are configured in hosting environment  
- Club maintains Telegram group membership for Telegram-first registration policy  
- PostgreSQL (or equivalent) holds users, games, registrations, assignments, levels, payment state  
- SMS provider (e.g. Twilio) for phone verification in production  
- Operators may run with **level restrictions disabled** until community is ready  

---

## 14. Appendix A — Route access control

| Route | Participant | Assigned admin | TC only | Global admin |
|-------|:-----------:|:--------------:|:-------:|:------------:|
| `/` | ✓ | ✓ | ✓ | ✓ |
| `/game/:id` | ✓ | ✓ | ✓ | ✓ |
| `/games/new` | ✗ | ✓* | ✗ | ✓ |
| `/game/:id/edit` | ✗ | ✓* | ✗ | ✓ |
| `/players` | ✗ | ✗ | ✗ | ✓ |
| `/game-administrators` | ✗ | ✗ | ✗ | ✓ |
| `/player-levels` | ✗ | ✗ | ✓ | ✓ |
| `/bunq-settings` | ✗** | ✗** | ✗** | ✓** |

\*Only for games matching their assignment (create/edit enforced server-side).  
\**No hard client guard; intended for global admin use.

---

## 15. Appendix B — Game format decision guide

| Need | Choose |
|------|--------|
| Casual Sunday-style session | Recreational |
| Thursday 5-1 competitive with positions | Positions |

Only one format per game (recreational or positions). Positions games on Thursday with `positions` format show as category **Thursday 5-1**. Sunday recreational shows as **Sunday**.

---

## 16. Appendix C — Related documents

- `CONTEXT.md` — domain glossary (authoritative terms)  
- `docs/prd/player-levels-and-game-format.md` — focused PRD for levels, formats, TC role  
- `docs/playwright-e2e-scenarios.md` — automated acceptance scenario catalog  

---

*This PRD describes the target product for a rebuild of Haarlem Volley Bot / Volley Game Central. When building, treat server-enforced rules as source of truth; UI should mirror eligibility without exposing internal player levels to participants.*
