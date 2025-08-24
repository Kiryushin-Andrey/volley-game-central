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

export default router;
