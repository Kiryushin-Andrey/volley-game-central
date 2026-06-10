#!/usr/bin/env npx tsx
/**
 * After bootstrap writes ralph.config.json: ensure integration branch exists,
 * commit config + progress + sessions, push, and open a draft PR (cloud only).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  configPath,
  loadConfig,
  progressTemplatePath,
  sessionsPath,
  sessionsTemplatePath,
} from "./config.js";
import { commitPaths, commandExists, ensureBranch, gitRoot, maybePush } from "./git.js";
import { progressPath } from "./paths.js";
import { isRemoteWorker } from "./workers/types.js";

function seedFile(path: string, templatePath: string, fallback: string): void {
  if (existsSync(path)) return;
  writeFileSync(
    path,
    existsSync(templatePath) ? readFileSync(templatePath, "utf-8") : fallback,
    "utf-8",
  );
}

function ensureBootstrapStateFiles(cfg: ReturnType<typeof loadConfig>): void {
  if (!existsSync(configPath(cfg.stateDir))) {
    throw new Error(`Missing ${configPath(cfg.stateDir)} — write config before bootstrap-publish`);
  }
  seedFile(
    progressPath(cfg.stateDir),
    progressTemplatePath(cfg.stateDir),
    "# Ralph progress\n",
  );
  seedFile(
    sessionsPath(cfg.stateDir),
    sessionsTemplatePath(cfg.stateDir),
    "# started_at\trole\tworker\tsession_ref\tnotes\n",
  );
}

function createDraftPr(cfg: ReturnType<typeof loadConfig>, root: string): void {
  if (!commandExists("gh")) {
    console.error("error: gh CLI required to create PR for cloud bootstrap");
    process.exit(1);
  }
  const list = spawnGh(root, [
    "pr",
    "list",
    "--head",
    cfg.branch,
    "--base",
    cfg.base,
    "--json",
    "number,url",
    "--limit",
    "1",
  ]);
  if (list.status === 0 && list.stdout.trim()) {
    try {
      const items = JSON.parse(list.stdout) as { url?: string }[];
      if (items[0]?.url) {
        console.log(`RALPH_BOOTSTRAP_PR ${items[0].url} (existing)`);
        return;
      }
    } catch {
      /* fall through to create */
    }
  }

  const title = `Ralph: epic #${cfg.parentIssue} (${cfg.branch})`;
  const body =
    `Recursive Ralph sprint for parent issue #${cfg.parentIssue}.\n\n` +
    `- Integration branch: \`${cfg.branch}\` → \`${cfg.base}\`\n` +
    `- Child slices (order): ${cfg.childIssues.map((n) => `#${n}`).join(", ")}\n` +
    `- PRD: ${cfg.prd}\n` +
    `- Worker: ${cfg.worker}\n\n` +
    `State: \`.ralph/ralph.config.json\`, \`.ralph/progress.txt\`, \`.ralph/sessions.log\``;

  const create = spawnGh(root, [
    "pr",
    "create",
    "--draft",
    "--base",
    cfg.base,
    "--head",
    cfg.branch,
    "--title",
    title,
    "--body",
    body,
  ]);
  if (create.status !== 0) {
    console.error(create.stderr || create.stdout || "gh pr create failed");
    process.exit(create.status ?? 1);
  }
  const url = create.stdout.trim().split("\n").pop() ?? "";
  if (url) console.log(`RALPH_BOOTSTRAP_PR ${url}`);
}

function spawnGh(
  root: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("gh", args, { cwd: root, encoding: "utf-8" });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "state-dir": { type: "string", default: ".ralph" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(
      "ralph-bootstrap-publish — push bootstrap state; draft PR for cloud workers only\n\n" +
        "  Requires .ralph/ralph.config.json (and seeds progress.txt / sessions.log if missing).\n" +
        "  Run before ralph-chain-next.sh --bootstrap.\n",
    );
    return;
  }

  const root = gitRoot();
  const cfg = loadConfig(values["state-dir"]);
  ensureBootstrapStateFiles(cfg);

  console.log(`Branch: ${cfg.branch} (base ${cfg.base}) | worker: ${cfg.worker}`);
  ensureBranch(root, cfg.branch, cfg.base);

  const rel = [
    join(cfg.stateDir, "ralph.config.json"),
    join(cfg.stateDir, "progress.txt"),
    join(cfg.stateDir, "sessions.log"),
  ];

  const committed = commitPaths(
    root,
    rel,
    "ralph: bootstrap state (config, progress, sessions)",
    cfg.branch,
    false,
  );
  if (!committed) {
    console.log("note: no new changes to commit (files already up to date on branch)");
  }

  console.log("Pushing integration branch…");
  maybePush(root, cfg.branch, true);

  if (isRemoteWorker(cfg.worker)) {
    console.log("Cloud worker: opening draft PR…");
    createDraftPr(cfg, root);
  } else {
    console.log(
      "Local worker: integration branch pushed. No GitHub PR at bootstrap — open a PR manually when the epic is ready.",
    );
  }

  console.log("OK: bootstrap publish complete — run ./.ralph/scripts/ralph-chain-next.sh --bootstrap next");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
