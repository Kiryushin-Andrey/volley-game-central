import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNodeTestShims } from '../test/nodeTestShims';

test('createAxiosTransport accepts injected Telegram init data without window.Telegram', async () => {
  installNodeTestShims();
  assert.equal(
    (globalThis as { window?: { Telegram?: unknown } }).window?.Telegram,
    undefined,
  );

  const { createAxiosTransport, createApiClients } = await import('./api');

  const headers: Array<{ Authorization?: string }> = [];
  const transport = createAxiosTransport({
    baseURL: 'http://transport.test',
    getTelegramInitData: () => 'init-data-from-test',
  });

  const axiosLike = transport as typeof transport & {
    defaults: {
      adapter?: (config: {
        headers: { Authorization?: string };
        url?: string;
        method?: string;
      }) => Promise<{
        data: unknown;
        status: number;
        config: unknown;
        headers: object;
        statusText: string;
      }>;
    };
  };

  axiosLike.defaults.adapter = async (config) => {
    headers.push({ Authorization: config.headers.Authorization });
    return {
      data: { buildTimestamp: 'ts' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };

  const clients = createApiClients(transport);
  const info = await clients.getBuildInfo();
  assert.equal(info.buildTimestamp, 'ts');
  assert.equal(headers[0]?.Authorization, 'TelegramWebApp init-data-from-test');
});
