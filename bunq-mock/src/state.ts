import { randomBytes } from 'crypto';

export type MonetaryAccountRow = {
  id: number;
  description: string;
  status: string;
};

export type RequestInquiryRow = {
  id: number;
  userId: number;
  monetaryAccountId: number;
  status: string;
  bunqme_share_url: string;
  description: string;
};

export type SessionState = {
  bunqUserId: number;
  monetaryAccounts: MonetaryAccountRow[];
  requestInquiries: Map<number, RequestInquiryRow>;
  webhookTargets: string[];
};

export type BunqMockState = {
  installations: Map<string, { deviceRegistered: boolean }>;
  sessions: Map<string, SessionState>;
  lastWebhookTarget: string | null;
  nextInquiryId: number;
};

export function createInitialState(): BunqMockState {
  return {
    installations: new Map(),
    sessions: new Map(),
    lastWebhookTarget: null,
    nextInquiryId: 900_001,
  };
}

export function randomInstallationToken(): string {
  return `inst_${randomBytes(16).toString('hex')}`;
}

export function randomSessionToken(): string {
  return `sess_${randomBytes(16).toString('hex')}`;
}

export function defaultSessionState(): SessionState {
  const bunqUserId = 1001;
  const monetaryAccounts: MonetaryAccountRow[] = [
    { id: 2001, description: 'E2E mock EUR account', status: 'ACTIVE' },
  ];
  return {
    bunqUserId,
    monetaryAccounts,
    requestInquiries: new Map(),
    webhookTargets: [],
  };
}
