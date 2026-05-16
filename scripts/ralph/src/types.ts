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
  stateFile: string;
  promptsDir: string;
  backend: Backend;
  agentCmd: string;
  cursorApiKey: string | undefined;
  cloudPollInterval: number;
  cloudEnv: Record<string, string>;
  cloudCreatePrOnFinal: boolean;
  maxSlice: number;
  dryRun: boolean;
  fromIssue: number;
  push: boolean;
  once: boolean;
  maxTotalIterations: number;
  feedbackLoops: readonly string[];
}

export interface RalphState {
  parent_issue: number;
  child_issues: number[];
  branch: string;
  prd: string;
  e2e: string;
  backend: Backend;
  completed_issues: number[];
  completed_e2e_suites: string[];
  cloud_sessions: { title: string; url: string; at: string }[];
  final_complete: boolean;
  issue_item_passes?: Record<string, number>;
}

export function logsDir(cfg: RalphConfig): string {
  return join(cfg.stateDir, "logs");
}

export function progressFile(cfg: RalphConfig): string {
  return join(cfg.stateDir, "progress.txt");
}

export function steeringFile(cfg: RalphConfig): string {
  return join(cfg.stateDir, "STEERING.md");
}

export function screenshotsDir(cfg: RalphConfig): string {
  return join(cfg.stateDir, "screenshots");
}
