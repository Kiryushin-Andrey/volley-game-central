import { appendFileSync, createWriteStream, mkdirSync, WriteStream } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";

const API_BASE_DEFAULT = "https://api.cursor.com";
const TERMINAL_RUN_STATUSES = new Set(["FINISHED", "FAILED", "CANCELLED", "ERROR"]);

export interface CloudAgentSession {
  agentId: string;
  runId: string;
  url: string;
}

/** API model id for Cursor UI "Auto" (see GET /v1/models). */
export const CLOUD_MODEL_AUTO = "default";

export class CloudAgentClient {
  constructor(
    private readonly apiKey: string,
    private readonly repoUrl: string,
    private readonly branch: string,
    private readonly pollInterval = 15,
    private readonly envVars: Record<string, string> = {},
    private readonly autoCreatePr = false,
    private readonly apiBase = API_BASE_DEFAULT,
    private readonly modelId: string = CLOUD_MODEL_AUTO,
  ) {}

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`;
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
    const res = await fetch(`${this.apiBase.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(600_000),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Cloud API ${method} ${path} failed (${res.status}): ${detail}`);
    }
    return res;
  }

  async createSession(prompt: string, _nameHint: string): Promise<CloudAgentSession> {
    const body: Record<string, unknown> = {
      prompt: { text: prompt },
      repos: [{ url: this.repoUrl, startingRef: this.branch }],
      workOnCurrentBranch: true,
      autoCreatePR: this.autoCreatePr,
      model: { id: this.modelId },
    };
    if (Object.keys(this.envVars).length > 0) {
      body.envVars = this.envVars;
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

  async getRun(agentId: string, runId: string): Promise<{ status?: string }> {
    const res = await this.request("GET", `/v1/agents/${agentId}/runs/${runId}`);
    return (await res.json()) as { status?: string };
  }

  async streamRunToLog(session: CloudAgentSession, logPath: string): Promise<string> {
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
    log.write(`# Cloud agent: ${session.url}\n`);
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
          process.stdout.write(`\n[cloud] run ${finalStatus}\n`);
        } else if (eventName === "error") {
          const msg =
            typeof data.message === "string" ? data.message : dataStr;
          log.write(`\n# stream error: ${msg}\n`);
          process.stdout.write(`\n[cloud] error: ${msg}\n`);
        }
      } catch {
        log.write(`${trimmed}\n`);
      }
    }

    await new Promise<void>((resolve, reject) => {
      log.end((err) => (err ? reject(err) : resolve()));
    });

    if (!TERMINAL_RUN_STATUSES.has(finalStatus)) {
      finalStatus = await this.waitForRun(session);
    }
    return finalStatus;
  }

  async waitForRun(session: CloudAgentSession): Promise<string> {
    for (;;) {
      const run = await this.getRun(session.agentId, session.runId);
      const status = run.status ?? "UNKNOWN";
      if (TERMINAL_RUN_STATUSES.has(status)) {
        return status;
      }
      await sleep(this.pollInterval * 1000);
    }
  }

  async runPrompt(
    title: string,
    prompt: string,
    logPath: string,
  ): Promise<CloudAgentSession> {
    console.log(`=== ${title} (cloud) ===`);
    const session = await this.createSession(prompt, title);
    console.log(`Session: ${session.url}`);
    try {
      const status = await this.streamRunToLog(session, logPath);
      if (status !== "FINISHED") {
        throw new Error(
          `Cloud run ended with status ${JSON.stringify(status)}. Open ${session.url} to inspect.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Cloud run ended")) throw err;
      console.error(`[cloud] stream failed (${msg}), polling run status…`);
      const status = await this.waitForRun(session);
      appendFileSync(logPath, `\n# stream fallback; final status: ${status}\n`, "utf-8");
      if (status !== "FINISHED") {
        throw new Error(
          `Cloud run ended with status ${JSON.stringify(status)}. Open ${session.url} to inspect.`,
        );
      }
    }
    return session;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
