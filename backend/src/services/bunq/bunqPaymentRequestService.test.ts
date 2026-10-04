import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BunqClientPort, BunqHttpClient } from './bunqClientPort';
import { createBunqPaymentRequestService } from './bunqPaymentRequestService';

function memoryClientPort(handlers: {
  get: BunqHttpClient['get'];
  post?: BunqHttpClient['post'];
}): BunqClientPort {
  return {
    async createClient() {
      return {
        monetaryAccountId: 99,
        privateKey: '-----BEGIN PRIVATE KEY-----\nunused-in-status-check\n-----END PRIVATE KEY-----',
        client: {
          get: handlers.get,
          post: handlers.post ?? (async () => {
            throw new Error('unexpected POST');
          }),
        },
      };
    },
  };
}

describe('bunqPaymentRequestService (injected client port)', () => {
  it('checkPaymentRequestStatus returns true for ACCEPTED without installation/session code', async () => {
    const calls: string[] = [];
    const port = memoryClientPort({
      async get(url) {
        calls.push(url);
        if (url === '/user') {
          return { status: 200, data: { Response: [{ UserPerson: { id: 7 } }] } };
        }
        if (url === '/user/7/monetary-account/99/request-inquiry/inq-1') {
          return {
            status: 200,
            data: { Response: [{ RequestInquiry: { status: 'ACCEPTED' } }] },
          };
        }
        throw new Error(`unexpected GET ${url}`);
      },
    });

    const service = createBunqPaymentRequestService(port);
    const paid = await service.checkPaymentRequestStatus('inq-1', 99, 1, 'any-password');

    assert.equal(paid, true);
    assert.deepEqual(calls, [
      '/user',
      '/user/7/monetary-account/99/request-inquiry/inq-1',
    ]);
  });

  it('checkPaymentRequestStatus returns false when Bunq reports PENDING', async () => {
    const port = memoryClientPort({
      async get(url) {
        if (url === '/user') {
          return { status: 200, data: { Response: [{ UserCompany: { id: 3 } }] } };
        }
        return {
          status: 200,
          data: { Response: [{ RequestInquiry: { status: 'PENDING' } }] },
        };
      },
    });

    const service = createBunqPaymentRequestService(port);
    const paid = await service.checkPaymentRequestStatus('inq-2', 99, 1, 'pw');
    assert.equal(paid, false);
  });

  it('checkPaymentRequestStatus returns false when createClient yields null', async () => {
    const port: BunqClientPort = {
      async createClient() {
        return null;
      },
    };
    const service = createBunqPaymentRequestService(port);
    assert.equal(await service.checkPaymentRequestStatus('inq-3', 1, 1, 'pw'), false);
  });
});
