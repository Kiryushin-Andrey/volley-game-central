import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { CloudAgentClient } from "./cloud.js";
import {
  commandExists,
  commitPaths,
  detectRepoSlug,
  gitLogHasPromise,
  maybePush,
  repoSlugToUrl,
  syncSprintBranch,
} from "./git.js";
import { type PromptContext, PromptLoader } from "./prompts.js";
import { emptyResume, readProgressResume, type ProgressResume } from "./progress-state.js";
import {
  promiseItem,
  promiseSlice,
  textHasItemComplete,
  textHasPromise,
  textHasSliceComplete,
} from "./sigil.js";
import type { RalphConfig } from "./types.js";
import {
  logsDir,
  progressFile,
  progressTemplateFile,
  screenshotsDir,
  steeringFile,
} from "./types.js";

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

  private cloudClient(autoCreatePr = false): CloudAgentClient {
    if (!this.cfg.cursorApiKey) {
      throw new Error("CURSOR_API_KEY required for cloud backend");
    }
    return new CloudAgentClient(
      this.cfg.cursorApiKey,
      this.cfg.repoUrl,
      this.cfg.branch,
      this.cfg.cloudPollInterval,
      this.cfg.cloudEnv,
      autoCreatePr,
    );
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

  suiteFor(issueNumber: number): string {
    const idx = this.issueNumbers.indexOf(issueNumber);
    if (idx < 0) {
      throw new Error(`Issue #${issueNumber} not in child list`);
    }
    return String.fromCharCode("A".charCodeAt(0) + idx);
  }

  closesClause(): string {
    return this.issueNumbers.map((n) => `Closes #${n}`).join(", ");
  }

  private resumeOpts() {
    return {
      root: this.root,
      branch: this.cfg.branch,
      verifyGit: this.cfg.verifyGitResume,
    };
  }

  private reloadResumeFromBranch(): void {
    this.resume = readProgressResume(progressFile(this.cfg), this.issueNumbers, this.resumeOpts());
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

  private logHasItemComplete(logPath: string, n: number): boolean {
    if (!existsSync(logPath)) return false;
    return textHasItemComplete(readFileSync(logPath, "utf-8"), n);
  }

  private logHasSliceComplete(logPath: string, n: number): boolean {
    if (!existsSync(logPath)) return false;
    return textHasSliceComplete(readFileSync(logPath, "utf-8"), n);
  }

  /**
   * After agent log shows a sigil, pull sprint branch and confirm progress.txt
   * (or git history when verifyGitResume) records the same milestone.
   */
  private confirmOnBranch(logPath: string, n: number, kind: "item" | "slice"): boolean {
    const sigil = kind === "item" ? promiseItem(n) : promiseSlice(n);
    if (kind === "slice" && !this.logHasSliceComplete(logPath, n)) return false;
    if (kind === "item" && !this.logHasItemComplete(logPath, n)) return false;

    if (!this.cfg.dryRun) {
      syncSprintBranch(this.root, this.cfg.branch, this.cfg.base);
    }
    this.reloadResumeFromBranch();

    if (kind === "slice" && this.issueDone(n)) return true;
    if (kind === "item") {
      // Item passes do not mark issues complete; progress append is still required.
      const progress = readFileSync(progressFile(this.cfg), "utf-8");
      if (textHasItemComplete(progress, n)) return true;
    }

    if (this.cfg.verifyGitResume && gitLogHasPromise(this.root, this.cfg.branch, sigil)) {
      console.warn(
        `warn: ${sigil} in agent log and git history but not in progress.txt — ask agents to append sigils to progress.txt`,
      );
      if (kind === "slice") this.markIssueDone(n);
      return true;
    }

    console.warn(
      `warn: agent log has ${sigil} but progress.txt on ${this.cfg.branch} does not — ` +
        "ensure the agent committed and pushed progress.txt",
    );
    return false;
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
      is_cloud: this.cfg.backend === "cloud",
      feedback_loops: this.cfg.feedbackLoops.map((item) => `- ${item}`).join("\n"),
    };
    if (issueNumber !== undefined) {
      ctx.issue_number = issueNumber;
      ctx.issue_url = this.issueUrl(issueNumber);
    }
    return ctx;
  }

  promptSlice(n: number): string {
    return this.prompts.render("loop-iteration-prompt", {
      ...this.basePromptContext(n),
      suite: this.suiteFor(n),
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
    console.log(`=== ${title} ===`);
    mkdirSync(dirname(logPath), { recursive: true });
    const child = spawn(this.cfg.agentCmd, ["-p", "--force", "--", prompt], {
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
          reject(new Error(`agent exited with code ${code}`));
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
    const client = this.cloudClient(autoCreatePr);
    const session = await client.runPrompt(title, prompt, logPath);
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
      console.log(`=== ${title} (${this.cfg.backend}) ===`);
      console.log(prompt);
      return;
    }
    if (this.cfg.backend === "cloud") {
      await this.runAgentCloud(title, prompt, logPath, autoCreatePr);
    } else {
      await this.runAgentLocal(title, prompt, logPath);
    }
  }

  async runUntilIssueComplete(n: number): Promise<void> {
    let itemPass = 0;
    while (!this.issueDone(n)) {
      itemPass += 1;
      let attempt = 0;
      for (;;) {
        this.checkIterationBudget();
        attempt += 1;
        if (this.cfg.maxSlice > 0 && attempt > this.cfg.maxSlice) {
          console.error(
            `max retries for issue #${n} item pass ${itemPass}: expected ${promiseItem(n)} or ${promiseSlice(n)}`,
          );
          process.exit(1);
        }
        const title = `issue-${n}-item${itemPass}-iter${attempt}`;
        const stamp = formatStamp(new Date());
        const logPath = join(logsDir(this.cfg), `${title}-${stamp}.log`);
        try {
          await this.runAgent(title, this.promptSlice(n), logPath);
        } catch (err) {
          console.error(`agent error: ${err instanceof Error ? err.message : err}`);
        }
        this.lastLog = logPath;

        if (this.cfg.dryRun) {
          console.log(`(dry-run) would wait for ${promiseItem(n)} or ${promiseSlice(n)}`);
          return;
        }

        if (this.logHasSliceComplete(logPath, n)) {
          if (this.confirmOnBranch(logPath, n, "slice")) {
            console.log(`OK: ${promiseSlice(n)}`);
            this.markIssueDone(n);
            return;
          }
        } else if (this.logHasItemComplete(logPath, n)) {
          if (this.confirmOnBranch(logPath, n, "item")) {
            console.log(`OK: ${promiseItem(n)} (more items may remain on #${n})`);
            maybePush(this.root, this.cfg.branch, this.cfg.push);
            break;
          }
        }

        console.log(
          `missing or unverified: ${promiseItem(n)} or ${promiseSlice(n)} (see ${logPath})`,
        );
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
      if (this.logHasPromise(logPath, promise)) {
        if (!this.cfg.dryRun) {
          syncSprintBranch(this.root, this.cfg.branch, this.cfg.base);
        }
        this.reloadResumeFromBranch();
        if (textHasPromise(readFileSync(progressFile(this.cfg), "utf-8"), promise)) {
          console.log(`OK: ${promise}`);
          return;
        }
        if (this.cfg.verifyGitResume && gitLogHasPromise(this.root, this.cfg.branch, promise)) {
          console.warn(`warn: ${promise} in log and git but not progress.txt`);
          console.log(`OK: ${promise}`);
          return;
        }
        console.warn(`warn: ${promise} in agent log but not on branch progress.txt yet`);
      } else {
        console.log(`missing: ${promise} (see ${logPath})`);
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
    if (!this.cfg.dryRun && this.cfg.backend === "local" && !commandExists(this.cfg.agentCmd)) {
      console.error(`need: ${this.cfg.agentCmd}`);
      process.exit(1);
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
      `Backend: ${this.cfg.backend} (${mode}) | repo: ${this.cfg.repo} | ` +
        `Parent #${this.cfg.parentIssue} → children: ${this.issueNumbers.join(" ")} | ` +
        `max agent runs: ${capS}`,
    );
    console.log(`Progress log: ${progressFile(this.cfg)} (branch resume source)`);
    if (this.cfg.backend === "cloud") {
      console.log(`Remote: ${this.cfg.repoUrl} @ ${this.cfg.branch}`);
      console.log("Each item pass is one Cloud Agent session (implement + targeted E2E).");
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

    if (this.cfg.backend === "cloud" && this.cloudSessions.length) {
      console.log("\nCloud sessions:");
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
