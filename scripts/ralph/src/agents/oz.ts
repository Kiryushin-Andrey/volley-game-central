import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { announceCloudSession } from "../session-announce.js";
import type { AgentRunSession, CloudAgentRunner, RunPromptOptions } from "./types.js";
import type { CloudRunnerConfig } from "./types.js";

const OZ_API_BASE_DEFAULT = "https://app.warp.dev/api/v1";

/** Terminal Oz run states (see Oz API RunState). */
const OZ_TERMINAL = new Set([
  "SUCCEEDED",
  "FAILED",
  "ERROR",
  "CANCELLED",
  "BLOCKED",
]);

interface OzRunResponse {
  run_id: string;
  state?: string;
  session_link?: string;
}

interface OzRunItem {
  run_id: string;
  state: string;
  session_link?: string;
  status_message?: { message?: string };
}

export class OzCloudAgentRunner implements CloudAgentRunner {
  readonly provider = "oz" as const;

  constructor(private readonly cfg: CloudRunnerConfig) {}

  private apiKey(): string {
    const key = this.cfg.warpApiKey;
    if (!key) throw new Error("WARP_API_KEY required for oz cloud provider");
    return key;
  }

  private apiBase(): string {
    return (this.cfg.ozApiBase ?? OZ_API_BASE_DEFAULT).replace(/\/$/, "");
  }

  private environmentId(): string {
    const id = this.cfg.ozEnvironmentId;
    if (!id) {
      throw new Error(
        "OZ_ENVIRONMENT_ID (or --oz-environment-id) required for oz cloud provider — " +
          "create an environment at https://oz.warp.dev/",
      );
    }
    return id;
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey()}`,
    };
    let payload: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${this.apiBase()}${path}`, {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Oz API ${method} ${path} failed (${res.status}): ${detail}`);
    }
    return res;
  }

  private async createRun(
    title: string,
    prompt: string,
    autoCreatePr: boolean,
  ): Promise<OzRunResponse> {
    const config: Record<string, unknown> = {
      environment_id: this.environmentId(),
      name: this.cfg.ozConfigName ?? "ralph-loop",
    };
    if (this.cfg.ozModelId) {
      config.model_id = this.cfg.ozModelId;
    }
    const body: Record<string, unknown> = {
      prompt,
      title,
      config,
    };
    if (autoCreatePr) {
      body.create_pr = true;
    }
    const res = await this.request("POST", "/agent/run", body);
    return (await res.json()) as OzRunResponse;
  }

  private async retrieveRun(runId: string): Promise<OzRunItem> {
    const res = await this.request("GET", `/agent/runs/${runId}`);
    return (await res.json()) as OzRunItem;
  }

  private sessionUrl(run: OzRunItem): string {
    return (
      run.session_link ??
      `https://oz.warp.dev/runs/${run.run_id}`
    );
  }

  private async pollRunToLog(runId: string, logPath: string, initial?: OzRunResponse): Promise<OzRunItem> {
    mkdirSync(dirname(logPath), { recursive: true });
    let lastState = initial?.state ?? "QUEUED";
    let run: OzRunItem = {
      run_id: runId,
      state: lastState,
      session_link: initial?.session_link,
    };

    const header =
      `# Oz cloud agent run_id=${runId}\n` +
      (run.session_link ? `# session: ${run.session_link}\n` : "") +
      `\n`;
    writeFileSync(logPath, header, "utf-8");

    for (;;) {
      run = await this.retrieveRun(runId);
      if (run.state !== lastState) {
        lastState = run.state;
        const line = `[oz] run ${run.state}\n`;
        process.stdout.write(line);
        appendFileSync(logPath, line, "utf-8");
        if (run.session_link) {
          const linkLine = `Session: ${run.session_link}\n`;
          process.stdout.write(linkLine);
          appendFileSync(logPath, linkLine, "utf-8");
        }
        if (run.status_message?.message) {
          const msgLine = `[oz] ${run.status_message.message}\n`;
          process.stdout.write(msgLine);
          appendFileSync(logPath, msgLine, "utf-8");
        }
      }
      if (OZ_TERMINAL.has(run.state)) {
        return run;
      }
      await sleep(this.cfg.pollIntervalSec * 1000);
    }
  }

  async runPrompt(
    title: string,
    prompt: string,
    logPath: string,
    options?: RunPromptOptions,
  ): Promise<AgentRunSession> {
    console.log(`=== ${title} (oz) ===`);
    const autoCreatePr = options?.autoCreatePr ?? this.cfg.autoCreatePr;
    const created = await this.createRun(title, prompt, autoCreatePr);
    const initialUrl = created.session_link ?? `https://oz.warp.dev/runs/${created.run_id}`;
    console.log(`Session: ${initialUrl}`);
    announceCloudSession(this.cfg.stateDir, title, initialUrl);
    const runId = created.run_id;
    const run = await this.pollRunToLog(runId, logPath, created);
    const url = this.sessionUrl(run);
    if (run.state !== "SUCCEEDED") {
      throw new Error(
        `Oz run ended with state ${JSON.stringify(run.state)}. Open ${url} to inspect.`,
      );
    }
    return {
      provider: "oz",
      title,
      url,
      externalIds: { run_id: runId },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
