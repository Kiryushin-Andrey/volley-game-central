# Playwright E2E Scenario Checklist

Purpose: define the automated end-to-end scenario set for the application using Playwright.

Scope: browser-based tests for the Telegram Mini App running locally in dev mode, including Bunq payment integration (configuration, payment requests, and payment status tracking for past games).

**Status:** `[x]` = implemented in `e2e/` (scenario ID matches the test name prefix, e.g. `E2E-HOME-001` in `e2e/games-home.spec.ts`). `[ ]` = planned, not yet automated.

## Test environment assumptions

- Run the app with dev mode enabled, for example `DEV_MODE=true npm run dev` or `npm run dev:local`, or the Playwright stack via `scripts/playwright-dev-server.sh` (starts backend, mini app, and `bunq-mock`).
- Target the frontend at `http://127.0.0.1:3001`; the Vite proxy forwards `/api` requests to the backend.
- For Bunq scenarios, point the backend at the local mock: `BUNQ_API_URL=http://127.0.0.1:3998/v1` (default in the Playwright dev server script). Reset mock state between tests with the bunq-mock control `POST /reset` (see `e2e/support/fixtures.ts` `resetBunqMock`).
- Use a fixed Bunq encryption password in tests (for example `BunqE2E!Pass9`) and a mock API key such as `e2e-bunq-api-key` with API key name `E2E Bunq Client`.
- Use the visible dev-mode phone login flow instead of Telegram auth:
  - Open the landing page.
  - Choose `Phone number`.
  - Enter a local Dutch phone number after the fixed `+31` prefix.
  - Enter a display name.
  - Toggle `Administrator` only for personas that need global admin rights.
  - Submit `Dev Login`.
- Use isolated browser contexts for each persona so cookies do not leak between tests.
- **Implementation rule:** Do not use direct database access or direct HTTP calls to the **application** (including Playwright `request` fixtures against `/api`) to perform setup or actions that a real user or administrator could complete through the visible UI. Use the UI instead. Exceptions are allowed only when no in-app UI exists:
  - dev-only login bootstrap or wiping `E2E %` rows between tests in `cleanupE2eData`;
  - **bunq-mock control plane** (`http://127.0.0.1:3999`) to reset mock state or deliver external Bunq webhooks (simulates Bunq notifying the app; there is no mini-app screen for this).

## Dev login personas

Use unique phone numbers per test run when tests create mutable state.

- Participant A: non-admin user for normal registration and profile flows.
- Participant B: non-admin user for capacity, waitlist, and multi-user scenarios.
- Global Admin: dev login with `Administrator` checked.
- Assigned Admin: non-admin user who becomes a game administrator through an assignment created by Global Admin.

## Out of scope for this checklist

- Real Bunq production or sandbox credentials; all payment flows use `bunq-mock`.
- Telegram-native auth flows (tests use dev phone login).
- SMS/Telegram delivery of payment request links to participants (outbound messaging is not exercised in the browser).

## Authentication and session scenarios

Spec: `e2e/auth-session.spec.ts`

- [x] E2E-AUTH-001: Unauthenticated visitor sees the landing page with `Welcome`, `Telegram`, `Phone number`, and `How it works`.
- [x] E2E-AUTH-002: Visitor expands `How it works` and sees the community, registration, notification, cost-sharing explanation, and GitHub source link.
- [x] E2E-AUTH-003: Participant A logs in through dev mode with phone number and display name, then lands on the authenticated games home.
- [x] E2E-AUTH-004: Global Admin logs in through dev mode with the `Administrator` checkbox selected and sees admin controls on the games home.
- [x] E2E-AUTH-005: Two isolated Playwright browser contexts can log in as different users and keep separate displayed names and sessions.
- [x] E2E-AUTH-006: Browser-mode header displays the authenticated user's display name, opens the edit display name dialog, saves a new name, and reflects it in the header.
- [x] E2E-AUTH-007: Authenticated user logs out and returns to the unauthenticated landing page.
- [x] E2E-AUTH-008: Dev login prevents submit until both phone number and display name are provided.

## Games home scenarios

Spec: `e2e/games-home.spec.ts`

