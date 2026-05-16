#!/usr/bin/env npx tsx
/**
 * Start one Cloud Agent that runs the Ralph loop orchestrator in the foreground.
 */
import { parseArgs } from "node:util";
import { CloudAgentClient } from "./cloud.js";
import { detectRepoSlug, gitRoot, repoSlugToUrl } from "./git.js";
import { DEFAULT_PROMPTS_DIR, PromptLoader } from "./prompts.js";

function shellQuote(arg: string): string {
  if (/^[A-Za-z0-9_./=-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

async function main(): Promise<void> {
  const raw = process.argv.slice(2);
  const divider = raw.indexOf("--");
  const orchestratorArgs = divider >= 0 ? raw.slice(0, divider) : raw;
  const loopArgs = divider >= 0 ? raw.slice(divider + 1) : [];

  const { values } = parseArgs({
    args: orchestratorArgs,
    options: {
      repo: { type: "string" },
      "repo-url": { type: "string" },
      branch: { type: "string" },
      "cursor-api-key": { type: "string" },
      "prompts-dir": { type: "string", default: DEFAULT_PROMPTS_DIR },
    },
  });

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

  const loopCmd = [
    "npx",
    "tsx",
    "scripts/ralph/src/ralph-loop.ts",
    ...loopArgv,
  ]
    .map(shellQuote)
    .join(" ");

  const prompts = new PromptLoader(values["prompts-dir"]);
  const hasChildren = loopArgv.includes("--child-issues");
  const discoverName = hasChildren
    ? "orchestrator-children-known"
    : "orchestrator-discover-children";
  const discoverStep = prompts.load(discoverName);
  const prompt = prompts.render("orchestrator", {
    discover_step: discoverStep,
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

  const client = new CloudAgentClient(apiKey, url, branch);
  const session = await client.createSession(prompt, "ralph-orchestrator");
  console.log(`Orchestrator session: ${session.url}`);
  console.log(`agent_id=${session.agentId} run_id=${session.runId}`);
  console.log("You can close your laptop; child sessions appear at cursor.com/agents.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
