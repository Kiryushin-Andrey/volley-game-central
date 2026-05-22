#!/usr/bin/env npx tsx
/**
 * Start one remote worker that runs the Ralph loop orchestrator in the foreground.
 */
import { parseArgs } from "node:util";
import { createCloudAgentRunner, CURSOR_MODEL_AUTO } from "./agents/factory.js";
import type { CloudRunnerConfig } from "./agents/types.js";
import { RALPH_USAGE } from "./help.js";
import { detectRepoSlug, gitRoot, repoSlugToUrl } from "./git.js";
import { DEFAULT_PROMPTS_DIR, PromptLoader } from "./prompts.js";
import { parseWorkerKind, WORKER_KINDS } from "./workers/registry.js";
import { isRemoteWorker, remoteProvider, type RemoteWorkerKind } from "./workers/types.js";

function shellQuote(arg: string): string {
  if (/^[A-Za-z0-9_./=-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    console.log(
      "launch-ralph-orchestrator — start one remote worker to run the Ralph loop\n\n" +
        "Usage:\n" +
        "  ./scripts/launch-ralph-orchestrator.sh --branch <branch> -- [ralph-loop args...]\n\n" +
        "Orchestrator flags:\n" +
        "  --branch <name>              Required integration branch\n" +
        "  --worker <name>              remote-cursor (default) | remote-oz\n" +
        "  --cloud-model <id>           Cursor model for orchestrator (default: Auto)\n" +
        "  --cursor-api-key, CURSOR_API_KEY\n" +
        "  --warp-api-key, WARP_API_KEY (remote-oz)\n" +
        "  --oz-environment-id, OZ_ENVIRONMENT_ID (remote-oz)\n\n" +
        "Arguments after -- are passed to ralph-loop.sh (see --help there).\n",
    );
    console.log(RALPH_USAGE);
    return;
  }

  const divider = raw.indexOf("--");
  const orchestratorArgs = divider >= 0 ? raw.slice(0, divider) : raw;
  const loopArgs = divider >= 0 ? raw.slice(divider + 1) : [];

  const { values } = parseArgs({
    args: orchestratorArgs,
    options: {
      repo: { type: "string" },
      "repo-url": { type: "string" },
      branch: { type: "string" },
      worker: { type: "string", default: "remote-cursor" },
      "cloud-provider": { type: "string" },
      "cloud-model": { type: "string" },
      "cursor-api-key": { type: "string" },
      "warp-api-key": { type: "string" },
      "oz-environment-id": { type: "string" },
      "prompts-dir": { type: "string", default: DEFAULT_PROMPTS_DIR },
    },
  });

  let orchestratorWorker: RemoteWorkerKind;
  if (values.worker) {
    const kind = parseWorkerKind(values.worker);
    if (!isRemoteWorker(kind)) {
      console.error(
        `launch-ralph-orchestrator requires a remote --worker (remote-cursor or remote-oz), got: ${kind}`,
      );
      process.exit(1);
    }
    orchestratorWorker = kind;
  } else if (values["cloud-provider"]) {
    const p = values["cloud-provider"].toLowerCase();
    console.warn("warn: --cloud-provider is deprecated; use --worker remote-cursor or remote-oz");
    orchestratorWorker = p === "oz" ? "remote-oz" : "remote-cursor";
  } else {
    orchestratorWorker = "remote-cursor";
  }

  const cloudModel =
    values["cloud-model"] ?? process.env.RALPH_CLOUD_MODEL ?? CURSOR_MODEL_AUTO;
  const cloudProvider = remoteProvider(orchestratorWorker);

  const branch = values.branch;
  if (!branch) {
    console.error("required: --branch");
    process.exit(1);
  }

  const cursorApiKey = values["cursor-api-key"] ?? process.env.CURSOR_API_KEY;
  const warpApiKey = values["warp-api-key"] ?? process.env.WARP_API_KEY;
  const ozEnvironmentId =
    values["oz-environment-id"] ??
    process.env.OZ_ENVIRONMENT_ID ??
    process.env.RALPH_OZ_ENVIRONMENT_ID;

  if (orchestratorWorker === "remote-cursor" && !cursorApiKey) {
    console.error("Set CURSOR_API_KEY or pass --cursor-api-key");
    process.exit(1);
  }
  if (orchestratorWorker === "remote-oz") {
    if (!warpApiKey) {
      console.error("Set WARP_API_KEY or pass --warp-api-key");
      process.exit(1);
    }
    if (!ozEnvironmentId) {
      console.error("Set OZ_ENVIRONMENT_ID or pass --oz-environment-id");
      process.exit(1);
    }
  }

  let loopArgv = [...loopArgs];
  if (!loopArgv.includes("--worker")) {
    loopArgv = ["--worker", orchestratorWorker, ...loopArgv];
  }
  if (!loopArgv.includes("--branch")) {
    loopArgv = ["--branch", branch, ...loopArgv];
  }
  if (
    orchestratorWorker === "remote-cursor" &&
    !loopArgv.some((a) => a === "--cloud-model")
  ) {
    loopArgv = ["--cloud-model", cloudModel, ...loopArgv];
  }

  const loopCmd = [
    "cd scripts/ralph && npm install && cd ../.. &&",
    "npx",
    "--prefix",
    "scripts/ralph",
    "tsx",
    "scripts/ralph/src/ralph-loop.ts",
    ...loopArgv,
  ]
    .map(shellQuote)
    .join(" ");

  const prompts = new PromptLoader(values["prompts-dir"]);
  const hasChildren = loopArgv.includes("--child-issues");
  const prompt = prompts.render("orchestrator-prompt", {
    has_children: hasChildren,
    loop_cmd: loopCmd,
    worker: orchestratorWorker,
    worker_agent: cloudProvider,
  });

  let url = values["repo-url"];
  if (!url) {
    if (values.repo) {
      url = repoSlugToUrl(values.repo);
    } else {
      url = repoSlugToUrl(detectRepoSlug(gitRoot()));
    }
  }

  const runnerConfig: CloudRunnerConfig = {
    provider: cloudProvider,
    pollIntervalSec: 15,
    repoUrl: url,
    branch,
    cursorApiKey,
    cloudEnv: {},
    cloudModel,
    autoCreatePr: false,
    warpApiKey,
    ozEnvironmentId,
    ozModelId: process.env.RALPH_OZ_MODEL_ID,
    ozConfigName: "ralph-orchestrator",
  };

  const runner = createCloudAgentRunner(runnerConfig);
  const session = await runner.runPrompt(
    "ralph-orchestrator",
    prompt,
    ".ralph/logs/orchestrator-launch.log",
  );
  console.log(`Orchestrator session (${orchestratorWorker}): ${session.url}`);
  if (session.externalIds.run_id) {
    console.log(`run_id=${session.externalIds.run_id}`);
  }
  if (session.externalIds.agent_id) {
    console.log(`agent_id=${session.externalIds.agent_id}`);
  }
  console.log(
    orchestratorWorker === "remote-oz"
      ? "Track runs at https://oz.warp.dev/"
      : "You can close your laptop; child sessions appear at cursor.com/agents.",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
