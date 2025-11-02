/**
 * Dev mode utility for local development
 * Enables simplified authentication and suppresses notifications
 */

/**
 * Check if dev mode is enabled via environment variable
 */
export function isDevMode(): boolean {
  return process.env.DEV_MODE === 'true';
}

/**
 * Log a dev mode message to console
 */
export function logDevMode(message: string): void {
  if (isDevMode()) {
    console.log(`[DEV MODE] ${message}`);
  }
}
