import { join } from "node:path";

export type Backend = "local" | "cloud";

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
  cursorApiKey: string | undefined;
  cloudPollInterval: number;
  cloudEnv: Record<string, string>;
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
