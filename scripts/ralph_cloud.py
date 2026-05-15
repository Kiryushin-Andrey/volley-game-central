"""Cursor Cloud Agents API client for Ralph loop (stdlib only)."""

from __future__ import annotations

import base64
import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

API_BASE_DEFAULT = "https://api.cursor.com"
TERMINAL_RUN_STATUSES = frozenset({"FINISHED", "FAILED", "CANCELLED", "ERROR"})


@dataclass
class CloudAgentSession:
    agent_id: str
    run_id: str
    url: str


class CloudAgentClient:
    """One POST /v1/agents per call — each Ralph pass is its own cloud session."""

    def __init__(
        self,
        api_key: str,
        repo_url: str,
        branch: str,
        *,
        api_base: str = API_BASE_DEFAULT,
        poll_interval: float = 15.0,
        env_vars: dict[str, str] | None = None,
        auto_create_pr: bool = False,
    ) -> None:
        self.api_key = api_key
        self.repo_url = repo_url
        self.branch = branch
        self.api_base = api_base.rstrip("/")
        self.poll_interval = poll_interval
        self.env_vars = env_vars or {}
        self.auto_create_pr = auto_create_pr

    def _auth_header(self) -> str:
        token = base64.b64encode(f"{self.api_key}:".encode()).decode("ascii")
        return f"Basic {token}"

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        *,
        accept_sse: bool = False,
    ) -> Any:
        url = f"{self.api_base}{path}"
        data = None
        headers = {"Authorization": self._auth_header()}
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if accept_sse:
            headers["Accept"] = "text/event-stream"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                if accept_sse:
                    return resp
                raw = resp.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            raise RuntimeError(f"Cloud API {method} {path} failed ({exc.code}): {detail}") from exc

    def create_session(self, prompt: str, *, name_hint: str) -> CloudAgentSession:
        body: dict[str, Any] = {
            "prompt": {"text": prompt},
            "repos": [
                {
                    "url": self.repo_url,
                    "startingRef": self.branch,
                }
            ],
            "branchName": self.branch,
            "autoGenerateBranch": False,
            "autoCreatePR": self.auto_create_pr,
        }
        if self.env_vars:
            body["envVars"] = self.env_vars

        payload = self._request("POST", "/v1/agents", body)
        agent = payload["agent"]
        run = payload["run"]
        return CloudAgentSession(
            agent_id=agent["id"],
            run_id=run["id"],
            url=agent.get("url") or f"https://cursor.com/agents?id={agent['id']}",
        )

    def get_run(self, agent_id: str, run_id: str) -> dict[str, Any]:
        return self._request("GET", f"/v1/agents/{agent_id}/runs/{run_id}")

    def stream_run_to_log(self, session: CloudAgentSession, log_path: Path) -> str:
        """Stream SSE assistant output to log_path; return final run status."""
        path = f"/v1/agents/{session.agent_id}/runs/{session.run_id}/stream"
        resp = self._request("GET", path, accept_sse=True)
        assert not isinstance(resp, dict)

        log_path.parent.mkdir(parents=True, exist_ok=True)
        assistant_parts: list[str] = []
        final_status = "UNKNOWN"

        with log_path.open("w", encoding="utf-8") as log:
            log.write(f"# Cloud agent: {session.url}\n")
            log.write(f"# agent_id={session.agent_id} run_id={session.run_id}\n\n")

            event_name = ""
            for raw_line in resp:
                line = raw_line.decode(errors="replace").rstrip("\r\n")
                if not line:
                    continue
                if line.startswith("event:"):
                    event_name = line.split(":", 1)[1].strip()
                    continue
                if not line.startswith("data:"):
                    continue
                data_str = line.split(":", 1)[1].strip()
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    log.write(line + "\n")
                    continue

                if event_name == "assistant" and "text" in data:
                    chunk = data["text"]
                    assistant_parts.append(chunk)
                    sys.stdout.write(chunk)
                    log.write(chunk)
                elif event_name == "thinking" and "text" in data:
                    log.write(f"[thinking] {data['text']}")
                elif event_name in ("status", "result") and "status" in data:
                    final_status = data["status"]
                    log.write(f"\n# run status: {final_status}\n")
                    sys.stdout.write(f"\n[cloud] run {final_status}\n")
                elif event_name == "error":
                    msg = data.get("message", data_str)
                    log.write(f"\n# stream error: {msg}\n")
                    sys.stdout.write(f"\n[cloud] error: {msg}\n")

        if final_status not in TERMINAL_RUN_STATUSES:
            final_status = self.wait_for_run(session)
        return final_status

    def wait_for_run(self, session: CloudAgentSession) -> str:
        while True:
            run = self.get_run(session.agent_id, session.run_id)
            status = run.get("status", "UNKNOWN")
            if status in TERMINAL_RUN_STATUSES:
                return status
            time.sleep(self.poll_interval)

    def run_prompt(self, title: str, prompt: str, log_path: Path) -> CloudAgentSession:
        print(f"=== {title} (cloud) ===")
        session = self.create_session(prompt, name_hint=title)
        print(f"Session: {session.url}")
        try:
            status = self.stream_run_to_log(session, log_path)
        except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            print(f"[cloud] stream failed ({exc}), polling run status…", file=sys.stderr)
            status = self.wait_for_run(session)
            with log_path.open("a", encoding="utf-8") as log:
                log.write(f"\n# stream fallback; final status: {status}\n")
        if status != "FINISHED":
            raise RuntimeError(
                f"Cloud run ended with status {status!r}. "
                f"Open {session.url} to inspect or send a follow-up."
            )
        return session


def repo_slug_to_url(slug: str) -> str:
    return f"https://github.com/{slug}"