- [x] E2E-HOME-001: Participant A loads the games home and sees upcoming games or the `No games available` empty state.
- [x] E2E-HOME-002: Participant A opens a game card and reaches the matching game details page.
- [x] E2E-HOME-003: Participant A uses the category multi-select on upcoming games and sees the selected category info block.
- [x] E2E-HOME-004: A registered participant sees the `You're in` badge for an active registration on the games home.
- [x] E2E-HOME-005: A waitlisted participant sees the `Waitlist` badge for a waitlist registration on the games home.
- [x] E2E-HOME-006: A game card with a location opens an external maps link without navigating away from the app route.
- [x] E2E-HOME-007: Global Admin switches between `Upcoming` and `Past` filters.
- [x] E2E-HOME-008: Global Admin toggles `Show all scheduled games` for upcoming games and sees games outside the default registration window.
- [x] E2E-HOME-009: Global Admin switches to past games and toggles `Show fully paid games`.
- [x] E2E-HOME-010: Global Admin sees `Players` and `Create New Game` controls for non-integration admin access.
- [x] E2E-HOME-011: Assigned Admin sees `Create New Game` access without global-only administration links.
- [x] E2E-HOME-012: Home error state shows `Error` and `Retry` when the games API fails, then recovers after retry.
- [x] E2E-HOME-013: With default category filter (Sunday), participant sees `No games available` when the only upcoming game is a Thursday 5-1 game.
- [x] E2E-HOME-014: Participant deselects all category options in the multi-select and sees `No games available` even when games exist for other categories.
- [x] E2E-HOME-015: Participant A with an unpaid past game (after admin sent payment requests) sees `Your unpaid games` on the upcoming home view, opens the entry, and **Pay now** opens the Bunq payment link in a new browser tab (or window).
- [x] E2E-HOME-016: Games home cards use a yellow left border for 5-1 games and a green left border for non-5-1 games.
- [x] E2E-HOME-017: Category info blocks on the games home use yellow background for 5-1 and green for other selected categories.

## Player levels admin scenarios

Spec: `e2e/player-levels.spec.ts`

Global administrators manage internal skill tiers via the **Players** hub (`/players`); non-admins must not reach these routes.

- [x] E2E-LEVELS-001: Global Admin opens **Players** from the games home toolbar, sees the hub, and navigates to **Player levels**.
- [x] E2E-LEVELS-002: Global Admin filters the list, opens a player row, assigns **Intermediate** in the player details dialog, and sees the level pill on the list.
- [x] E2E-LEVELS-003: Participant is redirected to games home when visiting `/players` or `/player-levels`.
- [x] E2E-LEVELS-004: Assigned Admin (non-global) does not see the **Players** toolbar icon.

## Game details participant scenarios

Spec: `e2e/game-details-participant.spec.ts`

- [x] E2E-GAME-001: Participant A opens an upcoming game and sees date, optional title, location, capacity, price display when configured, players list, and registration action.
- [x] E2E-GAME-002: Participant A joins an open upcoming game and sees `You're in` on details and on the games home.
- [x] E2E-GAME-003: Participant A leaves a joined game before the unregister deadline and no longer sees `You're in`.
- [x] E2E-GAME-004: Participant B joins a full game and lands on the waiting list with the `Waitlist` status.
- [x] E2E-GAME-005: Participant A leaves a full game and the next waitlisted participant moves into the active players list.
- [x] E2E-GAME-006: Participant A sees the readonly notice and cannot join or leave when a game is marked readonly.
- [x] E2E-GAME-007: Participant A sees deadline or registration-closed info text when the unregister deadline has passed, and the Leave Game action is not available.
- [x] E2E-GAME-008: Participant A opens a non-existent game id and sees `Error`, `Game not found`, and `Back to Games`.
- [x] E2E-GAME-009: Participant A registers a guest when guest registration is allowed and sees the guest in the players list.
- [x] E2E-GAME-010: Participant A opens and completes the bring-ball dialog when the game state requires ball assignment.
- [x] E2E-GAME-011: Participant A sees seasonal game theming for Halloween, New Year, and March 8 tagged games without breaking core registration actions.
- [x] E2E-GAME-012: Global Admin opens a past game that had waitlisted players and sees only the main players list (no waiting list section or waitlisted names).
- [x] E2E-GAME-013: Participant A opens a Thursday 5-1 game and sees the category notice with 5-1 (yellow) styling on game details.

## Registration window scenarios

Spec: `e2e/registration-windows-guests-blocked.spec.ts`

- [x] E2E-WIN-001: Participant sees `Registration opens` (10 days before the game) and cannot join when the game is outside the registration window.
- [x] E2E-WIN-002: Participant can join when registration is open but **Add guest** is hidden before the guest registration window.

