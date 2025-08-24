import { logDebug } from '../debug';

export interface RetryOptions {
  retries?: number;      // number of retries (not counting the first try)
  delayMs?: number;      // base delay in ms
  factor?: number;       // exponential factor
}

// Simple retry helper with exponential backoff
export const withRetry = async <T>(
  fn: () => Promise<T>,
  opts?: RetryOptions
): Promise<T> => {
  const retries = opts?.retries ?? 3;
  const baseDelay = opts?.delayMs ?? 500;
  const factor = opts?.factor ?? 2;

  let attempt = 0;
  let lastErr: any;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // retry only on network errors (no response object)
      const isNetworkError = !err?.response;
      if (!isNetworkError || attempt === retries) {
        throw err;
      }
      const delay = baseDelay * Math.pow(factor, attempt);
      logDebug(`Request failed (attempt ${attempt + 1}/${retries + 1}). Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
      attempt++;
    }
  }
  throw lastErr;
};
