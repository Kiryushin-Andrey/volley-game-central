import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { createCloudAgentRunnerFromRalph } from "./agents/factory.js";
import type { CloudAgentRunner } from "./agents/types.js";
import {
  commandExists,
  commitPaths,
  detectRepoSlug,
  maybePush,
  repoSlugToUrl,
  syncSprintBranch,
} from "./git.js";
import { type PromptContext, PromptLoader } from "./prompts.js";
import { emptyResume, readProgressResume, type ProgressResume } from "./progress-state.js";
import { promiseIssueComplete, textHasIssueComplete, textHasPromise } from "./sigil.js";
import type { RalphConfig } from "./types.js";
import {
  cfgIsRemote,
  cfgRemoteProvider,
  logsDir,
  progressFile,
  progressTemplateFile,
  screenshotsDir,
  steeringFile,
} from "./types.js";
import { buildLocalInvocation } from "./workers/registry.js";
import type { LocalWorkerKind } from "./workers/types.js";
import { workerAgentName } from "./workers/types.js";

export class RalphLoop {
  cfg: RalphConfig;
  readonly prompts: PromptLoader;
  issueNumbers: number[] = [];
  private resume: ProgressResume = emptyResume();
  private readonly cloudSessions: { title: string; url: string }[] = [];
  lastLog: string | null = null;
  agentRuns = 0;

  constructor(
    cfg: RalphConfig,
    readonly root: string,
  ) {
    this.cfg = { ...cfg };
    this.prompts = new PromptLoader(cfg.promptsDir);
    if (!this.cfg.repo) {
      this.cfg.repo = detectRepoSlug(root);
    }
    if (!this.cfg.repoUrl) {
      this.cfg.repoUrl = repoSlugToUrl(this.cfg.repo);
    }
  }

  private cloudRunner(): CloudAgentRunner {
    return createCloudAgentRunnerFromRalph(this.cfg);
  }

  issueUrl(number: number): string {
    return `https://github.com/${this.cfg.repo}/issues/${number}`;
  }

  loadChildIssues(): void {
    this.issueNumbers = [...this.cfg.childIssues].sort((a, b) => a - b);
    if (this.issueNumbers.length === 0) {
      console.error("--child-issues must list at least one issue number.");
      process.exit(1);
    }
  }

  closesClause(): string {
    return this.issueNumbers.map((n) => `Closes #${n}`).join(", ");
  }

  private reloadResumeFromBranch(): void {
    this.resume = readProgressResume(progressFile(this.cfg), this.issueNumbers);
  }

  /** Pull sprint branch and parse completion sigils from progress.txt (source of truth). */
  private syncProgressFromBranch(): void {
    if (!this.cfg.dryRun) {
      syncSprintBranch(this.root, this.cfg.branch, this.cfg.base);
    }
    this.reloadResumeFromBranch();
  }

  private logResumePlan(): void {
    const done = [...this.resume.completedIssues].sort((a, b) => a - b);
    if (done.length) {
      console.log(`Resume: skipping completed issues from progress.txt: ${done.join(", ")}`);
    }
    if (this.resume.finalComplete) {
      console.log("Resume: RALPH_ALL_COMPLETE already in progress.txt — will skip child/final work.");
    }
  }

  initProgress(): void {
    mkdirSync(this.cfg.stateDir, { recursive: true });
    mkdirSync(logsDir(this.cfg), { recursive: true });
    mkdirSync(screenshotsDir(this.cfg), { recursive: true });

    const progress = progressFile(this.cfg);
    const progressRel = join(this.cfg.stateDir, "progress.txt");
    if (!existsSync(progress)) {
      const template = progressTemplateFile(this.cfg);
      if (!existsSync(template)) {
        throw new Error(`Progress template not found: ${template}`);
      }
      writeFileSync(progress, readFileSync(template, "utf-8"), "utf-8");
      if (this.cfg.push && !this.cfg.dryRun) {
        commitPaths(
          this.root,
          [progressRel],
          "ralph: seed progress log",
          this.cfg.branch,
          true,
        );
      }
    }
  }

  issueDone(n: number): boolean {
    return this.resume.completedIssues.has(n);
  }

  finalDone(): boolean {
    return this.resume.finalComplete;
  }

  private markIssueDone(n: number): void {
    this.resume.completedIssues.add(n);
  }

  private markFinalDone(): void {
    this.resume.finalComplete = true;
  }

  private recordCloudSession(title: string, url: string): void {
    this.cloudSessions.push({ title, url });
  }

  private logHasPromise(logPath: string, promise: string): boolean {
    if (!existsSync(logPath)) return false;
    return textHasPromise(readFileSync(logPath, "utf-8"), promise);
  }

  private logHasIssueComplete(logPath: string, n: number): boolean {
    if (!existsSync(logPath)) return false;
    return textHasIssueComplete(readFileSync(logPath, "utf-8"), n);
  }

  /** Pull branch and return whether progress.txt records issue #n complete. */
  private issueCompleteOnBranch(n: number): boolean {
    this.syncProgressFromBranch();
    return this.issueDone(n);
  }