## Blocked user scenarios

Spec: `e2e/registration-windows-guests-blocked.spec.ts`

- [x] E2E-BLOCK-001: Global Admin blocks a user from player details with a reason; the blocked user cannot join a game or add a guest and sees the block reason in the dialog.

## Guest registration scenarios

Spec: `e2e/registration-windows-guests-blocked.spec.ts`

- [x] E2E-GUEST-001: Participant unregisters their own guest from the players list via the unregister-guest control and confirmation dialog.
- [x] E2E-GUEST-002: Global Admin adds a guest on a readonly game using **Invited by** inviter search; the guest appears with inviter attribution in the players list.

## Game creation and editing scenarios

Spec: `e2e/game-form.spec.ts`

- [x] E2E-FORM-001: Global Admin opens `Create New Game` from the games home.
- [x] E2E-FORM-002: Global Admin creates a standard game with date/time, maximum players, unregister deadline, per-participant cost, location name, optional location link, and optional title.
- [x] E2E-FORM-003: Global Admin creates a game with total-cost pricing and sees the per-participant preview update as maximum players changes.
- [x] E2E-FORM-004: Global Admin creates a positions-format game via the game format select (`With positions`) and verifies the selection persists on edit.
- [x] E2E-FORM-005: Global Admin creates a readonly game and verifies regular participants cannot self-register.
- [x] E2E-FORM-006: Global Admin cancels game creation and returns without creating a game.
- [x] E2E-FORM-007: Global Admin opens `Edit Game Settings` from game details, updates title/location/capacity/deadline/toggles, saves, and sees the updated details.
- [x] E2E-FORM-008: Global Admin cancels editing and returns to game details without persisting changes.
- [x] E2E-FORM-009: Required fields and numeric bounds prevent invalid game creation, including missing date, maximum players below minimum, and negative cost.
- [x] E2E-FORM-010: On a past game after payment requests were sent, Global Admin still opens **Edit Game Settings**, changes a field such as title, saves, and sees the update on game details (participant roster lock does not block metadata edits).
- [x] E2E-FORM-011: Global Admin creates a saved total-cost game and sees the calculated per-participant price on game details.
- [x] E2E-FORM-012: Global Admin edits a total-cost game and sees the per-participant preview update when maximum players changes.

## Game administration scenarios

Spec: `e2e/game-administration.spec.ts`

- [x] E2E-ADMIN-001: Global Admin deletes an upcoming game from game details after confirming the browser prompt.
- [x] E2E-ADMIN-002: Global Admin cancels the delete confirmation and the game remains available.
- [x] E2E-ADMIN-003: Global Admin adds an existing user to a readonly game and to a past game via **Add Participant** and `Search users to add...`.
- [x] E2E-ADMIN-004: Global Admin removes a player from a readonly game and the players list updates.
- [x] E2E-ADMIN-005: Global Admin opens player info from a player row and sees the selected user's display name.
- [x] E2E-ADMIN-006: Assigned Admin can manage games for their assigned day/type, including creating a game and reaching permitted admin actions.
- [x] E2E-ADMIN-007: Assigned Admin cannot access global-only routes such as game administrator assignment management.
- [x] E2E-ADMIN-008: Non-admin Participant A cannot reach create/edit/admin-only screens by direct URL and is redirected or blocked.
- [x] E2E-ADMIN-009: Assigned Admin receives a 403 error when creating a game on a weekday outside their assignment.
- [x] E2E-ADMIN-010: Assigned Admin receives a 403 error when saving edits to a game outside their assignment.
- [x] E2E-ADMIN-011: On a past paid game (Bunq enabled, Participant A registered): Global Admin adds Participant B via **Add Participant** before payment requests; sends payment requests; **Add Participant** is then unavailable while B remains on the roster.
- [x] E2E-ADMIN-012: On a past or readonly game: Global Admin removes a player before payment requests; after sending payment requests, **Remove player** is unavailable and active rows show **Paid** / **Unpaid** controls instead.
- [x] E2E-ADMIN-013: Global Admin opens player info for a user with outstanding payment requests, sees `Unpaid games` listing the game, and **Send payment reminder** completes with UI success feedback (do not assert SMS/Telegram delivery).
- [x] E2E-ADMIN-014: On a readonly past game with cost (Bunq enabled): before payment requests, **Add guest** with `Invited by` / inviter search adds a guest; after payment requests are sent, inviter search is absent and **Add guest** cannot add new entries (readonly or registration-closed error in the dialog).
- [x] E2E-ADMIN-015: Global Admin cannot add or remove players on an upcoming open game (before it is readonly or past).

