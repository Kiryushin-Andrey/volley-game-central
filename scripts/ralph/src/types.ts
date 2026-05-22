import { join } from "node:path";

/** Project-wide Playwright scenario checklist (feature-agnostic). */
export const DEFAULT_E2E_SCENARIOS = "docs/playwright-e2e-scenarios.md";

export type Backend = "local" | "cloud";

/** Remote agent platform when `backend` is `cloud`. */
export type CloudProvider = "cursor" | "oz";

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
  backend: Backend;
  agentCmd: string;
  /** Which cloud platform runs child/orchestrator agents (default: cursor). */
  cloudProvider: CloudProvider;
  cursorApiKey: string | undefined;
  warpApiKey: string | undefined;
  /** Oz cloud environment UID (required when cloudProvider is oz). */
  ozEnvironmentId: string | undefined;
  /** Oz AmbientAgentConfig.model_id (optional). */
  ozModelId: string | undefined;
  /** Oz AmbientAgentConfig.name for run grouping (optional). */
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
