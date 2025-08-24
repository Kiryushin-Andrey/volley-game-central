import { Twilio } from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const MINI_APP_URL = process.env.MINI_APP_URL;

// Derive status callback from MINI_APP_URL, trimming any trailing slash
const STATUS_CALLBACK_URL = MINI_APP_URL
  ? `${MINI_APP_URL.replace(/\/$/, '')}/webhooks/twilio/sms-status`
  : undefined;

let twilioClient: Twilio | null = null;
// Prefer API Key auth when provided; otherwise fall back to classic auth
if (API_KEY_SID && API_KEY_SECRET && ACCOUNT_SID) {
  twilioClient = new Twilio(API_KEY_SID, API_KEY_SECRET, { accountSid: ACCOUNT_SID });
} else if (ACCOUNT_SID && AUTH_TOKEN) {
  twilioClient = new Twilio(ACCOUNT_SID, AUTH_TOKEN);
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (twilioClient && TWILIO_MESSAGING_SERVICE_SID) {
    await twilioClient.messages.create({
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      to,
      body,
      ...(STATUS_CALLBACK_URL ? { statusCallback: STATUS_CALLBACK_URL } : {}),
    });
  } else {
    // Throw when Twilio is not configured (no silent fallback)
    const missingClassic: string[] = [];
    if (!ACCOUNT_SID) missingClassic.push('TWILIO_ACCOUNT_SID');
    if (!AUTH_TOKEN) missingClassic.push('TWILIO_AUTH_TOKEN');

    const missingApiKey: string[] = [];
    if (!ACCOUNT_SID) missingApiKey.push('TWILIO_ACCOUNT_SID');
    if (!API_KEY_SID) missingApiKey.push('TWILIO_API_KEY_SID');
    if (!API_KEY_SECRET) missingApiKey.push('TWILIO_API_KEY_SECRET');

    const missingShared: string[] = [];
    if (!TWILIO_MESSAGING_SERVICE_SID) missingShared.push('TWILIO_MESSAGING_SERVICE_SID');

    const messageLines: string[] = [
      'Cannot send SMS: Twilio not configured. Provide either:',
      ' - Classic: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN',
      ' - API Key: TWILIO_ACCOUNT_SID + TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET',
    ];

    const details: string[] = [];
    if (missingClassic.length) details.push(`Missing (classic): ${missingClassic.join(', ')}`);
    if (missingApiKey.length) details.push(`Missing (api key): ${missingApiKey.join(', ')}`);
    if (missingShared.length) details.push(`Missing: ${missingShared.join(', ')}`);

    const suffix = details.length ? ` ${details.join(' | ')}` : '';
    throw new Error(messageLines.join('\n') + suffix);
  }
}

