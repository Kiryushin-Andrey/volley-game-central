import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Log file appended for each new remote worker session (orchestrator can Read while loop runs). */
export const LIVE_SESSIONS_LOG = "live-sessions.log";

/**
 * Loud, grep-friendly marker for orchestrators. Printed to stdout and stderr and
 * appended under `<stateDir>/logs/live-sessions.log` so agents can poll and paste
 * URLs into user-visible chat messages (not only collapsed shell output).
 */
export function announceCloudSession(
  stateDir: string,
  title: string,
  url: string,
): void {
  const line = `RALPH_CLOUD_SESSION ${title} ${url}`;
  const payload = `${line}\n`;
  process.stdout.write(payload);
  process.stderr.write(payload);
  const logPath = join(stateDir, "logs", LIVE_SESSIONS_LOG);
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, payload, "utf-8");
}
