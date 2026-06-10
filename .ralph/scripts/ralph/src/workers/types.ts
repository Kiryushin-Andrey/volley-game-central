/** Ralph slice worker — local CLI or remote platform. */
export type WorkerKind =
  | "local-cursor"
  | "local-claude"
  | "local-codex"
  | "remote-cursor"
  | "remote-oz";

export const WORKER_KINDS: readonly WorkerKind[] = [
  "local-cursor",
  "local-claude",
  "local-codex",
  "remote-cursor",
  "remote-oz",
] as const;

export const DEFAULT_WORKER: WorkerKind = "local-cursor";

export type LocalWorkerKind = Extract<WorkerKind, `local-${string}`>;
export type RemoteWorkerKind = Extract<WorkerKind, `remote-${string}`>;

/** Remote platform id (suffix after `remote-`). */
export type RemoteProvider = "cursor" | "oz";

export interface LocalWorkerInvocation {
  /** Binary on PATH (checked before spawn). */
  command: string;
  args: string[];
}

export function isRemoteWorker(kind: WorkerKind): kind is RemoteWorkerKind {
  return kind.startsWith("remote-");
}

export function remoteProvider(kind: RemoteWorkerKind): RemoteProvider {
  const suffix = kind.slice("remote-".length);
  if (suffix === "cursor" || suffix === "oz") return suffix;
  throw new Error(`Unknown remote worker: ${kind}`);
}

/** Short label for logs and prompts (e.g. `cursor`, `claude`). */
export function workerAgentName(kind: WorkerKind): string {
  const part = kind.includes("-") ? kind.split("-").slice(1).join("-") : kind;
  return part;
}
