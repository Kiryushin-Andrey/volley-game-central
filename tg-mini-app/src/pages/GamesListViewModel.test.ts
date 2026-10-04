import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AxiosRequestConfig } from 'axios';
import { installNodeTestShims } from '../test/nodeTestShims';

type FakeCall = { method: string; url: string; config?: AxiosRequestConfig };

function createFakeTransport(calls: FakeCall[]) {
  const games = [
    {
      id: 1,
      dateTime: '2030-01-05T18:00:00.000Z',
      maxPlayers: 12,
      unregisterDeadlineHours: 2,
      paymentAmount: 1000,
      pricingMode: 'fixed' as const,
      gameFormat: 'recreational' as const,
      locationName: 'Hall',
      locationLink: null,
      title: null,
      readonly: false,
      fullyPaid: false,
      createdAt: null,
      category: 'sunday' as const,
      totalRegisteredCount: 3,
      registeredCount: 3,
      paidCount: 1,
      isUserRegistered: false,
    },
  ];

  return {
    async get(url: string, config?: AxiosRequestConfig) {
      calls.push({ method: 'GET', url, config });
      if (url === '/games') return { data: games };
      if (url === '/users/me/unpaid-games') return { data: [] };
      if (url === '/game-administrators/me') return { data: [] };
      throw new Error(`Unexpected GET ${url}`);
    },
    async post(url: string) {
      throw new Error(`Unexpected POST ${url}`);
    },
    async put(url: string) {
      throw new Error(`Unexpected PUT ${url}`);
    },
    async patch(url: string) {
      throw new Error(`Unexpected PATCH ${url}`);
    },
    async delete(url: string) {
      throw new Error(`Unexpected DELETE ${url}`);
    },
  };
}

test('GamesListViewModel loads games through injectable HTTP transport without window.Telegram', async () => {
  installNodeTestShims();
  assert.equal(
    (globalThis as { window?: { Telegram?: unknown } }).window?.Telegram,
    undefined,
  );

  const { createApiClients } = await import('../services/api');
  const { GamesListViewModel } = await import('./GamesListViewModel');

  const calls: FakeCall[] = [];
  const clients = createApiClients(createFakeTransport(calls) as import('../services/api').HttpTransport);
  const user = {
    id: 7,
    telegramId: '0',
    displayName: 'Tester',
    isAdmin: false,
    isTc: false,
    createdAt: null,
  };

  const vm = new GamesListViewModel(user, {
    gamesApi: clients.gamesApi,
    bunqApi: clients.bunqApi,
    userApi: clients.userApi,
    gameAdministratorsApi: clients.gameAdministratorsApi,
    navigate: (() => undefined) as never,
    logDebug: () => undefined,
  });

  await vm.init();

  assert.equal(vm.error, null);
  assert.equal(vm.games.length, 1);
  assert.equal(vm.games[0].id, 1);
  assert.equal(vm.unpaidItems.length, 0);
  assert.ok(calls.some((c) => c.method === 'GET' && c.url === '/games'));
  assert.ok(calls.some((c) => c.method === 'GET' && c.url === '/users/me/unpaid-games'));
  assert.ok(calls.some((c) => c.method === 'GET' && c.url === '/game-administrators/me'));
});
