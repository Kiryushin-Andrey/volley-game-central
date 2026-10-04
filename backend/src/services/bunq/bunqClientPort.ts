/**
 * Narrow HTTP surface used by Bunq payment-request code.
 * Allows in-memory fakes without axios or installation/session setup.
 */
export interface BunqHttpClient {
  get(url: string, config?: unknown): Promise<{ status: number; data: any }>;
  post(url: string, data?: unknown, config?: unknown): Promise<{ status: number; data: any }>;
}

/** Authenticated Bunq client plus account context needed for request-inquiry calls. */
export interface BunqAuthenticatedClient {
  client: BunqHttpClient;
  monetaryAccountId: number;
  privateKey: string;
}

export interface BunqClientParams {
  userId: number;
  password: string;
}

/**
 * Port for obtaining an authenticated Bunq client.
 * Payment modules depend on this instead of installation/session internals.
 */
export interface BunqClientPort {
  createClient(params: BunqClientParams): Promise<BunqAuthenticatedClient | null>;
}
