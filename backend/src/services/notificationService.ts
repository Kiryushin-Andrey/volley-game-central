import { sendTelegramNotification } from './telegramService';
import { sendSms } from './smsService';

export type NotifyChannel = 'telegram' | 'sms' | 'none';

export interface NotifiableUser {
  telegramId?: string | null;
  phoneNumber?: string | null;
  displayName?: string | null;
}

// Replace <a href="URL">text</a> with "text (URL)" for SMS
function replaceAnchorsWithUrls(html: string): string {
  return html.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_m, url, text) => {
    const cleanText = String(text).replace(/<[^>]*>/g, '');
    return `${cleanText} (${url})`;
  });
}

// Strip remaining HTML tags for SMS
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function htmlToSms(message: string): string {
  // First convert anchors to readable text with URLs, then strip other tags
  const withUrls = replaceAnchorsWithUrls(message);
  const noHtml = stripHtml(withUrls);
  // Collapse excessive whitespace
  return noHtml.replace(/\s+/g, ' ').trim();
}

/**
 * Notify a user via Telegram when possible, otherwise via SMS if phone number is present.
 * Returns the channel used.
 */
export async function notifyUser(
  user: NotifiableUser,
  message: string,
  options?: { allowSms?: boolean }
): Promise<NotifyChannel> {
  try {
    if (user.telegramId) {
      await sendTelegramNotification(user.telegramId, message);
      return 'telegram';
    }
    const allowSms = options?.allowSms !== false; // default: true
    if (allowSms && user.phoneNumber) {
      const sms = htmlToSms(message);
      await sendSms(user.phoneNumber, sms);
      return 'sms';
    }
    console.warn('notifyUser: no telegramId or phoneNumber for user', user.displayName ?? 'unknown');
    return 'none';
  } catch (err) {
    console.error('notifyUser failed:', err);
    return 'none';
  }
}