## Game rules and display scenarios

Spec: `e2e/game-rules-and-display.spec.ts`

Covers roster rules on open upcoming games, past-game waitlist visibility, total-cost pricing display, and 5-1 vs non-5-1 visual styling. Scenario IDs for these tests are listed in the sections above (`ADMIN-015`, `GAME-012`–`013`, `FORM-011`–`012`, `HOME-016`–`017`).

## Game administrator assignment scenarios

Spec: `e2e/game-administrators-assignment.spec.ts`

- [x] E2E-ASSIGN-001: Global Admin opens `Game Administrators` and sees existing assignments or the empty state.
- [x] E2E-ASSIGN-002: Global Admin opens `Add Assignment`, selects day of week, toggles `5-1 positions game`, selects Assigned Admin through user search, and creates the assignment. *(Covered in the same test as ASSIGN-003.)*
- [x] E2E-ASSIGN-003: Newly assigned admin appears in the assignments list with day and optional `5-1` badge. *(Covered in the same test as ASSIGN-002.)*
- [x] E2E-ASSIGN-004: Global Admin opens player info from an administrator assignment row.
- [x] E2E-ASSIGN-005: Global Admin deletes an assignment after confirming the browser prompt.
- [x] E2E-ASSIGN-006: Global Admin cancels assignment deletion and the assignment remains.
- [x] E2E-ASSIGN-007: Non-admin Participant A is redirected away from `/game-administrators`.

## Cross-user and state-transition scenarios

Spec: `e2e/cross-user-state.spec.ts`

- [x] E2E-STATE-001: Global Admin creates a game, Participant A joins it in a separate context, and Global Admin sees Participant A in the players list after refresh.
- [x] E2E-STATE-002: Participant A and Participant B compete for the last available spot; one becomes active and the other becomes waitlisted deterministically.
- [x] E2E-STATE-003: Global Admin edits game capacity downward and the UI preserves valid active/waitlist status for existing registrations.
- [x] E2E-STATE-004: Browser refresh keeps the authenticated session and current route for each logged-in persona.
- [x] E2E-STATE-005: Opening the app in a new browser context without cookies starts unauthenticated.

## Bunq webhook and payment status (implemented)

Spec: `e2e/bunq-webhook.spec.ts`

- [x] E2E-BUNQ-001: Admin enables Bunq via settings UI, moves game to the past, sends payment requests; bunq-mock delivers `REQUEST_INQUIRY_ACCEPTED` for the participant's inquiry (control plane); after reload the player row shows `Paid`.

## Bunq integration configuration scenarios

Spec: `e2e/bunq-config.spec.ts`

Routes: `/bunq-settings` (global admin’s own credentials), `/bunq-settings/user/:assignedUserId` (global admin configuring an assigned game administrator’s credentials). Entry points: games home **Bunq Settings** cog (`title="Bunq Settings"`), or **Configure Bunq Settings** on a row in `Game Administrators`.

- [x] E2E-BUNQ-CONFIG-001: Global Admin opens Bunq Settings from the games home and sees `Bunq Settings`, loading complete, and status text `Bunq integration is disabled`.
- [x] E2E-BUNQ-CONFIG-002: Global Admin clicks `Enable Bunq Integration`, sees `Specify Bunq API Credentials` with API Key, API Key Name, and Password fields, and cannot submit until all three are filled.
- [x] E2E-BUNQ-CONFIG-003: Global Admin submits valid mock credentials (`Enable Integration`) and sees `Bunq integration enabled successfully` and status `Bunq integration is enabled`.
- [x] E2E-BUNQ-CONFIG-004: With integration enabled, Global Admin uses `Choose account to receive payments to`, enters the Bunq password, clicks `Load Accounts`, selects a monetary account, and sees success feedback.
- [x] E2E-BUNQ-CONFIG-005: Global Admin clicks `Install Webhook`, enters the Bunq password in `Install Bunq Webhook`, submits, and sees success feedback without leaving the settings page.
- [x] E2E-BUNQ-CONFIG-006: Global Admin opens `Update API Key`, cancels via `Cancel`, and returns to the enabled settings view without changing status.
- [x] E2E-BUNQ-CONFIG-007: Global Admin disables integration: `Disable Integration` → confirm prompt → `Bunq integration disabled successfully` and status returns to disabled.
- [x] E2E-BUNQ-CONFIG-008: Global Admin cancels disable at the confirmation prompt and integration remains enabled.
- [x] E2E-BUNQ-CONFIG-009: Global Admin opens `Game Administrators`, uses **Configure Bunq Settings** for Assigned Admin, sees `Bunq Settings (<display name>)`, and completes enable flow for that user.
- [x] E2E-BUNQ-CONFIG-010: Participant A navigates to `/bunq-settings` and is redirected away or blocked from managing Bunq credentials.
- [x] E2E-BUNQ-CONFIG-011: Wrong Bunq password on monetary account load or webhook install shows an inline error and keeps the user on the relevant form/dialog.

