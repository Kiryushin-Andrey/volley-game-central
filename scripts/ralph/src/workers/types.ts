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

export type RemoteWorkerKind = Extract<WorkerKind, `remote-${string}`>;

export function parseWorkerKind(raw: string): WorkerKind {
  const normalized = raw.trim().toLowerCase();
  if ((WORKER_KINDS as readonly string[]).includes(normalized)) {
    return normalized as WorkerKind;
  }
  throw new Error(
    `ralph.config.json worker must be one of: ${WORKER_KINDS.join(", ")}; got: ${JSON.stringify(raw)}`,
  );
}

export function isRemoteWorker(kind: WorkerKind): kind is RemoteWorkerKind {
  return kind.startsWith("remote-");
}

/** Short label for logs and prompts (e.g. `cursor`, `claude`). */
export function workerAgentName(kind: WorkerKind): string {
  const part = kind.includes("-") ? kind.split("-").slice(1).join("-") : kind;
  return part;
}
