import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNodeTestShims } from '../test/nodeTestShims';
import { PricingMode, type Game, type User } from '../types';
import type { UiPrompts } from '../utils/uiPrompts';

function sampleGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 42,
    dateTime: '2030-06-15T18:00:00.000Z',
    maxPlayers: 12,
    unregisterDeadlineHours: 5,
    paymentAmount: 1000,
    pricingMode: PricingMode.PER_PARTICIPANT,
    gameFormat: 'recreational',
    locationName: 'Hall',
    locationLink: null,
    title: 'Sunday game',
    readonly: false,
    fullyPaid: false,
    createdAt: null,
    createdById: 1,
    category: 'sunday',
    registrations: [],
    collectorUser: null,
    isAssignedAdmin: false,
    registrationOpenDays: 7,
    registrationOpensAt: '2030-06-08T00:00:00.000Z',
    canSelfRegister: true,
    guestRegistrationOpensAt: '2030-06-10T00:00:00.000Z',
    guestRegistrationOpenDays: 5,
    canRegisterGuest: true,
    isPriorityPlayer: false,
    ...overrides,
  };
}

test('GameDetailsViewModel loads via fake API and notifies a single subscribe listener', async () => {
  installNodeTestShims();

  const { GameDetailsViewModel } = await import('./GameDetailsViewModel');

  const game = sampleGame();
  let getGameCalls = 0;
  const fakeGamesApi = {
    getGame: async (id: number) => {
      getGameCalls += 1;
      assert.equal(id, 42);
      return game;
    },
  };
  const fakeBunqApi = {
    getStatus: async () => ({ enabled: false }),
  };

  const prompts: UiPrompts = {
    showPopup: () => undefined,
    showConfirm: (_msg, cb) => cb(false),
  };

  const user: User = {
    id: 7,
    telegramId: '0',
    displayName: 'Tester',
    isAdmin: false,
    isTc: false,
    createdAt: null,
  };

  const vm = new GameDetailsViewModel({
    navigate: () => undefined,
    user,
    prompts,
    gamesApi: fakeGamesApi as never,
    bunqApi: fakeBunqApi as never,
  });

  let ticks = 0;
  const unsub = vm.subscribe(() => {
    ticks += 1;
  });

  const before = vm.getSnapshot();
  assert.equal(before.gameData.isLoading, true);
  assert.equal(vm.game, null);

  await vm.loadGame(42);

  const after = vm.getSnapshot();
  assert.equal(getGameCalls, 1);
  assert.notEqual(before, after, 'getSnapshot identity must change for useSyncExternalStore');
  assert.equal(after.gameData.isLoading, false);
  assert.equal(after.gameData.error, null);
  assert.equal(after.gameData.game?.id, 42);
  assert.ok(ticks >= 1, 'subscribe listener should fire on state changes');
  assert.equal(vm.userMaySelfRegister(), true);
  assert.equal(vm.shouldShowAddGuestButton(), true);

  unsub();
});

test('open spot offers hide Join Game and show accept-first info text', async () => {
  installNodeTestShims();

  const { GameDetailsViewModel } = await import('./GameDetailsViewModel');

  const prompts: UiPrompts = {
    showPopup: () => undefined,
    showConfirm: (_msg, cb) => cb(false),
  };

  const user: User = {
    id: 7,
    telegramId: '0',
    displayName: 'Tester',
    isAdmin: false,
    isTc: false,
    createdAt: null,
  };

  const vm = new GameDetailsViewModel({
    navigate: () => undefined,
    user,
    prompts,
    gamesApi: {
      getGame: async () =>
        sampleGame({
          canSelfRegister: false,
          canRegisterGuest: false,
          activeSpotOffers: [
            {
              id: 1,
              offererUserId: 99,
              guestName: null,
              offererDisplayName: 'Offerer',
            },
          ],
        }),
    } as never,
    bunqApi: { getStatus: async () => ({ enabled: false }) } as never,
  });

  await vm.loadGame(42);
  assert.equal(vm.userMaySelfRegister(), false);
  assert.equal(vm.getMainButtonProps().show, false);
  assert.equal(
    vm.getInfoText(),
    'Accept the offer to join the game',
  );
});

test('injected UiPrompts are used (no DialogProvider required)', async () => {
  installNodeTestShims();

  const { GameDetailsViewModel } = await import('./GameDetailsViewModel');

  const popupTitles: string[] = [];
  const prompts: UiPrompts = {
    showPopup: (args) => {
      popupTitles.push(args.title || '');
    },
    showConfirm: (_msg, cb) => cb(false),
  };

  const user: User = {
    id: 7,
    telegramId: '0',
    displayName: 'Tester',
    isAdmin: false,
    isTc: false,
    createdAt: null,
    blockReason: 'unpaid',
  };

  const vm = new GameDetailsViewModel({
    navigate: () => undefined,
    user,
    prompts,
    gamesApi: {
      getGame: async () =>
        sampleGame({
          canSelfRegister: true,
          registrations: [],
        }),
    } as never,
    bunqApi: { getStatus: async () => ({ enabled: false }) } as never,
  });

  await vm.loadGame(42);
  // Join path opens bring-ball dialog; blocked user hits prompts on register attempt via handle path.
  // Drive guest register which checks blockReason first.
  await vm.handleGuestRegister();
  assert.deepEqual(popupTitles, ['Guest registration blocked']);
});
