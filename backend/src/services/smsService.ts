import { Twilio } from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const MINI_APP_URL = process.env.MINI_APP_URL;

// Derive status callback from MINI_APP_URL, trimming any trailing slash
const STATUS_CALLBACK_URL = MINI_APP_URL
  ? `${MINI_APP_URL.replace(/\/$/, '')}/webhooks/twilio/sms-status`
  : undefined;

let twilioClient: Twilio | null = null;
if (API_KEY_SID && API_KEY_SECRET && ACCOUNT_SID) {
  twilioClient = new Twilio(API_KEY_SID, API_KEY_SECRET, { accountSid: ACCOUNT_SID });
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
    const missingEnvVars: string[] = [];
    if (!ACCOUNT_SID) missingEnvVars.push('TWILIO_ACCOUNT_SID');
    if (!API_KEY_SID) missingEnvVars.push('TWILIO_API_KEY_SID');
    if (!API_KEY_SECRET) missingEnvVars.push('TWILIO_API_KEY_SECRET');
    if (!TWILIO_MESSAGING_SERVICE_SID) missingEnvVars.push('TWILIO_MESSAGING_SERVICE_SID');

    const messageLines: string[] = [
      'Cannot send SMS: Twilio not configured.',
    ];

    if (missingEnvVars.length)
      messageLines.push(`Missing: ${missingEnvVars.join(', ')}`);

    throw new Error(messageLines.join('\n'));
  }
}

