#!/usr/bin/env npx tsx
/**
 * Render a Ralph prompt template from ralph.config.json + progress.txt.
 */
import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { gitRoot } from "./git.js";
import { planNext } from "./plan.js";
import { PromptLoader } from "./prompts.js";
import { buildPromptContext } from "./render-context.js";
import type { RalphPhase } from "./plan.js";

function templateForPhase(phase: RalphPhase, bootstrap: boolean): string {
  if (bootstrap) return "bootstrap-prompt";
  if (phase.type === "final") return "final-pass-prompt";
  return "iteration-prompt";
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "state-dir": { type: "string", default: ".ralph" },
      bootstrap: { type: "boolean", default: false },
      phase: { type: "string" },
      "issue-number": { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(
      "ralph-render — render Handlebars prompt from ralph.config.json\n\n" +
        "  --state-dir .ralph\n" +
        "  --bootstrap          bootstrap-prompt.md\n" +
        "  --phase issue|final  override auto plan (default: from progress.txt)\n" +
        "  --issue-number N     with --phase issue\n" +
        "  --out path           write prompt to file (default: stdout)\n",
    );
    return;
  }

  const cfg = loadConfig(values["state-dir"]);
  const root = gitRoot();
  let phase = planNext(cfg);

  if (values.phase === "issue") {
    const n = values["issue-number"];
    if (!n) {
      console.error("--issue-number required with --phase issue");
      process.exit(1);
    }
    phase = { type: "issue", issueNumber: Number(n) };
  } else if (values.phase === "final") {
    phase = { type: "final" };
  } else if (values.phase === "done") {
    phase = { type: "done" };
  }

  const bootstrap = values.bootstrap === true;
  const name = templateForPhase(phase, bootstrap);
  const prompts = new PromptLoader(cfg.promptsDir);
  const text = prompts.render(name, buildPromptContext(cfg, root, phase, { bootstrap }));
  const outPath = values.out ?? join(cfg.stateDir, ".next-prompt.md");

  if (values.out || !process.stdout.isTTY) {
    writeFileSync(outPath, text, "utf-8");
    console.log(outPath);
  } else {
    process.stdout.write(text);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