  private checkIterationBudget(): void {
    const cap = this.cfg.maxTotalIterations;
    if (cap > 0 && this.agentRuns >= cap) {
      console.error(
        `Stopped: reached --max-iterations (${cap}). Resume later or raise the cap for AFK runs.`,
      );
      process.exit(1);
    }
  }

  private basePromptContext(issueNumber?: number): PromptContext {
    const steer = steeringFile(this.cfg);
    const ctx: PromptContext = {
      prd: this.cfg.prd,
      context: this.cfg.context,
      e2e: this.cfg.e2e,
      progress_file: progressFile(this.cfg),
      branch: this.cfg.branch,
      base: this.cfg.base,
      parent_issue: this.cfg.parentIssue,
      has_steering: existsSync(steer),
      steering_file: steer,
      has_issue: issueNumber !== undefined,
      is_remote: cfgIsRemote(this.cfg),
      worker: this.cfg.worker,
      worker_agent: workerAgentName(this.cfg.worker),
      feedback_loops: this.cfg.feedbackLoops.map((item) => `- ${item}`).join("\n"),
    };
    if (issueNumber !== undefined) {
      ctx.issue_number = issueNumber;
      ctx.issue_url = this.issueUrl(issueNumber);
    }
    return ctx;
  }

  promptIssueIteration(n: number): string {
    return this.prompts.render("loop-iteration-prompt", {
      ...this.basePromptContext(n),
      screenshots_dir: screenshotsDir(this.cfg),
    });
  }

  promptFinal(): string {
    return this.prompts.render("final-pass-prompt", {
      ...this.basePromptContext(),
      closes_clause: this.closesClause(),
    });
  }

