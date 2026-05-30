import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { sessionsPath, sessionsTemplatePath } from "./config.js";
import type { RalphConfigFile } from "./config.js";

const SESSIONS_HEADER_FALLBACK = "# session_ref\tnotes\n";

/** Append one line to sessions.log (tab-separated; committed by caller). */
export function appendSessionLine(
  cfg: RalphConfigFile,
  fields: {
    sessionRef: string;
    notes: string;
  },
): void {
  const path = sessionsPath(cfg.stateDir);
  if (!existsSync(path)) {
    const template = sessionsTemplatePath(cfg.stateDir);
    if (existsSync(template)) {
      writeFileSync(path, readFileSync(template, "utf-8"), "utf-8");
    } else {
      writeFileSync(path, SESSIONS_HEADER_FALLBACK, "utf-8");
    }
  }
  const line = [fields.sessionRef, fields.notes]
    .map((c) => c.replace(/\t/g, " "))
    .join("\t");
  appendFileSync(path, `${line}\n`, "utf-8");
}

export function formatSessionStdout(role: string, sessionRef: string, notes: string): void {
  console.log(`RALPH_SESSION ${role} ${sessionRef} ${notes}`);
}
