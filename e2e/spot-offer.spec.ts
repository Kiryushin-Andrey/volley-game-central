import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  assignPlayerLevelViaApi,
  cleanupE2eData,
  countSpotOfferInvites,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLoginAs,
  e2eTitle,
  getOpenSpotOfferId,
  getRegistrationOwner,
  listFulfilledSpotOffers,
  postDeadlinePublicPhaseGameTime,
  postDeadlineWaitlistWalkGameTime,
  registerForGameViaUi,
  setSpotOfferTimingViaUi,
  setUserTelegramId,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

/** Named mid-test screenshots for the HTML report (`screenshot: 'on'` only captures the end). */
async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

async function joinGame(page: Page, bringBall = false, expectedStatus = "You're in") {
  await page.getByRole('button', { name: 'Join Game' }).click();
  await expect(page.getByRole('heading', { name: 'Will you bring a volleyball?' })).toBeVisible();
  await page
    .getByRole('button', { name: bringBall ? /Yes, I'll bring one/ : /No, I won't bring one/ })
    .click();
  await expect(page.getByText(expectedStatus, { exact: true })).toBeVisible();
}

async function confirmOk(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'OK' }).click();
}

async function offerMySpot(page: Page) {
  await page.getByRole('button', { name: 'Offer my spot' }).click();
  await confirmOk(page);
  await expect(page.getByRole('dialog').filter({ hasText: 'Spot offered' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText("You're offering your spot")).toBeVisible();
}

async function acceptOpenOffer(page: Page) {
  await page.getByRole('button', { name: 'Accept' }).click();
  await confirmOk(page);
  await expect(page.getByRole('dialog').filter({ hasText: 'Spot accepted' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
}

async function createGameThenSetTiming(
  page: Page,
  testInfo: Parameters<typeof e2eTitle>[0],
  label: string,
  timing: {
    dateTime: Date;
    unregisterDeadlineHours: number;
    gameFormat?: 'recreational' | 'positions' | 'priority_players';
  },
  maxPlayers: number,
) {
  const game = await createGameViaUi(page, {
    title: e2eTitle(testInfo, label),
    dateTime: daysFromNow(2),
    maxPlayers,
    unregisterDeadlineHours: 5,
    gameFormat: timing.gameFormat ?? 'recreational',
  });
  await setSpotOfferTimingViaUi(page, game.id, timing);
  return game;
}

test.describe('offer my spot scenarios', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-OFFER-001 before deadline Leave only; after deadline Offer available and still registered', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Deadline Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Offer Deadline Player');

    await devLoginAs(page, admin);
    const beforeGame = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Offer Before Deadline'),
      dateTime: daysFromNow(2),
      maxPlayers: 8,
      unregisterDeadlineHours: 5,
    });

    await switchToUser(page, participant);
    await page.goto(`/game/${beforeGame.id}`);
    await joinGame(page);
    await page.waitForTimeout(1100);

    await expect(page.getByRole('button', { name: 'Leave Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Offer my spot' })).toHaveCount(0);
    await attachScreenshot(page, testInfo, '01-before-deadline-leave-only');

    await switchToUser(page, admin);
    const afterTiming = postDeadlineWaitlistWalkGameTime();
    const afterGame = await createGameThenSetTiming(
      page,
      testInfo,
      'Offer After Deadline',
      afterTiming,
      8,
    );

    // Land on home so Logout is reliably available before switchToUser.
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await registerForGameViaUi(page, participant, afterGame.id);
    await page.waitForTimeout(1100);
    await page.goto(`/game/${afterGame.id}`);

    await expect(page.getByRole('button', { name: 'Leave Game' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Offer my spot' })).toBeVisible();
    await attachScreenshot(page, testInfo, '01-after-deadline-offer-my-spot');
    await offerMySpot(page);
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
    await expect(page.locator('.player-name').filter({ hasText: participant.displayName })).toBeVisible();
    await attachScreenshot(page, testInfo, '01-after-offering-own-spot');
  });

  test('E2E-OFFER-002 waitlisted accept keeps the same roster place', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Accept Admin', true);
    const offerer = await createDevUserViaApi(request, testInfo, 'Offer Accept Offerer');
    const rosterMate = await createDevUserViaApi(request, testInfo, 'Offer Accept Mate');
    const waitlisted = await createDevUserViaApi(request, testInfo, 'Offer Accept Wait');

    await setUserTelegramId(waitlisted.id, `e2e-tg-${waitlisted.id}`);

    await devLoginAs(page, admin);
    const timing = postDeadlineWaitlistWalkGameTime();
    // Form enforces maxPlayers min=2; fill roster then waitlist.
    const game = await createGameThenSetTiming(page, testInfo, 'Offer Waitlist Accept', timing, 2);

    await registerForGameViaUi(page, offerer, game.id);
    await registerForGameViaUi(page, rosterMate, game.id);
    await registerForGameViaUi(page, waitlisted, game.id, 'Waitlist');

    const before = await getRegistrationOwner(game.id, 0);
    expect(before?.userId).toBe(offerer.id);
    const preservedCreatedAt = before!.createdAt;

    await switchToUser(page, offerer);
    await page.goto(`/game/${game.id}`);
    await page.waitForTimeout(1100);
    await offerMySpot(page);

    await switchToUser(page, waitlisted);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await attachScreenshot(page, testInfo, '02-waitlisted-sees-offer-banner');
    await acceptOpenOffer(page);

    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
    await expect(page.getByText('Waiting List')).toHaveCount(0);
    await attachScreenshot(page, testInfo, '02-waitlisted-after-accept');

    const after = await getRegistrationOwner(game.id, 0);
    expect(after?.id).toBe(before!.id);
    expect(after?.userId).toBe(waitlisted.id);
    expect(new Date(after!.createdAt).toISOString()).toBe(new Date(preservedCreatedAt).toISOString());
  });

  test('E2E-OFFER-003 after spacing next waitlisted is invited; first invitee can still accept', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Spacing Admin', true);
    const offerer = await createDevUserViaApi(request, testInfo, 'Offer Spacing Offerer');
    const rosterMate = await createDevUserViaApi(request, testInfo, 'Offer Spacing Mate');
    const first = await createDevUserViaApi(request, testInfo, 'Offer Spacing First');
    const second = await createDevUserViaApi(request, testInfo, 'Offer Spacing Second');

    await setUserTelegramId(first.id, `e2e-tg-${first.id}`);
    await setUserTelegramId(second.id, `e2e-tg-${second.id}`);

    await devLoginAs(page, admin);
    const timing = postDeadlineWaitlistWalkGameTime();
    const game = await createGameThenSetTiming(page, testInfo, 'Offer Spacing', timing, 2);

    await registerForGameViaUi(page, offerer, game.id);
    await registerForGameViaUi(page, rosterMate, game.id);
    await registerForGameViaUi(page, first, game.id, 'Waitlist');
    await registerForGameViaUi(page, second, game.id, 'Waitlist');

    await switchToUser(page, offerer);
    await page.goto(`/game/${game.id}`);
    await page.waitForTimeout(1100);
    await offerMySpot(page);

    const offerId = await getOpenSpotOfferId(game.id, offerer.id);
    expect(offerId).toBeTruthy();

    await expect
      .poll(async () => countSpotOfferInvites(offerId!), {
        timeout: 15_000,
        message: 'first waitlisted invite should be persisted',
      })
      .toBe(1);

    await expect
      .poll(async () => countSpotOfferInvites(offerId!), {
        timeout: 20_000,
        message: 'second waitlisted invite after spacing/poller',
      })
      .toBe(2);

    await switchToUser(page, first);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await attachScreenshot(page, testInfo, '03-first-invitee-sees-offer-banner');
    await acceptOpenOffer(page);
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
    await attachScreenshot(page, testInfo, '03-first-invitee-after-accept');
  });

  test('E2E-OFFER-004 eligible non-waitlisted accepts during walk and after public announce', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Outsider Admin', true);
    const offererWalk = await createDevUserViaApi(request, testInfo, 'Offer Outsider Offerer Walk');
    const rosterMate = await createDevUserViaApi(request, testInfo, 'Offer Outsider Mate');
    const waitlisted = await createDevUserViaApi(request, testInfo, 'Offer Outsider Wait');
    const outsiderWalk = await createDevUserViaApi(request, testInfo, 'Offer Outsider Walk');
    const offererPublic = await createDevUserViaApi(request, testInfo, 'Offer Outsider Offerer Pub');
    const outsiderPublic = await createDevUserViaApi(request, testInfo, 'Offer Outsider Pub');

    await setUserTelegramId(waitlisted.id, `e2e-tg-${waitlisted.id}`);

    await devLoginAs(page, admin);
    const walkTiming = postDeadlineWaitlistWalkGameTime();
    const walkGame = await createGameThenSetTiming(
      page,
      testInfo,
      'Offer Outsider Walk',
      walkTiming,
      2,
    );
    await registerForGameViaUi(page, offererWalk, walkGame.id);
    await registerForGameViaUi(page, rosterMate, walkGame.id);
    await registerForGameViaUi(page, waitlisted, walkGame.id, 'Waitlist');

    await switchToUser(page, offererWalk);
    await page.goto(`/game/${walkGame.id}`);
    await page.waitForTimeout(1100);
    await offerMySpot(page);

    await switchToUser(page, outsiderWalk);
    await page.goto(`/game/${walkGame.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await attachScreenshot(page, testInfo, '04-outsider-sees-offer-banner-during-walk');
    await acceptOpenOffer(page);
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();

    await switchToUser(page, admin);
    const publicTiming = postDeadlinePublicPhaseGameTime();
    const publicGame = await createGameThenSetTiming(
      page,
      testInfo,
      'Offer Outsider Public',
      publicTiming,
      2,
    );
    await registerForGameViaUi(page, offererPublic, publicGame.id);

    await switchToUser(page, offererPublic);
    await page.goto(`/game/${publicGame.id}`);
    await page.waitForTimeout(1100);
    await offerMySpot(page);

    await switchToUser(page, outsiderPublic);
    await page.goto(`/game/${publicGame.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await attachScreenshot(page, testInfo, '04-outsider-sees-offer-banner-public-phase');
    await acceptOpenOffer(page);
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
  });

  test('E2E-OFFER-005 cancel self offer; host cancels guest offer via guestName', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Cancel Admin', true);
    const host = await createDevUserViaApi(request, testInfo, 'Offer Cancel Host');

    await devLoginAs(page, admin);
    const timing = postDeadlineWaitlistWalkGameTime();
    const game = await createGameThenSetTiming(page, testInfo, 'Offer Cancel', timing, 4);

    await switchToUser(page, host);
    await page.goto(`/game/${game.id}`);
    await joinGame(page);
    await page.waitForTimeout(1100);

    const guestName = `Guest ${Date.now().toString(36)}`;
    await page.getByRole('button', { name: 'Add guest' }).click();
    await page.getByLabel('Guest Name:').fill(guestName);
    await page.getByRole('button', { name: 'Register Guest' }).click();
    await expect(page.locator('.player-name').filter({ hasText: guestName })).toBeVisible();
    await page.waitForTimeout(1100);

    await page.goto(`/game/${game.id}`);
    await offerMySpot(page);
    await attachScreenshot(page, testInfo, '05-self-offer-banner');

    const guestRow = page.locator('.player-item').filter({ hasText: guestName });
    await expect(guestRow.getByRole('button', { name: 'Offer' })).toBeVisible();
    await attachScreenshot(page, testInfo, '05-guest-row-inline-offer');

    await guestRow.getByRole('button', { name: 'Offer' }).click();
    await confirmOk(page);
    await expect(page.getByRole('dialog').filter({ hasText: 'Spot offered' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();

    await expect(page.getByText("You're offering your spot")).toBeVisible();
    await expect(page.getByText(`You're offering guest "${guestName}"'s spot`)).toBeVisible();
    await attachScreenshot(page, testInfo, '05-self-and-guest-offering-banners');

    await page
      .locator('.spot-offer-row')
      .filter({ hasText: guestName })
      .getByRole('button', { name: 'Cancel' })
      .click();
    await confirmOk(page);
    await expect(page.getByText(`You're offering guest "${guestName}"'s spot`)).toHaveCount(0);
    await expect(page.getByText("You're offering your spot")).toBeVisible();
    await attachScreenshot(page, testInfo, '05-after-cancel-guest-offer');

    await page
      .locator('.spot-offer-row')
      .filter({ hasText: "You're offering your spot" })
      .getByRole('button', { name: 'Cancel' })
      .click();
    await confirmOk(page);
    await expect(page.getByText("You're offering your spot")).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Offer my spot' })).toBeVisible();
    await attachScreenshot(page, testInfo, '05-after-cancel-self-offer');
  });

  test('E2E-OFFER-006 double accept: one winner', async ({ browser, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Race Admin', true);
    const offerer = await createDevUserViaApi(request, testInfo, 'Offer Race Offerer');
    const claimerA = await createDevUserViaApi(request, testInfo, 'Offer Race A');
    const claimerB = await createDevUserViaApi(request, testInfo, 'Offer Race B');

    const adminPage = await browser.newPage();
    await waitForBackend(adminPage.request);

    await devLoginAs(adminPage, admin);
    const timing = postDeadlinePublicPhaseGameTime();
    const game = await createGameThenSetTiming(adminPage, testInfo, 'Offer Race', timing, 2);
    await registerForGameViaUi(adminPage, offerer, game.id);

    await switchToUser(adminPage, offerer);
    await adminPage.goto(`/game/${game.id}`);
    await adminPage.waitForTimeout(1100);
    await offerMySpot(adminPage);
    const offerId = await getOpenSpotOfferId(game.id, offerer.id);
    expect(offerId).toBeTruthy();
    await adminPage.close();

    const pageA = await browser.newPage();
    const pageB = await browser.newPage();
    await switchToUser(pageA, claimerA);
    await switchToUser(pageB, claimerB);
    await pageA.goto(`/game/${game.id}`);
    await pageB.goto(`/game/${game.id}`);

    await expect(pageA.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(pageB.getByRole('button', { name: 'Accept' })).toBeVisible();

    // Confirm dialogs first (serialize OK clicks slightly so both requests fire)
    await pageA.getByRole('button', { name: 'Accept' }).click();
    await expect(pageA.getByRole('dialog')).toBeVisible();
    await pageB.getByRole('button', { name: 'Accept' }).click();
    await expect(pageB.getByRole('dialog')).toBeVisible();

    await Promise.all([
      pageA.getByRole('dialog').getByRole('button', { name: 'OK' }).click(),
      pageB.getByRole('dialog').getByRole('button', { name: 'OK' }).click(),
    ]);

    // One success popup and/or one error popup; dismiss whatever appears
    await Promise.all([
      pageA
        .getByRole('dialog')
        .getByRole('button', { name: 'OK' })
        .click({ timeout: 10_000 })
        .catch(() => undefined),
      pageB
        .getByRole('dialog')
        .getByRole('button', { name: 'OK' })
        .click({ timeout: 10_000 })
        .catch(() => undefined),
    ]);

    await expect
      .poll(async () => {
        const owner = await getRegistrationOwner(game.id, 0);
        return owner?.userId === claimerA.id || owner?.userId === claimerB.id;
      }, { timeout: 15_000, message: 'exactly one claimer should own the offered roster row' })
      .toBe(true);

    const owner = await getRegistrationOwner(game.id, 0);
    expect([claimerA.id, claimerB.id]).toContain(owner?.userId);
    expect(owner?.userId).not.toBe(offerer.id);

    // Open offer must be fulfilled (no longer open)
    expect(await getOpenSpotOfferId(game.id, offerer.id)).toBeNull();

    await pageA.close();
    await pageB.close();
  });

  test('E2E-OFFER-007 host offers guest spot; another user accepts', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Guest Admin', true);
    const host = await createDevUserViaApi(request, testInfo, 'Offer Guest Host');
    const claimer = await createDevUserViaApi(request, testInfo, 'Offer Guest Claimer');

    await devLoginAs(page, admin);
    const timing = postDeadlinePublicPhaseGameTime();
    const game = await createGameThenSetTiming(page, testInfo, 'Offer Guest Spot', timing, 2);

    await switchToUser(page, host);
    await page.goto(`/game/${game.id}`);
    await joinGame(page);
    await page.waitForTimeout(1100);

    const guestName = `Guest ${Date.now().toString(36)}`;
    await page.getByRole('button', { name: 'Add guest' }).click();
    await page.getByLabel('Guest Name:').fill(guestName);
    await page.getByRole('button', { name: 'Register Guest' }).click();
    await expect(page.locator('.player-name').filter({ hasText: guestName })).toBeVisible();
    await page.waitForTimeout(1100);

    await page.goto(`/game/${game.id}`);
    const guestRow = page.locator('.player-item').filter({ hasText: guestName });
    await expect(guestRow.getByRole('button', { name: 'Offer' })).toBeVisible();
    await attachScreenshot(page, testInfo, '07-guest-row-inline-offer');

    await guestRow.getByRole('button', { name: 'Offer' }).click();
    await confirmOk(page);
    await expect(page.getByRole('dialog').filter({ hasText: 'Spot offered' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText(`You're offering guest "${guestName}"'s spot`)).toBeVisible();
    await attachScreenshot(page, testInfo, '07-offering-guest-spot-banner');

    const beforeGuest = await getRegistrationOwner(game.id, 1);
    expect(beforeGuest?.guestName).toBe(guestName);
    expect(beforeGuest?.userId).toBe(host.id);

    await switchToUser(page, claimer);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await attachScreenshot(page, testInfo, '07-claimer-sees-accept-for-guest-offer');
    await acceptOpenOffer(page);
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
    await attachScreenshot(page, testInfo, '07-claimer-took-guest-spot');

    const after = await getRegistrationOwner(game.id, 1);
    expect(after?.id).toBe(beforeGuest!.id);
    expect(after?.userId).toBe(claimer.id);
    expect(after?.guestName).toBeNull();
  });

  test('E2E-OFFER-008 beginner sees offer banner but no Accept on positions with level restrictions', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Level Admin', true);
    const offerer = await createDevUserViaApi(request, testInfo, 'Offer Level Offerer');
    const beginner = await createDevUserViaApi(request, testInfo, 'Offer Level Beginner');
    const outsider = await createDevUserViaApi(request, testInfo, 'Offer Level Outsider');
    await assignPlayerLevelViaApi(request, testInfo, beginner.id, 'beginner');
    await assignPlayerLevelViaApi(request, testInfo, outsider.id, 'advanced');

    await devLoginAs(page, admin);
    const timing = {
      ...postDeadlinePublicPhaseGameTime(),
      gameFormat: 'positions' as const,
      unregisterDeadlineHours: 24,
    };
    const game = await createGameThenSetTiming(page, testInfo, 'Offer Level Block', timing, 2);

    await registerForGameViaUi(page, offerer, game.id);

    await switchToUser(page, offerer);
    await page.goto(`/game/${game.id}`);
    await page.waitForTimeout(1100);
    await offerMySpot(page);

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await attachScreenshot(page, testInfo, '08-beginner-banner-without-accept');

    await switchToUser(page, outsider);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await attachScreenshot(page, testInfo, '08-advanced-outsider-sees-accept');
  });

  test('E2E-OFFER-009 roster mate sees offer banner without Accept; outsider can Accept', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Hidden Admin', true);
    const offerer = await createDevUserViaApi(request, testInfo, 'Offer Hidden Offerer');
    const rosterMate = await createDevUserViaApi(request, testInfo, 'Offer Hidden Mate');
    const outsider = await createDevUserViaApi(request, testInfo, 'Offer Hidden Outsider');

    await devLoginAs(page, admin);
    const timing = postDeadlinePublicPhaseGameTime();
    const game = await createGameThenSetTiming(page, testInfo, 'Offer Accept Hidden', timing, 2);

    await registerForGameViaUi(page, offerer, game.id);
    await registerForGameViaUi(page, rosterMate, game.id);

    await switchToUser(page, offerer);
    await page.goto(`/game/${game.id}`);
    await page.waitForTimeout(1100);
    await offerMySpot(page);
    await expect(page.getByText("You're offering your spot")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await attachScreenshot(page, testInfo, '09-offerer-own-offer-banner');

    await switchToUser(page, rosterMate);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await attachScreenshot(page, testInfo, '09-roster-mate-banner-without-accept');

    await switchToUser(page, outsider);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await attachScreenshot(page, testInfo, '09-outsider-sees-accept');
  });

  test('E2E-OFFER-010 re-offer after accept: same registration row handed A→B→C', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer Chain Admin', true);
    const userA = await createDevUserViaApi(request, testInfo, 'Offer Chain A');
    const userB = await createDevUserViaApi(request, testInfo, 'Offer Chain B');
    const userC = await createDevUserViaApi(request, testInfo, 'Offer Chain C');

    await devLoginAs(page, admin);
    const timing = postDeadlinePublicPhaseGameTime();
    const game = await createGameThenSetTiming(page, testInfo, 'Offer Reoffer Chain', timing, 2);

    await registerForGameViaUi(page, userA, game.id);

    const original = await getRegistrationOwner(game.id, 0);
    expect(original?.userId).toBe(userA.id);
    const registrationId = original!.id;
    const preservedCreatedAt = original!.createdAt;

    await switchToUser(page, userA);
    await page.goto(`/game/${game.id}`);
    await page.waitForTimeout(1100);
    await offerMySpot(page);
    await attachScreenshot(page, testInfo, '10-a-offering-own-spot');

    await switchToUser(page, userB);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await attachScreenshot(page, testInfo, '10-b-sees-a-offer-banner');
    await acceptOpenOffer(page);
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
    await attachScreenshot(page, testInfo, '10-b-after-accepting-a');

    const afterFirst = await getRegistrationOwner(game.id, 0);
    expect(afterFirst?.id).toBe(registrationId);
    expect(afterFirst?.userId).toBe(userB.id);
    expect(new Date(afterFirst!.createdAt).toISOString()).toBe(
      new Date(preservedCreatedAt).toISOString(),
    );
    expect(await getOpenSpotOfferId(game.id)).toBeNull();

    await page.waitForTimeout(1100);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Offer my spot' })).toBeVisible();
    await attachScreenshot(page, testInfo, '10-b-can-reoffer');
    await offerMySpot(page);
    await attachScreenshot(page, testInfo, '10-b-offering-own-spot');

    await switchToUser(page, userC);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByText(/is offering a spot for the game/)).toBeVisible();
    await attachScreenshot(page, testInfo, '10-c-sees-b-offer-banner');
    await acceptOpenOffer(page);
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
    await attachScreenshot(page, testInfo, '10-c-after-accepting-b');

    const afterSecond = await getRegistrationOwner(game.id, 0);
    expect(afterSecond?.id).toBe(registrationId);
    expect(afterSecond?.userId).toBe(userC.id);
    expect(new Date(afterSecond!.createdAt).toISOString()).toBe(
      new Date(preservedCreatedAt).toISOString(),
    );
    expect(await getOpenSpotOfferId(game.id)).toBeNull();

    const fulfilled = await listFulfilledSpotOffers(game.id);
    expect(fulfilled).toHaveLength(2);
    expect(fulfilled[0]).toMatchObject({
      registrationId,
      offererUserId: userA.id,
      fulfilledByUserId: userB.id,
    });
    expect(fulfilled[1]).toMatchObject({
      registrationId,
      offererUserId: userB.id,
      fulfilledByUserId: userC.id,
    });
  });

  test('E2E-OFFER-011 Join Game hidden while open offer exists; returns after cancel', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Offer JoinGate Admin', true);
    const offerer = await createDevUserViaApi(request, testInfo, 'Offer JoinGate Offerer');
    const outsider = await createDevUserViaApi(request, testInfo, 'Offer JoinGate Outsider');

    await devLoginAs(page, admin);
    const timing = postDeadlinePublicPhaseGameTime();
    // Capacity left so outsider could otherwise Join Game onto the roster
    const game = await createGameThenSetTiming(page, testInfo, 'Offer Join Gate', timing, 4);
    await registerForGameViaUi(page, offerer, game.id);

    await switchToUser(page, offerer);
    await page.goto(`/game/${game.id}`);
    await page.waitForTimeout(1100);
    await offerMySpot(page);

    await switchToUser(page, outsider);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
    await expect(
      page.getByText('Accept the offer to join the game'),
    ).toBeVisible();
    await attachScreenshot(page, testInfo, '11-join-hidden-while-offer-open');

    await switchToUser(page, offerer);
    await page.goto(`/game/${game.id}`);
    await page
      .locator('.spot-offer-row')
      .filter({ hasText: "You're offering your spot" })
      .getByRole('button', { name: 'Cancel' })
      .click();
    await confirmOk(page);
    await expect(page.getByText("You're offering your spot")).toHaveCount(0);

    await switchToUser(page, outsider);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await attachScreenshot(page, testInfo, '11-join-visible-after-offer-cancel');
  });
});
