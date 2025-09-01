import { Router } from 'express';

const router = Router();

// Twilio Messaging status callback webhook
// Docs: https://www.twilio.com/docs/messaging/guides/webhook-request
router.post('/twilio/sms-status', (req, res) => {
  // Twilio sends application/x-www-form-urlencoded by default; express.urlencoded is enabled globally
  const {
    MessageSid,
    MessageStatus,
    To,
    From,
    ErrorCode,
    ErrorMessage,
  } = req.body || {};

  // Log only error cases (failed/undelivered or any error code)
  const status = (MessageStatus || '').toLowerCase();
  const hasError = !!ErrorCode || status === 'failed' || status === 'undelivered';

  if (hasError) {
    console.error(
      `[Twilio SMS Error] sid=${MessageSid || 'n/a'} to=${To || 'n/a'} from=${From || 'n/a'} status=${MessageStatus || 'n/a'} code=${ErrorCode || 'n/a'} msg=${ErrorMessage || 'n/a'}`
    );
  }

  // Always respond 200 OK quickly
  res.status(200).send('OK');
});

// Bunq webhook: outgoing payment request paid (or other Bunq events)
// We'll just log the headers and body for now and acknowledge.
// Mount path: /webhooks/bunq (see index.ts)
router.post('/bunq', (req, res) => {
  try {
    // Log headers for debugging (may include signature fields)
    console.log('[Bunq Webhook] headers:', JSON.stringify(req.headers));
    // Log raw body
    console.log('[Bunq Webhook] body:', JSON.stringify(req.body));
  } catch (e) {
    console.error('[Bunq Webhook] Failed to log request:', e);
  }

  // Acknowledge immediately
  res.status(200).send('OK');
});

export default router;
