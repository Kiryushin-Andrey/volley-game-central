import { readFileSync } from "node:fs";
import type { RalphConfigFile } from "./config.js";
import { progressPath } from "./paths.js";
import { loadProgressResume } from "./progress-state.js";
import { textHasPromise } from "./sigil.js";

export type RalphPhase =
  | { type: "issue"; issueNumber: number }
  | { type: "final" }
  | { type: "done" };

export function pickNextPhase(cfg: RalphConfigFile, progressContent: string): RalphPhase {
  const resume = loadProgressResume(progressContent, cfg.childIssues);
  for (const n of cfg.childIssues) {
    if (!resume.completedIssues.has(n)) {
      return { type: "issue", issueNumber: n };
    }
  }
  if (!resume.finalComplete && !textHasPromise(progressContent, "RALPH_ALL_COMPLETE")) {
    return { type: "final" };
  }
  return { type: "done" };
}

export function readProgressContent(cfg: RalphConfigFile): string {
  try {
    return readFileSync(progressPath(cfg.stateDir), "utf-8");
  } catch {
    return "";
  }
}

export function planNext(cfg: RalphConfigFile): RalphPhase {
  return pickNextPhase(cfg, readProgressContent(cfg));
}
