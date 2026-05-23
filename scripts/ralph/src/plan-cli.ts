#!/usr/bin/env npx tsx
import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { planNext } from "./plan.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "state-dir": { type: "string", default: ".ralph" },
      json: { type: "boolean", default: true },
    },
  });
  const cfg = loadConfig(values["state-dir"]);
  const phase = planNext(cfg);
  if (values.json !== false) {
    console.log(JSON.stringify({ phase }, null, 2));
  } else {
    console.log(phase.type === "issue" ? `issue ${phase.issueNumber}` : phase.type);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
