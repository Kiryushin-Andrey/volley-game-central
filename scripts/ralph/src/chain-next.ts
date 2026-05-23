#!/usr/bin/env npx tsx
/**
 * After an iteration: plan next work, start the next agent session, append sessions.log, commit, exit.
 * Does not wait for the new session to finish.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadConfig, progressTemplatePath, sessionsPath, sessionsTemplatePath } from "./config.js";
import { commitPaths, gitRoot, syncSprintBranch } from "./git.js";
import { planNext, type RalphPhase } from "./plan.js";
import { progressPath } from "./paths.js";
import { PromptLoader } from "./prompts.js";
import { buildPromptContext, resolveRepoUrl } from "./render-context.js";
import { appendSessionLine, formatSessionStdout } from "./sessions-log.js";
import { isRemoteWorker } from "./workers/types.js";

function phaseNotes(phase: RalphPhase): string {
  if (phase.type === "issue") return `issue #${phase.issueNumber}`;
  if (phase.type === "final") return "final pass";
  return "epic complete";
}

function phaseRole(phase: RalphPhase): "iteration" | "final" {
  return phase.type === "final" ? "final" : "iteration";
}

function templateName(phase: RalphPhase): string {
  if (phase.type === "final") return "final-pass-prompt";
  return "iteration-prompt";
}

function startRemoteCursor(
  root: string,
  cfg: ReturnType<typeof loadConfig>,
  prompt: string,
  autoPr: boolean,
): string {
  const branch = cfg.branch;
  const args = [
    join(root, "scripts/start-cursor-cloud-session.sh"),
    "--branch",
    branch,
    "--model",
    cfg.cloudModel ?? "default",
  ];
  if (autoPr) args.push("--auto-pr");
  args.push("--", prompt);
  const r = spawnSync("bash", args, {
    cwd: root,
    encoding: "utf-8",
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "start-cursor-cloud-session failed");
  }
  const urlLine = (r.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("http"))
    .pop();
  if (!urlLine) {
    throw new Error(`No session URL in cursor script output:\n${r.stdout}`);
  }
  return urlLine;
}

function startRemoteOz(
  root: string,
  cfg: ReturnType<typeof loadConfig>,
  prompt: string,
  title: string,
  autoPr: boolean,
): string {
  const args = [join(root, "scripts/start-oz-cloud-session.sh"), "--title", title];
  if (cfg.ozEnvironmentId) args.push("--environment-id", cfg.ozEnvironmentId);
  if (cfg.ozModelId) args.push("--model-id", cfg.ozModelId);
  if (cfg.ozConfigName) args.push("--config-name", cfg.ozConfigName);
  if (autoPr) args.push("--auto-pr");
  args.push("--", prompt);
  const r = spawnSync("bash", args, {
    cwd: root,
    encoding: "utf-8",
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "start-oz-cloud-session failed");
  }
  const urlLine = (r.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("http"))
    .pop();
  if (!urlLine) {
    throw new Error(`No session URL in oz script output:\n${r.stdout}`);
  }
  return urlLine;
}

function startLocal(
  root: string,
  cfg: ReturnType<typeof loadConfig>,
  promptPath: string,
  phase: RalphPhase,
): string {
  const slug = phase.type === "issue" ? `issue-${phase.issueNumber}` : "final";
  const sessionName = `ralph-${slug}-${Date.now()}`;
  const prompt = readFileSync(promptPath, "utf-8").trim();
  let cmd: string;
  switch (cfg.worker) {
    case "local-cursor":
      cmd = `agent -p --force -- ${shellQuote(prompt)}`;
      break;
    case "local-claude":
      cmd = `claude -p ${shellQuote(prompt)} --permission-mode acceptEdits`;
      break;
    case "local-codex": {
      const promptFile = shellQuote(promptPath);
      cmd = `codex --sandbox workspace-write --ask-for-approval on-request $(cat ${promptFile})`;
      break;
    }
    default:
      throw new Error(`Unsupported local worker: ${cfg.worker}`);
  }
  const r = spawnSync(
    "tmux",
    ["new-session", "-d", "-s", sessionName, "-c", root, "--", "bash", "-lc", cmd],
    { cwd: root, encoding: "utf-8" },
  );
  if (r.status !== 0) {
    throw new Error(
      `tmux failed (is tmux installed?): ${r.stderr || r.stdout}\nRun manually in ${root}:\n${cmd}`,
    );
  }
  return `tmux:${sessionName}`;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function ensureStateFiles(root: string, cfg: ReturnType<typeof loadConfig>): void {
  mkdirSync(join(root, cfg.stateDir), { recursive: true });
  const progress = progressPath(cfg.stateDir);
  if (!existsSync(progress)) {
    const tpl = progressTemplatePath(cfg.stateDir);
    writeFileSync(
      progress,
      existsSync(tpl) ? readFileSync(tpl, "utf-8") : "# Ralph progress\n",
      "utf-8",
    );
  }
  const sessions = sessionsPath(cfg.stateDir);
  if (!existsSync(sessions)) {
    const tpl = sessionsTemplatePath(cfg.stateDir);
    writeFileSync(
      sessions,
      existsSync(tpl)
        ? readFileSync(tpl, "utf-8")
        : "# started_at\trole\tworker\tsession_ref\tnotes\n",
      "utf-8",
    );
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "state-dir": { type: "string", default: ".ralph" },
      bootstrap: { type: "boolean", default: false },
      "from-notes": { type: "string", default: "" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(
      "ralph-chain-next — start the next Ralph session and append sessions.log\n\n" +
        "  --state-dir .ralph\n" +
        "  --bootstrap   first session after config was written\n" +
        "  --from-notes  optional label for the session that is chaining (logging only)\n",
    );
    return;
  }

  const root = gitRoot();
  const cfg = loadConfig(values["state-dir"]);
  ensureStateFiles(root, cfg);

  if (!values.bootstrap && cfg.push) {
    syncSprintBranch(root, cfg.branch, cfg.base);
  }

  const phase = planNext(cfg);
  if (phase.type === "done") {
    console.log("RALPH_DONE — no next session (RALPH_ALL_COMPLETE in progress.txt)");
    return;
  }

  const prompts = new PromptLoader(cfg.promptsDir);
  const promptText = prompts.render(
    templateName(phase),
    buildPromptContext(cfg, root, phase, { bootstrap: false }),
  );
  const promptPath = join(root, cfg.stateDir, ".next-prompt.md");
  writeFileSync(promptPath, promptText, "utf-8");

  const notes = phaseNotes(phase);
  const role = values.bootstrap ? "bootstrap" : phaseRole(phase);
  const autoPr = phase.type === "final" && (cfg.cloudCreatePrOnFinal ?? false);

  let sessionRef: string;
  if (isRemoteWorker(cfg.worker)) {
    if (cfg.worker === "remote-cursor") {
      if (!process.env.CURSOR_API_KEY) {
        console.error("CURSOR_API_KEY required for remote-cursor");
        process.exit(1);
      }
      sessionRef = startRemoteCursor(root, cfg, promptText, autoPr);
    } else {
      if (!process.env.WARP_API_KEY || !process.env.OZ_ENVIRONMENT_ID) {
        console.error("WARP_API_KEY and OZ_ENVIRONMENT_ID required for remote-oz");
        process.exit(1);
      }
      sessionRef = startRemoteOz(root, cfg, promptText, `ralph ${notes}`, autoPr);
    }
  } else {
    sessionRef = startLocal(root, cfg, promptPath, phase);
  }

  appendSessionLine(cfg, {
    role,
    worker: cfg.worker,
    sessionRef,
    notes: values["from-notes"] ? `${notes}; after ${values["from-notes"]}` : notes,
  });

  const relSessions = join(cfg.stateDir, "sessions.log");
  commitPaths(root, [relSessions], `ralph: chain next session (${notes})`, cfg.branch, cfg.push);

  formatSessionStdout(role, sessionRef, notes);
  console.log(`RALPH_CHAINED ${sessionRef}`);
  console.log(
    "\nStop this session — the next agent continues in the new session above.",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
