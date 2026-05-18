#!/usr/bin/env npx tsx
/**
 * Ralph loop — child GitHub issues (one iteration per session until issue complete) + final pass.
 * Prompt templates: .ralph/prompts/*.md
 */
import { gitRoot, requireRepoFiles } from "./git.js";
import { RalphLoop } from "./loop.js";
import { parseRalphArgs } from "./parse-args.js";

async function main(): Promise<void> {
  const cfg = parseRalphArgs(process.argv.slice(2));
  const root = gitRoot();
  const loop = new RalphLoop(cfg, root);
  await loop.run((paths) => requireRepoFiles(root, paths));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
