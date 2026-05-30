import type { LocalWorkerInvocation, LocalWorkerKind, WorkerKind } from "./types.js";
import { DEFAULT_WORKER, isRemoteWorker, WORKER_KINDS, workerAgentName } from "./types.js";

export { DEFAULT_WORKER, WORKER_KINDS, workerAgentName };

export function parseWorkerKind(raw: string): WorkerKind {
  const normalized = raw.trim().toLowerCase();
  if ((WORKER_KINDS as readonly string[]).includes(normalized)) {
    return normalized as WorkerKind;
  }
  console.error(
    `--worker must be one of: ${WORKER_KINDS.join(", ")}\n` + `  got: ${JSON.stringify(raw)}`,
  );
  process.exit(1);
}

/** Map deprecated --backend / --cloud-provider / --agent-cmd to --worker. */
export function resolveWorkerFromArgv(values: {
  worker?: string;
  backend?: string;
  "cloud-provider"?: string;
  "agent-cmd"?: string;
}): WorkerKind {
  if (values.worker) {
    return parseWorkerKind(values.worker);
  }

  if (values.backend === "cloud") {
    const provider = (values["cloud-provider"] ?? "cursor").toLowerCase();
    console.warn(
      "warn: --backend cloud and --cloud-provider are deprecated; use --worker remote-cursor or remote-oz",
    );
    if (provider === "oz") return "remote-oz";
    if (provider === "cursor") return "remote-cursor";
    console.error(`--cloud-provider must be cursor or oz, got: ${JSON.stringify(provider)}`);
    process.exit(1);
  }

  if (values.backend && values.backend !== "local") {
    console.error(`--backend must be local or cloud, got: ${JSON.stringify(values.backend)}`);
    process.exit(1);
  }

  const agentCmd = values["agent-cmd"];
  if (agentCmd && agentCmd !== "agent") {
    console.warn("warn: --agent-cmd is deprecated; use --worker local-cursor|local-claude|local-codex");
    const map: Record<string, WorkerKind> = {
      agent: "local-cursor",
      claude: "local-claude",
      codex: "local-codex",
    };
    const mapped = map[agentCmd];
    if (mapped) return mapped;
    console.error(
      `Unknown --agent-cmd ${JSON.stringify(agentCmd)}. Use --worker instead: ${WORKER_KINDS.filter((w) => w.startsWith("local-")).join(", ")}`,
    );
    process.exit(1);
  }

  if (values.backend === "local" || values["cloud-provider"] || values["agent-cmd"]) {
    if (values.backend === "local") {
      console.warn("warn: --backend local is deprecated; use --worker local-cursor (default)");
    }
  }

  return DEFAULT_WORKER;
}

/**
 * Build argv for a non-interactive local worker CLI (binaries must be on PATH).
 * @see https://docs.cursor.com — `agent -p`
 * @see https://code.claude.com/docs/en/cli-reference — `claude -p`
 * @see https://developers.openai.com/codex/noninteractive — `codex exec`
 */
export function buildLocalInvocation(kind: LocalWorkerKind, prompt: string): LocalWorkerInvocation {
  switch (kind) {
    case "local-cursor":
      return {
        command: "agent",
        args: ["-p", "--force", "--", prompt],
      };
    case "local-claude":
      return {
        command: "claude",
        args: ["-p", prompt, "--permission-mode", "acceptEdits"],
      };
    case "local-codex":
      return {
        command: "codex",
        args: [
          "exec",
          "--sandbox",
          "workspace-write",
          "--ask-for-approval",
          "never",
          prompt,
        ],
      };
    default: {
      const k = kind as LocalWorkerKind;
      throw new Error(`Unknown local worker: ${k}`);
    }
  }
}

export function remoteWorkerRequiresPush(kind: WorkerKind): boolean {
  return isRemoteWorker(kind);
}
