# Playwright E2E Scenario Checklist

Purpose: define the first automated end-to-end scenario set for the application using Playwright.

Scope: browser-based tests for the Telegram Mini App running locally in dev mode. Bunq integration features are intentionally excluded for now.

## Test environment assumptions

- Run the app with dev mode enabled, for example `DEV_MODE=true npm run dev` or `npm run dev:local`.
- Target the frontend at `http://127.0.0.1:3001`; the Vite proxy forwards `/api` requests to the backend.
- Use the visible dev-mode phone login flow instead of Telegram auth:
  - Open the landing page.
  - Choose `Phone number`.
  - Enter a local Dutch phone number after the fixed `+31` prefix.
  - Enter a display name.
  - Toggle `Administrator` only for personas that need global admin rights.
  - Submit `Dev Login`.
- Use isolated browser contexts for each persona so cookies do not leak between tests.
- Prefer deterministic setup through backend APIs or database fixtures before each scenario. UI assertions should still cover the browser flow under test.

## Dev login personas

Use unique phone numbers per test run when tests create mutable state.

- Participant A: non-admin user for normal registration and profile flows.
- Participant B: non-admin user for capacity, waitlist, priority-player, and multi-user scenarios.
- Global Admin: dev login with `Administrator` checked.
- Assigned Admin: non-admin user who becomes a game administrator through an assignment created by Global Admin.
- Priority Player: non-admin user added to an assignment's priority-player list.

## Out of scope for this checklist

Do not automate these scenarios yet:

- `/bunq-settings`
- `/bunq-settings/user/:assignedUserId`
- `/check-payments`
- Game details actions that send payment requests.
- Game details actions that check payment status through Bunq.
- Bunq credential setup, Bunq password dialogs, or Bunq-backed payment reconciliation.

Payment amount display and non-Bunq paid-state UI can be covered only when the scenario does not depend on Bunq APIs.

## Authentication and session scenarios

- [ ] E2E-AUTH-001: Unauthenticated visitor sees the landing page with `Welcome`, `Telegram`, `Phone number`, and `How it works`.
- [ ] E2E-AUTH-002: Visitor expands `How it works` and sees the community, registration, notification, cost-sharing explanation, and GitHub source link.
- [ ] E2E-AUTH-003: Participant A logs in through dev mode with phone number and display name, then lands on the authenticated games home.
- [ ] E2E-AUTH-004: Global Admin logs in through dev mode with the `Administrator` checkbox selected and sees admin controls on the games home.
- [ ] E2E-AUTH-005: Two isolated Playwright browser contexts can log in as different users and keep separate displayed names and sessions.
- [ ] E2E-AUTH-006: Browser-mode header displays the authenticated user's display name, opens the edit display name dialog, saves a new name, and reflects it in the header.
- [ ] E2E-AUTH-007: Authenticated user logs out and returns to the unauthenticated landing page.
- [ ] E2E-AUTH-008: Dev login prevents submit until both phone number and display name are provided.

## Games home scenarios

- [ ] E2E-HOME-001: Participant A loads the games home and sees upcoming games or the `No games available` empty state.
- [ ] E2E-HOME-002: Participant A opens a game card and reaches the matching game details page.
- [ ] E2E-HOME-003: Participant A uses the category multi-select on upcoming games and sees the selected category info block.
- [ ] E2E-HOME-004: A registered participant sees the `You're in` badge for an active registration on the games home.
- [ ] E2E-HOME-005: A waitlisted participant sees the `Waitlist` badge for a waitlist registration on the games home.
- [ ] E2E-HOME-006: A game card with a location opens an external maps link without navigating away from the app route.
- [ ] E2E-HOME-007: Global Admin switches between `Upcoming` and `Past` filters.
- [ ] E2E-HOME-008: Global Admin toggles `Show all scheduled games` for upcoming games and sees games outside the default registration window.
- [ ] E2E-HOME-009: Global Admin switches to past games and toggles `Show fully paid games`.
- [ ] E2E-HOME-010: Global Admin sees `Game Administrators` and `Create New Game` controls for non-integration admin access.
- [ ] E2E-HOME-011: Assigned Admin sees `Create New Game` access without global-only administration links.
- [ ] E2E-HOME-012: Home error state shows `Error` and `Retry` when the games API fails, then recovers after retry.