## Bunq payment request scenarios

Spec: `e2e/bunq-pay.spec.ts`

Past or readonly games with `paymentAmount > 0`, Bunq enabled for the collecting admin, and no `fullyPaid` flag show **Send payment requests** (`title="Send payment requests to unpaid players"`). Prepare games via UI: create with cost, register players, then move date to the past through **Edit Game Settings** (do not set dates via DB).

- [x] E2E-BUNQ-PAY-001: Global Admin with Bunq enabled opens a past paid game and sees the send-payment-requests control; an upcoming game with the same cost does not show it.
- [x] E2E-BUNQ-PAY-002: Global Admin sends payment requests: password dialog → popup `Payment requests sent` → `Payments collected by` with admin display name, active players show `Unpaid` (or `Paid` if settled), and roster add/remove controls are locked as in E2E-ADMIN-011 and E2E-ADMIN-012.
- [x] E2E-BUNQ-PAY-003: After payment requests were sent for all unpaid active players, **Send payment requests** is hidden or a second send via UI reports zero new requests created.
- [x] E2E-BUNQ-PAY-004: Invalid Bunq password on send keeps the password dialog open with `Invalid password` and does not show the success popup.
- [x] E2E-BUNQ-PAY-005: Assigned Admin with their own Bunq configured (via CONFIG-009) can send payment requests on a past game they administer; Participant A does not see send-payment controls on the same game.
- [x] E2E-BUNQ-PAY-006: Readonly past game with cost and registrations follows the same send-payment-requests flow as a normal past game.
- [x] E2E-BUNQ-PAY-007: Game with zero cost does not show send-payment-requests even when past and Bunq is enabled.
- [x] E2E-BUNQ-PAY-008: Past game already marked fully paid on the games home does not show send-payment-requests on game details (`fully_paid` set via allowed DB helper in test).

## Bunq payment status scenarios

Spec: `e2e/bunq-status.spec.ts`

Status surfaces: per-player `Paid` / `Unpaid` on game details (past/readonly, after requests sent), **Check payment status for this game** sync button on game details, paid/total counters on past game cards, and `Show fully paid games` on the past filter. Optional bulk route: `/check-payments` (password dialog on load; no in-app nav link today—use only if testing that screen explicitly).

- [x] E2E-BUNQ-STATUS-002: Global Admin clicks **Check payment status for this game**, enters the Bunq password, sees `Payment check completed`, and unpaid players update to `Paid` when the mock reports inquiry status `ACCEPTED`.
- [x] E2E-BUNQ-STATUS-003: Global Admin toggles a player from `Unpaid` to `Paid` and back via the paid-status control on the player row; counts on the games home past list update after refresh.
- [x] E2E-BUNQ-STATUS-004: When all active players are paid, the past game card shows matching paid/total counts (e.g. `2/2`); with `Show fully paid games` unchecked, the game is hidden from the past list until the toggle is enabled (extends HOME-009 with Bunq-driven fully-paid state via UI).
- [x] E2E-BUNQ-STATUS-005: Wrong password on per-game check keeps the password dialog open with `Invalid password`.
- [x] E2E-BUNQ-STATUS-006: Global Admin opens `/check-payments`, submits password on `Enter Bunq API Password`, sees completion feedback, and returns to games home; past unpaid games reflect updated statuses where the mock reports payment accepted.
- [x] E2E-BUNQ-STATUS-007: Participant A on a past game they joined does not see admin paid-status toggles or check-payment/sync controls; they may still see price and their own registration state.
