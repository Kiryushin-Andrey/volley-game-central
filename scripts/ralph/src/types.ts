import { join } from "node:path";
import { isRemoteWorker, remoteProvider, type RemoteProvider, type WorkerKind } from "./workers/types.js";

/** Project-wide Playwright scenario checklist (feature-agnostic). */
export const DEFAULT_E2E_SCENARIOS = "docs/playwright-e2e-scenarios.md";

export type { RemoteProvider, WorkerKind };

export interface RalphConfig {
  repo: string;
  repoUrl: string;
  parentIssue: number;
  childIssues: number[];
  branch: string;
  base: string;
  context: string;
  prd: string;
  e2e: string;
  stateDir: string;
  promptsDir: string;
  /** Slice worker: local-* (CLI on PATH) or remote-* (cloud APIs). */
  worker: WorkerKind;
  cursorApiKey: string | undefined;
  warpApiKey: string | undefined;
  /** Oz cloud environment UID (required for remote-oz). */
  ozEnvironmentId: string | undefined;
  ozModelId: string | undefined;
  ozConfigName: string | undefined;
  cloudPollInterval: number;
  cloudEnv: Record<string, string>;
  /** Cursor Cloud Agents model id (API). `"default"` = Auto. */
  cloudModel: string;
  cloudCreatePrOnFinal: boolean;
  maxSlice: number;
  dryRun: boolean;
  push: boolean;
  once: boolean;
  maxTotalIterations: number;
  feedbackLoops: readonly string[];
}

export function cfgIsRemote(cfg: RalphConfig): boolean {
  return isRemoteWorker(cfg.worker);
}

export function cfgRemoteProvider(cfg: RalphConfig): RemoteProvider | null {
  if (!isRemoteWorker(cfg.worker)) return null;
  return remoteProvider(cfg.worker);
}

export function logsDir(cfg: RalphConfig): string {
  return join(cfg.stateDir, "logs");
}

export function progressFile(cfg: RalphConfig): string {
  return join(cfg.stateDir, "progress.txt");
}

export function progressTemplateFile(cfg: RalphConfig): string {
  return join(cfg.stateDir, "progress.template.txt");
}

export function steeringFile(cfg: RalphConfig): string {
  return join(cfg.stateDir, "STEERING.md");
}

export function screenshotsDir(cfg: RalphConfig): string {
  return join(cfg.stateDir, "screenshots");
}
