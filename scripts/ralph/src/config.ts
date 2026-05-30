import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_E2E_SCENARIOS } from "./constants.js";
import { parseWorkerKind, type WorkerKind } from "./workers/types.js";

export interface RalphConfigFile {
  version: 1;
  parentIssue: number;
  childIssues: number[];
  branch: string;
  base: string;
  repo?: string;
  repoUrl?: string;
  context: string;
  prd: string;
  e2e: string;
  stateDir: string;
  promptsDir: string;
  worker: WorkerKind;
  push: boolean;
  feedbackLoops: string[];
  cloudModel?: string;
  ozEnvironmentId?: string;
  ozModelId?: string;
  ozConfigName?: string;
}

export const DEFAULT_STATE_DIR = ".ralph";
export const CONFIG_FILENAME = "ralph.config.json";
export const SESSIONS_FILENAME = "sessions.log";
export const SESSIONS_TEMPLATE = "sessions.template.txt";

export function configPath(stateDir: string): string {
  return join(stateDir, CONFIG_FILENAME);
}

export function sessionsPath(stateDir: string): string {
  return join(stateDir, SESSIONS_FILENAME);
}

export function progressTemplatePath(stateDir: string): string {
  return join(stateDir, "progress.template.txt");
}

export function sessionsTemplatePath(stateDir: string): string {
  return join(stateDir, SESSIONS_TEMPLATE);
}

export function loadConfig(stateDir = DEFAULT_STATE_DIR): RalphConfigFile {
  const path = configPath(stateDir);
  if (!existsSync(path)) {
    throw new Error(
      `Ralph config not found: ${path}\nRun bootstrap (ralph skill) to create ${CONFIG_FILENAME} on the integration branch.`,
    );
  }
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Partial<RalphConfigFile>;
  return normalizeConfig(raw, stateDir);
}

function normalizeConfig(raw: Partial<RalphConfigFile>, stateDir: string): RalphConfigFile {
  if (raw.version !== 1) {
    throw new Error(`ralph.config.json version must be 1, got: ${JSON.stringify(raw.version)}`);
  }
  const parentIssue = raw.parentIssue;
  const childIssues = raw.childIssues;
  const branch = raw.branch;
  const prd = raw.prd;
  if (parentIssue === undefined || !childIssues?.length || !branch || !prd) {
    throw new Error(
      "ralph.config.json requires parentIssue, childIssues (non-empty), branch, and prd",
    );
  }
  const worker = parseWorkerKind(raw.worker ?? "local-cursor");
  return {
    version: 1,
    parentIssue,
    childIssues: [...childIssues],
    branch,
    base: raw.base ?? "main",
    repo: raw.repo,
    repoUrl: raw.repoUrl,
    context: raw.context ?? "CONTEXT.md",
    prd,
    e2e: raw.e2e ?? DEFAULT_E2E_SCENARIOS,
    stateDir: raw.stateDir ?? stateDir,
    promptsDir: raw.promptsDir ?? join(stateDir, "prompts"),
    worker,
    push: raw.push ?? false,
    feedbackLoops: raw.feedbackLoops ?? [
      "Backend TypeScript: cd backend && npm run build",
      "Frontend TypeScript: cd tg-mini-app && npm run build",
    ],
    cloudModel: raw.cloudModel ?? "default",
    ozEnvironmentId: raw.ozEnvironmentId,
    ozModelId: raw.ozModelId,
    ozConfigName: raw.ozConfigName ?? "ralph-recursive",
  };
}
