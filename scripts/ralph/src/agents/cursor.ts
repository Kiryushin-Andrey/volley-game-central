import { appendFileSync, createWriteStream, mkdirSync, WriteStream } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { announceCloudSession } from "../session-announce.js";
import type { AgentRunSession, CloudAgentRunner, RunPromptOptions } from "./types.js";
import type { CloudRunnerConfig } from "./types.js";

const API_BASE_DEFAULT = "https://api.cursor.com";
const TERMINAL_RUN_STATUSES = new Set(["FINISHED", "FAILED", "CANCELLED", "ERROR"]);

/** API model id for Cursor UI "Auto" (see GET /v1/models). */
export const CURSOR_MODEL_AUTO = "default";

interface CursorSession {
  agentId: string;
  runId: string;
  url: string;
}

export class CursorCloudAgentRunner implements CloudAgentRunner {
  readonly provider = "cursor" as const;

  constructor(private readonly cfg: CloudRunnerConfig) {}

  private authHeader(): string {
    const key = this.cfg.cursorApiKey;
    if (!key) throw new Error("CURSOR_API_KEY required for cursor cloud provider");
    return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
  }

  private apiBase(): string {
    return (this.cfg.cursorApiBase ?? API_BASE_DEFAULT).replace(/\/$/, "");
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    acceptSse = false,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader(),
    };
    let payload: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    if (acceptSse) {
      headers.Accept = "text/event-stream";
    }
    const init: RequestInit = { method, headers, body: payload };
    if (!acceptSse) {
      init.signal = AbortSignal.timeout(120_000);
    }
    const res = await fetch(`${this.apiBase()}${path}`, init);
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Cursor API ${method} ${path} failed (${res.status}): ${detail}`);
    }
    return res;
  }

  private async createSession(prompt: string, autoCreatePr: boolean): Promise<CursorSession> {
    const body: Record<string, unknown> = {
      prompt: { text: prompt },
      repos: [{ url: this.cfg.repoUrl, startingRef: this.cfg.branch }],
      workOnCurrentBranch: true,
      autoCreatePR: autoCreatePr,
      model: { id: this.cfg.cloudModel },
    };
    if (Object.keys(this.cfg.cloudEnv).length > 0) {
      body.envVars = this.cfg.cloudEnv;
    }
    const res = await this.request("POST", "/v1/agents", body);
    const payload = (await res.json()) as {
      agent: { id: string; url?: string };
      run: { id: string };
    };
    const agent = payload.agent;
    const run = payload.run;
    return {
      agentId: agent.id,
      runId: run.id,
      url: agent.url ?? `https://cursor.com/agents?id=${agent.id}`,
    };
  }

  private async getRun(agentId: string, runId: string): Promise<{ status?: string }> {
    const res = await this.request("GET", `/v1/agents/${agentId}/runs/${runId}`);
    return (await res.json()) as { status?: string };
  }

  private async streamRunToLog(session: CursorSession, logPath: string): Promise<string> {
    const res = await this.request(
      "GET",
      `/v1/agents/${session.agentId}/runs/${session.runId}/stream`,
      undefined,
      true,
    );
    if (!res.body) {
      throw new Error("SSE stream has no body");
    }

    mkdirSync(dirname(logPath), { recursive: true });
    const log = createWriteStream(logPath, { encoding: "utf-8" });
    log.write(`# Cursor cloud agent: ${session.url}\n`);
    log.write(`# agent_id=${session.agentId} run_id=${session.runId}\n\n`);

    let eventName = "";
    let finalStatus = "UNKNOWN";

    const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
    const rl = createInterface({ input: nodeStream, crlfDelay: Infinity });

    for await (const line of rl) {
      const trimmed = line.replace(/\r$/, "");
      if (!trimmed) continue;
      if (trimmed.startsWith("event:")) {
        eventName = trimmed.slice(6).trim();
        continue;
      }
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      try {
        const data = JSON.parse(dataStr) as Record<string, unknown>;
        if (eventName === "assistant" && typeof data.text === "string") {
          process.stdout.write(data.text);
          log.write(data.text);
        } else if (eventName === "thinking" && typeof data.text === "string") {
          log.write(`[thinking] ${data.text}`);
        } else if (
          (eventName === "status" || eventName === "result") &&
          typeof data.status === "string"
        ) {
          finalStatus = data.status;
          log.write(`\n# run status: ${finalStatus}\n`);
          process.stdout.write(`\n[cursor] run ${finalStatus}\n`);
        } else if (eventName === "error") {
          const msg =
            typeof data.message === "string" ? data.message : dataStr;
          log.write(`\n# stream error: ${msg}\n`);
          process.stdout.write(`\n[cursor] error: ${msg}\n`);
        }
      } catch {
        log.write(`${trimmed}\n`);
      }
    }

    await closeStream(log);

    if (!TERMINAL_RUN_STATUSES.has(finalStatus)) {
      finalStatus = await this.waitForRun(session);
    }
    return finalStatus;
  }

  private async waitForRun(session: CursorSession): Promise<string> {
    for (;;) {
      const run = await this.getRun(session.agentId, session.runId);
      const status = run.status ?? "UNKNOWN";
      if (TERMINAL_RUN_STATUSES.has(status)) {
        return status;
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
    console.log(`=== ${title} (cursor) ===`);
    const autoCreatePr = options?.autoCreatePr ?? this.cfg.autoCreatePr;
    const session = await this.createSession(prompt, autoCreatePr);
    console.log(`Session: ${session.url}`);
    announceCloudSession(this.cfg.stateDir, title, session.url);
    try {
      const status = await this.streamRunToLog(session, logPath);
      if (status !== "FINISHED") {
        throw new Error(
          `Cursor run ended with status ${JSON.stringify(status)}. Open ${session.url} to inspect.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Cursor run ended")) throw err;
      console.error(`[cursor] stream failed (${msg}), polling run status…`);
      const status = await this.waitForRun(session);
      appendFileSync(logPath, `\n# stream fallback; final status: ${status}\n`, "utf-8");
      if (status !== "FINISHED") {
        throw new Error(
          `Cursor run ended with status ${JSON.stringify(status)}. Open ${session.url} to inspect.`,
        );
      }
    }
    return {
      provider: "cursor",
      title,
      url: session.url,
      externalIds: { agent_id: session.agentId, run_id: session.runId },
    };
  }
}

function closeStream(log: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    log.end((err: NodeJS.ErrnoException | null) => (err ? reject(err) : resolve()));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