## Game details participant scenarios

- [ ] E2E-GAME-001: Participant A opens an upcoming game and sees date, optional title, location, capacity, price display when configured, players list, and registration action.
- [ ] E2E-GAME-002: Participant A joins an open upcoming game and sees `You're in` on details and on the games home.
- [ ] E2E-GAME-003: Participant A leaves a joined game before the unregister deadline and no longer sees `You're in`.
- [ ] E2E-GAME-004: Participant B joins a full game and lands on the waiting list with the `Waitlist` status.
- [ ] E2E-GAME-005: Participant A leaves a full game and the next waitlisted participant moves into the active players list.
- [ ] E2E-GAME-006: Participant A sees the readonly notice and cannot join or leave when a game is marked readonly.
- [ ] E2E-GAME-007: Participant A sees deadline or registration-closed info text when the unregister deadline has passed.
- [ ] E2E-GAME-008: Participant A opens a non-existent game id and sees `Error`, `Game not found`, and `Back to Games`.
- [ ] E2E-GAME-009: Participant A registers a guest when guest registration is allowed and sees the guest in the players list.
- [ ] E2E-GAME-010: Participant A opens and completes the bring-ball dialog when the game state requires ball assignment.
- [ ] E2E-GAME-011: Participant A sees seasonal game theming for Halloween, New Year, and March 8 tagged games without breaking core registration actions.

## Game creation and editing scenarios

- [ ] E2E-FORM-001: Global Admin opens `Create New Game` from the games home.
- [ ] E2E-FORM-002: Global Admin creates a standard game with date/time, maximum players, unregister deadline, per-participant cost, location name, optional location link, and optional title.
- [ ] E2E-FORM-003: Global Admin creates a game with total-cost pricing and sees the per-participant preview update as maximum players changes.
- [ ] E2E-FORM-004: Global Admin creates a game with `Playing 5-1` enabled and verifies it appears in the appropriate games list/category behavior.
- [ ] E2E-FORM-005: Global Admin creates a game with `With priority players` enabled for a day/type that has priority players configured.
- [ ] E2E-FORM-006: Global Admin creates a readonly game and verifies regular participants cannot self-register.
- [ ] E2E-FORM-007: Global Admin cancels game creation and returns without creating a game.
- [ ] E2E-FORM-008: Global Admin opens `Edit Game Settings` from game details, updates title/location/capacity/deadline/toggles, saves, and sees the updated details.
- [ ] E2E-FORM-009: Global Admin cancels editing and returns to game details without persisting changes.
- [ ] E2E-FORM-010: Required fields and numeric bounds prevent invalid game creation, including missing date, maximum players below minimum, and negative cost.

## Game administration scenarios

- [ ] E2E-ADMIN-001: Global Admin deletes an upcoming game from game details after confirming the browser prompt.
- [ ] E2E-ADMIN-002: Global Admin cancels the delete confirmation and the game remains available.
- [ ] E2E-ADMIN-003: Global Admin adds an existing user to a readonly or past game through the `Search users to add...` admin flow.
- [ ] E2E-ADMIN-004: Global Admin removes a player from a game and the players list updates.
- [ ] E2E-ADMIN-005: Global Admin removes a waitlisted player and the waiting list updates.
- [ ] E2E-ADMIN-006: Global Admin opens player info from a player row and sees the selected user's public information.
- [ ] E2E-ADMIN-007: Assigned Admin can manage games for their assigned day/type, including creating a game and reaching permitted admin actions.
- [ ] E2E-ADMIN-008: Assigned Admin cannot access global-only routes such as game administrator assignment management.
- [ ] E2E-ADMIN-009: Non-admin Participant A cannot reach create/edit/admin-only screens by direct URL and is redirected or blocked.

