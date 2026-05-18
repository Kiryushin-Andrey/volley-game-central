import express from 'express';
import type { BunqMockState } from './state.js';

const MIN_ACCEPTED_BODY = {
  NotificationUrl: {
    target_url: 'http://127.0.0.1:3001/webhooks/bunq',
    category: 'REQUEST',
    event_type: 'REQUEST_INQUIRY_ACCEPTED',
    object: {
      RequestInquiry: {
        id: 0 as number,
        status: 'ACCEPTED',
        bunqme_share_url: null as string | null,
      },
    },
  },
};

function markRequestInquiryAcceptedInState(state: BunqMockState, inquiryId: number): boolean {
  for (const session of state.sessions.values()) {
    const row = session.requestInquiries.get(inquiryId);
    if (row) {
      row.status = 'ACCEPTED';
      return true;
    }
  }
  return false;
}

function controlAuth(expectedToken: string | undefined) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!expectedToken) {
      return next();
    }
    const got = req.headers['x-bunq-mock-control-token'];
    if (got !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
}

export function createControlApp(state: BunqMockState, options?: { controlToken?: string }): express.Express {
  const app = express();
  app.use(express.json());
  app.use(controlAuth(options?.controlToken));

  app.post('/reset', (_req, res) => {
    state.installations.clear();
    state.sessions.clear();
    state.lastWebhookTarget = null;
    state.nextInquiryId = 900_001;
    res.json({ ok: true });
  });

  app.post('/webhooks/deliver-request-inquiry-accepted', async (req, res) => {
    const body = req.body as {
      requestInquiryId?: string | number;
      targetUrlOverride?: string;
    };
    const id = body.requestInquiryId;
    if (id === undefined || id === null || id === '') {
      return res.status(400).json({ error: 'requestInquiryId is required' });
    }
    const idNum = typeof id === 'number' ? id : parseInt(String(id), 10);
    if (Number.isNaN(idNum)) {
      return res.status(400).json({ error: 'requestInquiryId must be numeric' });
    }

    const defaultTarget =
      process.env.BUNQ_MOCK_WEBHOOK_TARGET || 'http://127.0.0.1:3001/webhooks/bunq';
    const targetUrl = body.targetUrlOverride || state.lastWebhookTarget || defaultTarget;

    const payload = {
      ...MIN_ACCEPTED_BODY,
      NotificationUrl: {
        ...MIN_ACCEPTED_BODY.NotificationUrl,
        target_url: targetUrl,
        object: {
          RequestInquiry: {
            id: idNum,
            status: 'ACCEPTED',
            bunqme_share_url: null,
          },
        },
      },
    };

    markRequestInquiryAcceptedInState(state, idNum);

    try {
      const r = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      res.json({
        ok: r.ok,
        status: r.status,
        targetUrl,
        responseSnippet: text.slice(0, 200),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      res.status(502).json({ error: 'Webhook delivery failed', detail: message, targetUrl });
    }
  });

  app.post('/request-inquiries/:inquiryId/mark-accepted', (req, res) => {
    const idNum = parseInt(req.params.inquiryId, 10);
    if (Number.isNaN(idNum)) {
      return res.status(400).json({ error: 'inquiryId must be numeric' });
    }
    if (!markRequestInquiryAcceptedInState(state, idNum)) {
      return res.status(404).json({ error: 'Request inquiry not found' });
    }
    res.json({ ok: true, inquiryId: idNum, status: 'ACCEPTED' });
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'bunq-mock-control' });
  });

  return app;
}
