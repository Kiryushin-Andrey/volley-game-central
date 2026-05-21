import express, { type Request, type Response, type NextFunction } from 'express';
import type { BunqMockState, RequestInquiryRow, SessionState } from './state.js';
import { defaultSessionState, randomInstallationToken, randomSessionToken } from './state.js';

function json(res: Response, body: unknown, status = 200) {
  res.status(status).json(body);
}

function getInstallAuth(req: Request): string | undefined {
  const h = req.headers['x-bunq-client-authentication'];
  return typeof h === 'string' ? h : undefined;
}

function requireInstallationAuth(state: BunqMockState) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tok = getInstallAuth(req);
    if (!tok || !state.installations.has(tok)) {
      return json(res, { Error: [{ error_description: 'Invalid installation token' }] }, 401);
    }
    (req as express.Request & { installationToken: string }).installationToken = tok;
    next();
  };
}

function requireSessionAuth(state: BunqMockState) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tok = getInstallAuth(req);
    if (!tok || !state.sessions.has(tok)) {
      return json(res, { Error: [{ error_description: 'Invalid session token' }] }, 401);
    }
    (req as express.Request & { sessionToken: string }).sessionToken = tok;
    next();
  };
}

function getSession(req: Request, state: BunqMockState): SessionState {
  const tok = (req as express.Request & { sessionToken: string }).sessionToken;
  return state.sessions.get(tok)!;
}

export function createBunqApiApp(state: BunqMockState): express.Express {
  const app = express();
  app.use(express.json({ type: ['application/json', 'application/json; charset=utf-8'] }));

  const v1 = express.Router();

  v1.post('/installation', (_req, res) => {
    const token = randomInstallationToken();
    state.installations.set(token, { deviceRegistered: false });
    json(res, {
      Response: [{ Token: { token } }],
    });
  });

  v1.post('/device-server', requireInstallationAuth(state), (req, res) => {
    const tok = (req as express.Request & { installationToken: string }).installationToken;
    state.installations.get(tok)!.deviceRegistered = true;
    json(res, { Response: [] });
  });

  v1.post('/session-server', requireInstallationAuth(state), (req, res) => {
    const sessionToken = randomSessionToken();
    state.sessions.set(sessionToken, defaultSessionState());
    json(res, {
      Response: [{ Token: { token: sessionToken } }],
    });
  });

  v1.get('/user', requireSessionAuth(state), (req, res) => {
    const session = getSession(req, state);
    json(res, {
      Response: [
        {
          UserPerson: {
            id: session.bunqUserId,
            display_name: 'E2E Mock User',
            first_name: 'E2E',
            last_name: 'Mock',
          },
        },
      ],
    });
  });

  v1.get(
    '/user/:userId/monetary-account',
    requireSessionAuth(state),
    (req, res) => {
      const session = getSession(req, state);
      const uid = parseInt(req.params.userId, 10);
      if (uid !== session.bunqUserId) {
        return json(res, { Error: [{ error_description: 'User id mismatch' }] }, 400);
      }
      const Response = session.monetaryAccounts.map((a) => ({
        MonetaryAccountBank: {
          id: a.id,
          description: a.description,
          status: a.status,
        },
      }));
      json(res, { Response });
    }
  );

  v1.post(
    '/user/:userId/notification-filter-url',
    requireSessionAuth(state),
    (req, res) => {
      const session = getSession(req, state);
      const uid = parseInt(req.params.userId, 10);
      if (uid !== session.bunqUserId) {
        return json(res, { Error: [{ error_description: 'User id mismatch' }] }, 400);
      }
      const filters = (req.body as { notification_filters?: Array<{ notification_target?: string }> })
        ?.notification_filters;
      const target = filters?.[0]?.notification_target;
      if (target) {
        session.webhookTargets.push(target);
        state.lastWebhookTarget = target;
      }
      json(res, { Response: [] });
    }
  );

  v1.post(
    '/user/:userId/monetary-account/:monetaryAccountId/request-inquiry',
    requireSessionAuth(state),
    (req, res) => {
      const session = getSession(req, state);
      const uid = parseInt(req.params.userId, 10);
      const monetaryAccountId = parseInt(req.params.monetaryAccountId, 10);
      if (uid !== session.bunqUserId) {
        return json(res, { Error: [{ error_description: 'User id mismatch' }] }, 400);
      }
      const account = session.monetaryAccounts.find((a) => a.id === monetaryAccountId);
      if (!account) {
        return json(res, { Error: [{ error_description: 'Unknown monetary account' }] }, 400);
      }
      const id = state.nextInquiryId++;
      const amountInquired = (req.body as { amount_inquired?: { value?: string; currency?: string } })?.amount_inquired;
      const description =
        (req.body as { description?: string })?.description || 'Volleyball payment request';
      const row: RequestInquiryRow = {
        id,
        userId: uid,
        monetaryAccountId,
        status: 'PENDING',
        bunqme_share_url: `https://bunq.me/e2e-mock/${id}`,
        description,
      };
      session.requestInquiries.set(id, row);
      json(res, {
        Response: [
          {
            RequestInquiry: {
              id: row.id,
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              time_responded: null,
              time_expiry: null,
              monetary_account_id: monetaryAccountId,
              amount_inquired: {
                value: amountInquired?.value ?? '5.00',
                currency: amountInquired?.currency ?? 'EUR',
              },
              amount_responded: { value: '0.00', currency: 'EUR' },
              status: row.status,
              description: row.description,
              user_alias_created: {} as Record<string, unknown>,
              country: 'NL',
              counterparty_alias: {} as Record<string, unknown>,
              type: 'BUNQME',
              sub_type: 'NONE',
              bunqme_share_url: row.bunqme_share_url,
            },
          },
        ],
      });
    }
  );

  v1.get(
    '/user/:userId/monetary-account/:monetaryAccountId/request-inquiry/:inquiryId',
    requireSessionAuth(state),
    (req, res) => {
      const session = getSession(req, state);
      const uid = parseInt(req.params.userId, 10);
      const monetaryAccountId = parseInt(req.params.monetaryAccountId, 10);
      const inquiryId = parseInt(req.params.inquiryId, 10);
      if (uid !== session.bunqUserId) {
        return json(res, { Error: [{ error_description: 'User id mismatch' }] }, 400);
      }
      const row = session.requestInquiries.get(inquiryId);
      if (!row || row.monetaryAccountId !== monetaryAccountId) {
        return json(res, { Error: [{ error_description: 'Request inquiry not found' }] }, 404);
      }
      json(res, {
        Response: [
          {
            RequestInquiry: {
              id: row.id,
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              time_responded: null,
              time_expiry: null,
              monetary_account_id: row.monetaryAccountId,
              amount_inquired: { value: '5.00', currency: 'EUR' },
              amount_responded: { value: '0.00', currency: 'EUR' },
              status: row.status,
              description: row.description,
              user_alias_created: {} as Record<string, unknown>,
              country: 'NL',
              counterparty_alias: {} as Record<string, unknown>,
              type: 'BUNQME',
              sub_type: 'NONE',
              bunqme_share_url: row.bunqme_share_url,
            },
          },
        ],
      });
    }
  );

  app.use('/v1', v1);
  return app;
}