  private async runAgentLocal(title: string, prompt: string, logPath: string): Promise<void> {
    const inv = buildLocalInvocation(this.cfg.worker as LocalWorkerKind, prompt);
    console.log(`=== ${title} (${this.cfg.worker}) ===`);
    mkdirSync(dirname(logPath), { recursive: true });
    const child = spawn(inv.command, inv.args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      process.stdout.write(chunk);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    await new Promise<void>((resolve, reject) => {
      child.on("close", (code) => {
        writeFileSync(logPath, Buffer.concat(chunks));
        if (code !== 0 && code !== null) {
          reject(new Error(`${inv.command} exited with code ${code}`));
        } else {
          resolve();
        }
      });
      child.on("error", reject);
    });
  }

  private async runAgentCloud(
    title: string,
    prompt: string,
    logPath: string,
    autoCreatePr: boolean,
  ): Promise<void> {
    const runner = this.cloudRunner();
    const session = await runner.runPrompt(title, prompt, logPath, { autoCreatePr });
    this.recordCloudSession(title, session.url);
  }

  async runAgent(
    title: string,
    prompt: string,
    logPath: string,
    autoCreatePr = false,
  ): Promise<void> {
    this.agentRuns += 1;
    if (this.cfg.dryRun) {
      console.log(`=== ${title} (${this.cfg.worker}) ===`);
      console.log(prompt);
      return;
    }
    if (cfgIsRemote(this.cfg)) {
      await this.runAgentCloud(title, prompt, logPath, autoCreatePr);
    } else {
      await this.runAgentLocal(title, prompt, logPath);
    }
  }

  /**
   * Run agent sessions on one issue until RALPH_ISSUE_COMPLETE #n is in progress.txt on the branch.
   * After each run the harness pulls and re-reads progress.txt (not the stream log) to decide completion.
   */
  async runUntilIssueComplete(n: number): Promise<void> {
    let pass = 0;
    while (!this.issueDone(n)) {
      this.syncProgressFromBranch();
      if (this.issueDone(n)) {
        return;
      }

      pass += 1;
      let attempt = 0;
      for (;;) {
        this.checkIterationBudget();
        attempt += 1;
        if (this.cfg.maxSlice > 0 && attempt > this.cfg.maxSlice) {
          console.error(
            `max retries for issue #${n} pass ${pass}: expected ${promiseIssueComplete(n)} in progress.txt on ${this.cfg.branch}`,
          );
          process.exit(1);
        }
        const title = `issue-${n}-pass${pass}-iter${attempt}`;
        const stamp = formatStamp(new Date());
        const logPath = join(logsDir(this.cfg), `${title}-${stamp}.log`);

        let runOk = false;
        try {
          await this.runAgent(title, this.promptIssueIteration(n), logPath);
          runOk = true;
        } catch (err) {
          console.error(`agent error: ${err instanceof Error ? err.message : err}`);
        }
        this.lastLog = logPath;

        if (this.cfg.dryRun) {
          console.log(`(dry-run) would loop on #${n} until ${promiseIssueComplete(n)}`);
          return;
        }

        maybePush(this.root, this.cfg.branch, this.cfg.push);

        if (this.issueCompleteOnBranch(n)) {
          const sigil = promiseIssueComplete(n);
          if (logPath && existsSync(logPath) && !this.logHasIssueComplete(logPath, n)) {
            console.log(
              `note: ${sigil} in progress.txt on ${this.cfg.branch} (stream log ended before sigil line)`,
            );
          }
          console.log(`OK: ${sigil}`);
          this.markIssueDone(n);
          return;
        }

        if (runOk && this.logHasIssueComplete(logPath, n)) {
          console.warn(
            `warn: stream log has ${promiseIssueComplete(n)} but progress.txt on ${this.cfg.branch} does not — ` +
              "ensure the agent committed and pushed progress.txt",
          );
          await sleep(3000);
          continue;
        }

        if (runOk) {
          console.log(
            `issue #${n} pass ${pass}: no ${promiseIssueComplete(n)} in progress.txt yet — next pass continues from branch log`,
          );
          break;
        }

        console.log(`issue #${n} pass ${pass} attempt ${attempt} failed (see ${logPath})`);
        await sleep(3000);
      }
    }
  }

  async runUntilPromise(
    maxIters: number,
    title: string,
    promise: string,
    promptFn: () => string,
    autoCreatePr = false,
  ): Promise<void> {
    const effectiveMax = this.cfg.once ? 1 : maxIters;
    let i = 1;
    for (;;) {
      this.checkIterationBudget();
      if (effectiveMax > 0 && i > effectiveMax) {
        console.error(`max iterations: ${title}`);
        process.exit(1);
      }
      const prompt = promptFn();
      const stamp = formatStamp(new Date());
      const logPath = join(logsDir(this.cfg), `${title}-iter${i}-${stamp}.log`);
      try {
        await this.runAgent(`${title}-iter${i}`, prompt, logPath, autoCreatePr);
      } catch (err) {
        console.error(`agent error: ${err instanceof Error ? err.message : err}`);
      }
      this.lastLog = logPath;
      if (this.cfg.dryRun) {
        console.log(`(dry-run) would wait for: ${promise}`);
        return;
      }
      maybePush(this.root, this.cfg.branch, this.cfg.push);
      this.syncProgressFromBranch();
      if (textHasPromise(readFileSync(progressFile(this.cfg), "utf-8"), promise)) {
        console.log(`OK: ${promise}`);
        return;
      }
      if (this.logHasPromise(logPath, promise)) {
        console.warn(`warn: ${promise} in agent log but not on branch progress.txt yet`);
      } else {
        console.log(`missing: ${promise} in progress.txt (see ${logPath})`);
      }
      i += 1;
      await sleep(3000);
    }
  }

  async run(requireRepoFiles: (paths: string[]) => void): Promise<void> {
    if (!commandExists("git")) {
      console.error("need: git");
      process.exit(1);
    }
    if (!this.cfg.dryRun && !cfgIsRemote(this.cfg)) {
      const inv = buildLocalInvocation(this.cfg.worker as LocalWorkerKind, "dry-run");
      if (!commandExists(inv.command)) {
        console.error(
          `Worker ${this.cfg.worker} requires ${inv.command} on PATH (install the CLI for that agent).`,
        );
        process.exit(1);
      }
    }

    requireRepoFiles([this.cfg.context, this.cfg.prd, this.cfg.e2e]);

    this.loadChildIssues();

    if (!this.cfg.dryRun) {
      syncSprintBranch(this.root, this.cfg.branch, this.cfg.base);
    }

    this.initProgress();
    this.reloadResumeFromBranch();
    this.logResumePlan();

    const mode = this.cfg.once ? "HITL (--once)" : "AFK";
    const capS =
      this.cfg.maxTotalIterations > 0
        ? String(this.cfg.maxTotalIterations)
        : "unlimited";
    console.log(
      `Worker: ${this.cfg.worker} (${mode}) | repo: ${this.cfg.repo} | ` +
        `Parent #${this.cfg.parentIssue} → children: ${this.issueNumbers.join(" ")} | ` +
        `max agent runs: ${capS}`,
    );
    console.log(`Progress log: ${progressFile(this.cfg)} (branch resume source)`);
    if (cfgIsRemote(this.cfg)) {
      const provider = cfgRemoteProvider(this.cfg);
      console.log(`Remote (${provider}): ${this.cfg.repoUrl} @ ${this.cfg.branch}`);
      console.log("Each loop iteration is one remote worker session on one issue.");
    }

    if (this.finalDone()) return;

    for (const n of this.issueNumbers) {
      if (this.issueDone(n)) continue;
      await this.runUntilIssueComplete(n);
      maybePush(this.root, this.cfg.branch, this.cfg.push);
    }

    this.reloadResumeFromBranch();
    if (this.finalDone()) return;

    await this.runUntilPromise(
      10,
      "final",
      "RALPH_ALL_COMPLETE",
      () => this.promptFinal(),
      this.cfg.cloudCreatePrOnFinal,
    );
    this.markFinalDone();
    maybePush(this.root, this.cfg.branch, this.cfg.push);

    if (cfgIsRemote(this.cfg) && this.cloudSessions.length) {
      console.log(`\nRemote worker sessions (${cfgRemoteProvider(this.cfg)}):`);
      for (const entry of this.cloudSessions) {
        console.log(`  - ${entry.title}: ${entry.url}`);
      }
    }
  }
}

function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