## Game administrator assignment scenarios

- [ ] E2E-ASSIGN-001: Global Admin opens `Game Administrators` and sees existing assignments or the empty state.
- [ ] E2E-ASSIGN-002: Global Admin opens `Add Assignment`, selects day of week, toggles `5-1 positions game`, selects Assigned Admin through user search, and creates the assignment.
- [ ] E2E-ASSIGN-003: Newly assigned admin appears in the assignments list with day and optional `5-1` badge.
- [ ] E2E-ASSIGN-004: Global Admin opens player info from an administrator assignment row.
- [ ] E2E-ASSIGN-005: Global Admin deletes an assignment after confirming the browser prompt.
- [ ] E2E-ASSIGN-006: Global Admin cancels assignment deletion and the assignment remains.
- [ ] E2E-ASSIGN-007: Non-admin Participant A is redirected away from `/game-administrators`.

## Priority player scenarios

- [ ] E2E-PRIORITY-001: Global Admin opens `Manage Priority Players` for an administrator assignment.
- [ ] E2E-PRIORITY-002: Global Admin sees the `No priority players yet.` empty state before adding players.
- [ ] E2E-PRIORITY-003: Global Admin adds Priority Player through `Search users to add...` and sees the user in the priority-player list.
- [ ] E2E-PRIORITY-004: Global Admin opens player info from a priority-player row.
- [ ] E2E-PRIORITY-005: Global Admin deletes a priority-player assignment after confirming the browser prompt.
- [ ] E2E-PRIORITY-006: Global Admin cancels priority-player deletion and the assignment remains.
- [ ] E2E-PRIORITY-007: Assigned Admin can manage priority players only for their own game administrator assignment.
- [ ] E2E-PRIORITY-008: Participant A cannot manage another user's priority-player assignment and is redirected to the allowed page.
- [ ] E2E-PRIORITY-009: Invalid priority-player assignment ids redirect back to `Game Administrators`.

## Cross-user and state-transition scenarios

- [ ] E2E-STATE-001: Global Admin creates a game, Participant A joins it in a separate context, and Global Admin sees Participant A in the players list after refresh.
- [ ] E2E-STATE-002: Participant A and Participant B compete for the last available spot; one becomes active and the other becomes waitlisted deterministically.
- [ ] E2E-STATE-003: Global Admin edits game capacity downward and the UI preserves valid active/waitlist status for existing registrations.
- [ ] E2E-STATE-004: Priority Player receives priority behavior for a priority-enabled game while a non-priority participant follows the normal registration order.
- [ ] E2E-STATE-005: Browser refresh keeps the authenticated session and current route for each logged-in persona.
- [ ] E2E-STATE-006: Opening the app in a new browser context without cookies starts unauthenticated.

## Accessibility and browser-mode smoke scenarios

- [ ] E2E-A11Y-001: Core unauthenticated, games home, game details, create game, and admin pages expose exactly one main landmark.
- [ ] E2E-A11Y-002: Primary form controls have accessible labels matching visible labels.
- [ ] E2E-A11Y-003: Keyboard-only user can log in, open filters, create a game, and submit/cancel dialogs.
- [ ] E2E-A11Y-004: Browser-mode brand link `Haarlem Volley Bot` returns to the games home from nested routes.
- [ ] E2E-A11Y-005: Modal dialogs keep actionable controls reachable by keyboard and close through cancel/escape paths where supported.

## Suggested implementation order

1. Dev login helpers and browser-context persona fixtures.
2. Auth/session smoke tests.
3. Game creation fixture helpers through UI plus API/database cleanup.
4. Participant registration flows.
5. Admin assignment and priority-player flows.
6. Negative access-control and API-failure recovery scenarios.
7. Accessibility smoke coverage.
