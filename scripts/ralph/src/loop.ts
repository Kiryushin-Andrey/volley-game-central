import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { CloudAgentClient } from "./cloud.js";
import { commandExists, detectRepoSlug, ensureBranch, maybePush, repoSlugToUrl } from "./git.js";
import { type PromptContext, PromptLoader } from "./prompts.js";
import type { RalphConfig, RalphState } from "./types.js";
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
  state: RalphState = {} as RalphState;
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

  initState(): void {
    mkdirSync(this.cfg.stateDir, { recursive: true });
    mkdirSync(logsDir(this.cfg), { recursive: true });
    mkdirSync(screenshotsDir(this.cfg), { recursive: true });

    const path = this.cfg.stateFile;
    if (existsSync(path)) {
      this.state = JSON.parse(readFileSync(path, "utf-8")) as RalphState;
    } else {
      this.state = {
        parent_issue: this.cfg.parentIssue,
        child_issues: this.issueNumbers,
        branch: this.cfg.branch,
        prd: this.cfg.prd,
        e2e: this.cfg.e2e,
        backend: this.cfg.backend,
        completed_issues: [],
        completed_e2e_suites: [],
        cloud_sessions: [],
        final_complete: false,
      };
      this.writeState();
    }

    for (const [key, defaultVal] of [
      ["completed_e2e_suites", [] as string[]],
      ["cloud_sessions", [] as RalphState["cloud_sessions"]],
      ["issue_item_passes", {} as Record<string, number>],
    ] as const) {
      if (!(key in this.state)) {
        (this.state as Record<string, unknown>)[key] = defaultVal;
        this.writeState();
      }
    }

    const progress = progressFile(this.cfg);
    if (!existsSync(progress)) {
      const template = progressTemplateFile(this.cfg);
      if (!existsSync(template)) {
        throw new Error(`Progress template not found: ${template}`);
      }
      writeFileSync(progress, readFileSync(template, "utf-8"), "utf-8");
    }
  }

  private writeState(): void {
    mkdirSync(this.cfg.stateDir, { recursive: true });
    const tmp = `${this.cfg.stateFile}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(this.state, null, 2)}\n`, "utf-8");
    writeFileSync(this.cfg.stateFile, readFileSync(tmp));
  }

  issueDone(n: number): boolean {
    return (this.state.completed_issues ?? []).includes(n);
  }

  markIssue(n: number): void {
    const issues = this.state.completed_issues ?? [];
    if (!issues.includes(n)) {
      issues.push(n);
      issues.sort((a, b) => a - b);
    }
    this.state.completed_issues = issues;
    this.writeState();
  }

  markSuite(letter: string): void {
    const suites = this.state.completed_e2e_suites ?? [];
    if (!suites.includes(letter)) {
      suites.push(letter);
    }
    this.state.completed_e2e_suites = suites;
    this.writeState();
  }

  markFinal(): void {
    this.state.final_complete = true;
    this.writeState();
  }

  recordCloudSession(title: string, url: string): void {
    const sessions = this.state.cloud_sessions ?? [];
    sessions.push({ title, url, at: new Date().toISOString() });
    this.state.cloud_sessions = sessions;
    this.writeState();
  }

  private promiseVariants(promise: string): string[] {
    const variants = [promise];
    if (promise === "RALPH_ALL_COMPLETE") {
      variants.push("COMPLETE");
    }
    return variants;
  }

  hasPromise(logPath: string, promise: string): boolean {
    if (!existsSync(logPath)) return false;
    const text = readFileSync(logPath, "utf-8");
    for (const variant of this.promiseVariants(promise)) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const linePat = new RegExp(`^\\s*${escaped}\\s*$`, "m");
      if (linePat.test(text)) return true;
      if (text.includes(`<promise>${variant}</promise>`)) return true;
    }
    return false;
  }

  promiseItem(n: number): string {
    return `RALPH_ITEM_COMPLETE #${n}`;
  }

  promiseSlice(n: number): string {
    return `RALPH_SLICE_COMPLETE #${n}`;
  }

  logHasItemComplete(logPath: string, n: number): boolean {
    return this.hasPromise(logPath, this.promiseItem(n));
  }

  logHasSliceComplete(logPath: string, n: number): boolean {
    if (this.hasPromise(logPath, this.promiseSlice(n))) return true;
    return this.hasPromise(logPath, `RALPH_ISSUE_COMPLETE #${n}`);
  }

  recordItemPass(n: number): void {
    const counts = this.state.issue_item_passes ?? {};
    const key = String(n);
    counts[key] = (counts[key] ?? 0) + 1;
    this.state.issue_item_passes = counts;
    this.writeState();
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

  /** Shared Handlebars context for workflow, refs-block, and partials. */
  private basePromptContext(issueNumber?: number): PromptContext {
    const steer = steeringFile(this.cfg);
    const ctx: PromptContext = {
      prd: this.cfg.prd,
      context: this.cfg.context,
      e2e: this.cfg.e2e,
      progress_file: progressFile(this.cfg),
      state_file: this.cfg.stateFile,
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

  async runUntilIssueComplete(n: number, suite: string): Promise<void> {
    let itemPass = 0;
    while (!this.issueDone(n)) {
      itemPass += 1;
      let attempt = 0;
      for (;;) {
        this.checkIterationBudget();
        attempt += 1;
        if (this.cfg.maxSlice > 0 && attempt > this.cfg.maxSlice) {
          console.error(
            `max retries for issue #${n} item pass ${itemPass}: expected ${this.promiseItem(n)} or ${this.promiseSlice(n)}`,
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
          console.log(
            `(dry-run) would wait for ${this.promiseItem(n)} or ${this.promiseSlice(n)}`,
          );
          return;
        }

        if (this.logHasSliceComplete(logPath, n)) {
          console.log(`OK: ${this.promiseSlice(n)}`);
          this.markSuite(suite);
          this.markIssue(n);
          return;
        }

        if (this.logHasItemComplete(logPath, n)) {
          console.log(`OK: ${this.promiseItem(n)} (more items may remain on #${n})`);
          this.recordItemPass(n);
          maybePush(this.root, this.cfg.branch, this.cfg.push);
          break;
        }

        console.log(
          `missing: ${this.promiseItem(n)} or ${this.promiseSlice(n)} (see ${logPath})`,
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
      if (this.hasPromise(logPath, promise)) {
        console.log(`OK: ${promise}`);
        return;
      }
      console.log(`missing: ${promise} (see ${logPath})`);
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
    this.initState();
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
    console.log(`Progress log: ${progressFile(this.cfg)}`);
    if (this.cfg.backend === "cloud") {
      console.log(`Remote: ${this.cfg.repoUrl} @ ${this.cfg.branch}`);
      console.log("Each item pass is one Cloud Agent session (implement + targeted E2E).");
    }

    if (!this.cfg.dryRun && this.cfg.backend === "local") {
      ensureBranch(this.root, this.cfg.branch, this.cfg.base);
    }

    for (const n of this.issueNumbers) {
      if (n < this.cfg.fromIssue) continue;
      if (this.issueDone(n)) continue;
      const suite = this.suiteFor(n);
      await this.runUntilIssueComplete(n, suite);
      maybePush(this.root, this.cfg.branch, this.cfg.push);
    }

    if (this.state.final_complete) return;

    await this.runUntilPromise(
      10,
      "final",
      "RALPH_ALL_COMPLETE",
      () => this.promptFinal(),
      this.cfg.cloudCreatePrOnFinal,
    );
    if (this.lastLog && this.hasPromise(this.lastLog, "RALPH_E2E_COMPLETE SUITE_D")) {
      this.markSuite("D");
    }
    this.markFinal();
    maybePush(this.root, this.cfg.branch, this.cfg.push);

    if (this.cfg.backend === "cloud" && this.state.cloud_sessions?.length) {
      console.log("\nCloud sessions:");
      for (const entry of this.state.cloud_sessions) {
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
