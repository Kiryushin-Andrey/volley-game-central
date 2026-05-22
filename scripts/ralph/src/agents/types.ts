/** Pluggable remote agent backends (decoupled from Ralph loop orchestration). */

export type CloudProvider = "cursor" | "oz";

export interface AgentRunSession {
  provider: CloudProvider;
  title: string;
  url: string;
  /** Provider-specific ids (e.g. agent_id/run_id or oz run_id). */
  externalIds: Record<string, string>;
}

export interface RunPromptOptions {
  autoCreatePr?: boolean;
}

export interface CloudAgentRunner {
  readonly provider: CloudProvider;
  runPrompt(
    title: string,
    prompt: string,
    logPath: string,
    options?: RunPromptOptions,
  ): Promise<AgentRunSession>;
}

export interface CloudRunnerConfig {
  provider: CloudProvider;
  pollIntervalSec: number;
  repoUrl: string;
  branch: string;
  // Cursor
  cursorApiKey?: string;
  cloudEnv: Record<string, string>;
  cloudModel: string;
  autoCreatePr: boolean;
  cursorApiBase?: string;
  // Oz (Warp Agent Platform)
  warpApiKey?: string;
  ozEnvironmentId?: string;
  ozModelId?: string;
  ozConfigName?: string;
  ozApiBase?: string;
}
