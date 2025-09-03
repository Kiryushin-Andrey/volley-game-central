import { Router, Request } from 'express';
import { db } from '../db';
import { paymentRequests, gameRegistrations } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { bunqService } from '../services/bunqService';

const router = Router();

// --- Types for Bunq webhook payload ---
interface BunqWebhookImageUrl {
  type: string;
  url: string;
}

interface BunqWebhookAvatarImage {
  attachment_public_uuid: string;
  height: number;
  width: number;
  content_type: string;
  urls: BunqWebhookImageUrl[];
}

interface BunqWebhookAvatar {
  uuid: string | null;
  image: BunqWebhookAvatarImage[];
  anchor_uuid: string | null;
  style: string;
}

interface BunqWebhookLabelUser {
  uuid: string;
  display_name: string;
  country: string;
  avatar: BunqWebhookAvatar;
  public_nick_name: string;
  type: string;
}

interface BunqWebhookAlias {
  iban: string;
  is_light: boolean;
  display_name: string;
  avatar: BunqWebhookAvatar;
  label_user: BunqWebhookLabelUser;
  country: string;
}

interface BunqWebhookAmount {
  currency: string;
  value: string; // decimal in string, e.g. "1.00"
}

interface BunqWebhookRequestResponse {
  id: number;
  created: string;
  updated: string;
  time_responded: string | null;
  time_expiry: string | null;
  monetary_account_id: number;
  amount_inquired: BunqWebhookAmount;
  amount_responded: BunqWebhookAmount;
  status: BunqRequestStatus | string; // not exhaustive; see enum below
  description: string;
  alias: BunqWebhookAlias;
  label_user: BunqWebhookLabelUser;
  country: string;
  counterparty_alias: BunqWebhookAlias;
  type: string; // e.g., "BUNQME"
  sub_type: string; // e.g., "NONE"
}

interface BunqWebhookRequestInquiry {
  id: number;
  created: string;
  updated: string;
  time_responded: string | null;
  time_expiry: string | null;
  monetary_account_id: number;
  amount_inquired: BunqWebhookAmount;
  amount_responded: BunqWebhookAmount;
  status: BunqRequestStatus | string; // e.g., "ACCEPTED"
  description: string;
  user_alias_created: BunqWebhookAlias;
  country: string;
  counterparty_alias: BunqWebhookAlias;
  type: string;
  sub_type: string;
  bunqme_share_url: string | null;
}

interface BunqWebhookObject {
  RequestResponse?: BunqWebhookRequestResponse;
  RequestInquiry?: BunqWebhookRequestInquiry;
}

// Callback categories from bunq documentation
export enum BunqCallbackCategory {
  BILLING = 'BILLING',
  CARD_TRANSACTION_SUCCESSFUL = 'CARD_TRANSACTION_SUCCESSFUL',
  CARD_TRANSACTION_FAILED = 'CARD_TRANSACTION_FAILED',
  CHAT = 'CHAT',
  DRAFT_PAYMENT = 'DRAFT_PAYMENT',
  IDEAL = 'IDEAL',
  SOFORT = 'SOFORT',
  MUTATION = 'MUTATION',
  OAUTH = 'OAUTH',
  PAYMENT = 'PAYMENT',
  REQUEST = 'REQUEST',
  SCHEDULE_RESULT = 'SCHEDULE_RESULT',
  SCHEDULE_STATUS = 'SCHEDULE_STATUS',
  SHARE = 'SHARE',
  TAB_RESULT = 'TAB_RESULT',
  BUNQME_TAB = 'BUNQME_TAB',
  SUPPORT = 'SUPPORT',
}

// Common REQUEST event types seen for RequestInquiry/RequestResponse
// Note: bunq does not publish a single canonical list per object; this covers typical cases
export enum BunqRequestEventType {
  REQUEST_INQUIRY_CREATED = 'REQUEST_INQUIRY_CREATED',
  REQUEST_INQUIRY_UPDATED = 'REQUEST_INQUIRY_UPDATED',
  REQUEST_INQUIRY_CANCELLED = 'REQUEST_INQUIRY_CANCELLED',
  REQUEST_INQUIRY_EXPIRED = 'REQUEST_INQUIRY_EXPIRED',
  REQUEST_INQUIRY_ACCEPTED = 'REQUEST_INQUIRY_ACCEPTED',
  REQUEST_RESPONSE_CREATED = 'REQUEST_RESPONSE_CREATED',
  REQUEST_RESPONSE_UPDATED = 'REQUEST_RESPONSE_UPDATED',
  REQUEST_RESPONSE_ACCEPTED = 'REQUEST_RESPONSE_ACCEPTED',
  REQUEST_RESPONSE_REJECTED = 'REQUEST_RESPONSE_REJECTED',
  REQUEST_RESPONSE_REVOKED = 'REQUEST_RESPONSE_REVOKED',
  REQUEST_RESPONSE_EXPIRED = 'REQUEST_RESPONSE_EXPIRED',
}

// Common statuses observed for RequestInquiry/RequestResponse objects in callbacks
export enum BunqRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  REVOKED = 'REVOKED',
}

interface BunqWebhookNotificationUrl {
  target_url: string;
  category: BunqCallbackCategory;
  // bunq does not publish a canonical exhaustive list of event types; allow unknown strings as well
  event_type: BunqRequestEventType | string;
  object: BunqWebhookObject;
}

export interface BunqWebhookRequestBody {
  NotificationUrl: BunqWebhookNotificationUrl;
}

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
// Mount path: /webhooks/bunq (see index.ts)
router.post('/bunq', async (req: Request<{}, any, BunqWebhookRequestBody>, res) => {
  // Acknowledge immediately to avoid retries/timeouts; process async but we still await DB update
  res.status(200).send('OK');

  try {
    const body = req.body;
    const eventType = body?.NotificationUrl?.event_type;
    const category = body?.NotificationUrl?.category;
    const requestInquiry = body?.NotificationUrl?.object?.RequestInquiry;

    if (category !== BunqCallbackCategory.REQUEST || eventType !== BunqRequestEventType.REQUEST_INQUIRY_ACCEPTED || !requestInquiry) {
      return;
    }

    // Match by RequestInquiry.id exactly to our payment_requests.paymentRequestId
    const inquiryId = String(requestInquiry.id);
    if (!inquiryId) {
      console.warn('[Bunq Webhook] Missing RequestInquiry.id');
      return;
    }

    // Update payment request flags immediately
    const result = await db
      .update(paymentRequests)
      .set({
        webhookReceived: true,
        paid: true,
      })
      .where(
        and(
          eq(paymentRequests.paymentRequestId, inquiryId),
          eq(paymentRequests.paid, false),
          eq(paymentRequests.webhookReceived, false)
        )
      );

    // Fetch the related registration to update its paid status as well (no join needed)
    const paymentRequest = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.paymentRequestId, inquiryId))
      .limit(1)
      .then(rows => rows[0]);

    const registration = await db
      .select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.id, paymentRequest.gameRegistrationId))
      .limit(1)
      .then(rows => rows[0]);

    await bunqService.updatePaidStatus(registration.gameId, registration.userId, true);

    console.log(`[Bunq Webhook] Payment request accepted: ${inquiryId}, gameId=${registration.gameId}, userId=${registration.userId}`);
  } catch (e) {
    console.error('[Bunq Webhook] Processing error:', e);
  }
});

export default router;
