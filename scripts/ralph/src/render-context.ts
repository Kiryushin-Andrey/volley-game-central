import { existsSync } from "node:fs";
import { detectRepoSlug, repoSlugToUrl } from "./git.js";
import type { RalphConfigFile } from "./config.js";
import { progressPath, steeringPath } from "./paths.js";
import type { RalphPhase } from "./plan.js";
import type { PromptContext } from "./prompts.js";
import { isRemoteWorker, workerAgentName } from "./workers/types.js";

export function issueUrl(cfg: RalphConfigFile, repo: string, number: number): string {
  return `https://github.com/${repo}/issues/${number}`;
}

export function buildPromptContext(
  cfg: RalphConfigFile,
  root: string,
  phase: RalphPhase,
  opts?: { bootstrap?: boolean },
): PromptContext {
  const repo = cfg.repo ?? detectRepoSlug(root);
  const steer = steeringPath(cfg.stateDir);
  const ctx: PromptContext = {
    prd: cfg.prd,
    context: cfg.context,
    e2e: cfg.e2e,
    progress_file: progressPath(cfg.stateDir),
    sessions_file: `${cfg.stateDir}/sessions.log`,
    config_file: `${cfg.stateDir}/ralph.config.json`,
    branch: cfg.branch,
    base: cfg.base,
    parent_issue: cfg.parentIssue,
    child_issues: cfg.childIssues.join(" "),
    has_steering: existsSync(steer),
    steering_file: steer,
    is_remote: isRemoteWorker(cfg.worker),
    worker: cfg.worker,
    worker_agent: workerAgentName(cfg.worker),
    feedback_loops: cfg.feedbackLoops.map((item) => `- ${item}`).join("\n"),
    bootstrap: opts?.bootstrap === true,
    screenshots_dir: `${cfg.stateDir}/screenshots`,
    is_last_issue: false,
    closes_clause: "",
  };

  if (phase.type === "issue") {
    ctx.has_issue = true;
    ctx.issue_number = phase.issueNumber;
    ctx.issue_url = issueUrl(cfg, repo, phase.issueNumber);
    const last = cfg.childIssues[cfg.childIssues.length - 1];
    if (phase.issueNumber === last) {
      ctx.is_last_issue = true;
      ctx.closes_clause = cfg.childIssues.map((n) => `Closes #${n}`).join(", ");
    }
  } else {
    ctx.has_issue = false;
  }

  if (phase.type === "done") {
    ctx.is_done = true;
  }

  return ctx;
}

export function resolveRepoUrl(cfg: RalphConfigFile, root: string): string {
  if (cfg.repoUrl) return cfg.repoUrl;
  const slug = cfg.repo ?? detectRepoSlug(root);
  return repoSlugToUrl(slug);
}
