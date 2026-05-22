#!/usr/bin/env npx tsx
/**
 * Start one Cloud Agent that runs the Ralph loop orchestrator in the foreground.
 */
import { parseArgs } from "node:util";
import { CloudAgentClient, CLOUD_MODEL_AUTO } from "./cloud.js";
import { RALPH_USAGE } from "./help.js";
import { detectRepoSlug, gitRoot, repoSlugToUrl } from "./git.js";
import { DEFAULT_PROMPTS_DIR, PromptLoader } from "./prompts.js";

function shellQuote(arg: string): string {
  if (/^[A-Za-z0-9_./=-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    console.log(
      "launch-ralph-orchestrator — start one Cloud Agent to run the Ralph loop\n\n" +
        "Usage:\n" +
        "  ./scripts/launch-ralph-orchestrator.sh --branch <branch> -- [ralph-loop args...]\n\n" +
        "Orchestrator flags:\n" +
        "  --branch <name>            Required integration branch\n" +
        "  --cloud-model <id>         Cursor model for orchestrator (default: Auto)\n" +
        "  RALPH_CLOUD_MODEL          Same when --cloud-model omitted\n" +
        "  --cursor-api-key, CURSOR_API_KEY\n\n" +
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
      "cloud-model": { type: "string" },
      "cursor-api-key": { type: "string" },
      "prompts-dir": { type: "string", default: DEFAULT_PROMPTS_DIR },
    },
  });

  const cloudModel =
    values["cloud-model"] ?? process.env.RALPH_CLOUD_MODEL ?? CLOUD_MODEL_AUTO;

  const branch = values.branch;
  if (!branch) {
    console.error("required: --branch");
    process.exit(1);
  }

  const apiKey = values["cursor-api-key"] ?? process.env.CURSOR_API_KEY;
  if (!apiKey) {
    console.error("Set CURSOR_API_KEY or pass --cursor-api-key");
    process.exit(1);
  }

  let loopArgv = [...loopArgs];
  if (!loopArgv.includes("--backend")) {
    loopArgv = ["--backend", "cloud", ...loopArgv];
  }
  if (!loopArgv.includes("--branch")) {
    loopArgv = ["--branch", branch, ...loopArgv];
  }
  if (!loopArgv.some((a) => a === "--cloud-model")) {
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
  });

  let url = values["repo-url"];
  if (!url) {
    if (values.repo) {
      url = repoSlugToUrl(values.repo);
    } else {
      url = repoSlugToUrl(detectRepoSlug(gitRoot()));
    }
  }

  const client = new CloudAgentClient(apiKey, url, branch, 15, {}, false, undefined, cloudModel);
  const session = await client.createSession(prompt, "ralph-orchestrator");
  console.log(`Orchestrator session: ${session.url}`);
  console.log(`agent_id=${session.agentId} run_id=${session.runId}`);
  console.log("You can close your laptop; child sessions appear at cursor.com/agents.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
