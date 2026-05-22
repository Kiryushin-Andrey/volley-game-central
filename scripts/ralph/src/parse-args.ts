import { parseArgs } from "node:util";
import { CURSOR_MODEL_AUTO } from "./agents/factory.js";
import { DEFAULT_PROMPTS_DIR } from "./prompts.js";
import type { RalphConfig } from "./types.js";
import { DEFAULT_E2E_SCENARIOS } from "./types.js";
import { isRemoteWorker } from "./workers/types.js";
import { resolveWorkerFromArgv } from "./workers/registry.js";

export const DEFAULT_FEEDBACK_LOOPS = [
  "Backend TypeScript: cd backend && npm run build",
  "Frontend TypeScript: cd tg-mini-app && npm run build",
] as const;

function parseCloudEnv(values: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of values) {
    const eq = item.indexOf("=");
    if (eq < 0) {
      console.error(`--cloud-env must be KEY=VALUE, got: ${JSON.stringify(item)}`);
      process.exit(1);
    }
    const key = item.slice(0, eq);
    if (!key) {
      console.error(`--cloud-env key empty: ${JSON.stringify(item)}`);
      process.exit(1);
    }
    out[key] = item.slice(eq + 1);
  }
  return out;
}

/** Expand `--child-issues 20 21 22` into repeated flags for util.parseArgs. */
export function expandChildIssuesArgv(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--child-issues" || arg === "-c") {
      i++;
      let any = false;
      while (i < argv.length && !argv[i].startsWith("-")) {
        out.push("--child-issues", argv[i]!);
        any = true;
        i++;
      }
      if (!any) {
        out.push("--child-issues");
      }
      i--;
    } else {
      out.push(arg);
    }
  }
  return out;
}

export function parseRalphArgs(argv: string[]): RalphConfig {
  const { values } = parseArgs({
    args: expandChildIssuesArgv(argv),
    options: {
      repo: { type: "string" },
      "repo-url": { type: "string" },
      "parent-issue": { type: "string", short: "p" },
      "child-issues": { type: "string", multiple: true },
      branch: { type: "string" },
      base: { type: "string", default: "main" },
      context: { type: "string", default: "CONTEXT.md" },
      prd: { type: "string" },
      e2e: { type: "string" },
      "state-dir": { type: "string", default: ".ralph" },
      "prompts-dir": { type: "string", default: DEFAULT_PROMPTS_DIR },
      worker: { type: "string" },
      backend: { type: "string" },
      "cloud-provider": { type: "string" },
      "agent-cmd": { type: "string" },
      "cursor-api-key": { type: "string" },
      "warp-api-key": { type: "string" },
      "oz-environment-id": { type: "string" },
      "oz-config-name": { type: "string" },
      "oz-model-id": { type: "string" },
      "cloud-poll-interval": { type: "string", default: "15" },
      "cloud-env": { type: "string", multiple: true },
      "cloud-model": { type: "string" },
      help: { type: "boolean", short: "h" },
      "cloud-create-pr-on-final": { type: "boolean", default: false },
      max: { type: "string" },
      "max-slice": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      push: { type: "boolean", default: false },
      once: { type: "boolean", default: false },
      "max-iterations": { type: "string", default: "0" },
      "feedback-loop": { type: "string", multiple: true },
    },
    allowPositionals: false,
  });

  const parentIssue = values["parent-issue"];
  const branch = values.branch;
  const prd = values.prd;
  const e2e = values.e2e;
  const childIssues = values["child-issues"];

  if (!parentIssue) {
    console.error("required: --parent-issue");
    process.exit(1);
  }
  if (!branch) {
    console.error("required: --branch");
    process.exit(1);
  }
  if (!prd) {
    console.error("required: --prd");
    process.exit(1);
  }
  const e2ePath = e2e ?? DEFAULT_E2E_SCENARIOS;
  if (e2e && e2e !== DEFAULT_E2E_SCENARIOS) {
    console.warn(
      `warn: --e2e is not the project Playwright checklist (${DEFAULT_E2E_SCENARIOS}). ` +
        "The E2E gate in prompts targets the whole-repo suite; feature-specific plans are not used for the gate.",
    );
  }
  if (!childIssues?.length) {
    console.error("required: --child-issues");
    process.exit(1);
  }

  const worker = resolveWorkerFromArgv({
    worker: values.worker,
    backend: values.backend,
    "cloud-provider": values["cloud-provider"],
    "agent-cmd": values["agent-cmd"],
  });

  const dryRun = values["dry-run"] ?? false;
  const cursorApiKey = values["cursor-api-key"] ?? process.env.CURSOR_API_KEY;
  const warpApiKey = values["warp-api-key"] ?? process.env.WARP_API_KEY;
  const ozEnvironmentId =
    values["oz-environment-id"] ?? process.env.OZ_ENVIRONMENT_ID ?? process.env.RALPH_OZ_ENVIRONMENT_ID;

  if (isRemoteWorker(worker) && !dryRun) {
    if (worker === "remote-cursor" && !cursorApiKey) {
      console.error("Worker remote-cursor requires --cursor-api-key or CURSOR_API_KEY.");
      process.exit(1);
    }
    if (worker === "remote-oz") {
      if (!warpApiKey) {
        console.error("Worker remote-oz requires --warp-api-key or WARP_API_KEY.");
        process.exit(1);
      }
      if (!ozEnvironmentId) {
        console.error(
          "Worker remote-oz requires --oz-environment-id or OZ_ENVIRONMENT_ID " +
            "(create an environment at https://oz.warp.dev/).",
        );
        process.exit(1);
      }
    }
  }

  const stateDir = values["state-dir"] ?? ".ralph";
  const feedbackLoop = values["feedback-loop"];
  const feedbackLoops =
    feedbackLoop && feedbackLoop.length > 0 ? feedbackLoop : DEFAULT_FEEDBACK_LOOPS;

  const maxSliceRaw = values["max-slice"] ?? values.max ?? "5";

  return {
    repo: values.repo ?? "",
    repoUrl: values["repo-url"] ?? "",
    parentIssue: Number(parentIssue),
    childIssues: childIssues.map((n) => Number(n)),
    branch,
    base: values.base ?? "main",
    context: values.context ?? "CONTEXT.md",
    prd,
    e2e: e2ePath,
    stateDir,
    promptsDir: values["prompts-dir"] ?? DEFAULT_PROMPTS_DIR,
    worker,
    cursorApiKey,
    warpApiKey,
    ozEnvironmentId,
    ozModelId:
      values["oz-model-id"] ??
      process.env.RALPH_OZ_MODEL_ID ??
      (worker === "remote-oz" ? values["cloud-model"] : undefined),
    ozConfigName: values["oz-config-name"] ?? process.env.RALPH_OZ_CONFIG_NAME ?? "ralph-loop",
    cloudPollInterval: Number(values["cloud-poll-interval"] ?? "15"),
    cloudEnv: parseCloudEnv(values["cloud-env"] ?? []),
    cloudModel: values["cloud-model"] ?? process.env.RALPH_CLOUD_MODEL ?? CURSOR_MODEL_AUTO,
    cloudCreatePrOnFinal: values["cloud-create-pr-on-final"] ?? false,
    maxSlice: Number(maxSliceRaw),
    dryRun,
    push: values.push ?? false,
    once: values.once ?? false,
    maxTotalIterations: Number(values["max-iterations"] ?? "0"),
    feedbackLoops,
  };
}
