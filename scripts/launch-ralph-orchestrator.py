#!/usr/bin/env python3
"""
Start one Cloud Agent that runs the Ralph loop orchestrator in the foreground.

Each implementation / E2E step is still a separate child Cloud Agent session.
"""

from __future__ import annotations

import argparse
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ralph_cloud import CloudAgentClient, repo_slug_to_url  # noqa: E402


def _detect_repo_slug(root: Path) -> str:
    url = subprocess.check_output(
        ["git", "remote", "get-url", "origin"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    match = re.search(r"github\.com[:/]([^/]+)/([^/.]+)", url)
    if not match:
        raise SystemExit(f"Cannot parse GitHub repo from origin URL: {url}")
    return f"{match.group(1)}/{match.group(2)}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Launch a cloud orchestrator session for the Ralph loop.",
    )
    parser.add_argument("--repo", default=None, help="owner/repo (default: git origin)")
    parser.add_argument("--repo-url", default=None)
    parser.add_argument(
        "--branch",
        required=True,
        help="Integration branch the orchestrator will use",
    )
    parser.add_argument("--cursor-api-key", default=None)
    parser.add_argument(
        "loop_args",
        nargs=argparse.REMAINDER,
        help="Args for ralph-loop.py (--parent-issue, --child-issues, --prd, --e2e, …; prefix with --)",
    )
    ns = parser.parse_args()
    api_key = ns.cursor_api_key or os.environ.get("CURSOR_API_KEY")
    if not api_key:
        raise SystemExit("Set CURSOR_API_KEY or pass --cursor-api-key")

    loop_argv = list(ns.loop_args or [])
    if loop_argv and loop_argv[0] == "--":
        loop_argv = loop_argv[1:]
    if "--backend" not in loop_argv:
        loop_argv = ["--backend", "cloud", *loop_argv]
    if "--branch" not in loop_argv:
        loop_argv = ["--branch", ns.branch, *loop_argv]

    loop_cmd = " ".join(shlex.quote(a) for a in ["python3", "scripts/ralph-loop.py", *loop_argv])

    has_children = any(
        loop_argv[i] == "--child-issues" for i in range(len(loop_argv) - 1)
    )
    discover_step = ""
    if not has_children:
        discover_step = """
2. **Discover and order child issues** (skill ralph-cloud-loop, steps 1–2): read each slice
   issue (gh and/or docs/issues/), reason about dependencies — do not sort by issue number
   or parse fixed markdown headings — then pass dependency-ordered `--child-issues` to step 3.
   Include a short ordering note in your final report.
"""
    else:
        discover_step = "\n2. Child issues are already in the command below.\n"

    prompt = f"""You are the Ralph loop **orchestrator** Cloud Agent.

Run in the **foreground**. Do not implement product slices yourself.

1. Verify `CURSOR_API_KEY`. For steps 1–2 you need a way to read GitHub issues (e.g. `gh`).
{discover_step}
3. Ensure the integration branch exists on GitHub, then run:

```bash
cd "$(git rev-parse --show-toplevel)"
{loop_cmd}
```

(If step 2 applied, append the discovered numbers to `--child-issues`.)

4. Report exit code and `cloud_sessions` from `.ralph/ralph-state.json`.

Full workflow: `.cursor/skills/ralph-cloud-loop/SKILL.md`
"""

    if ns.repo_url:
        url = ns.repo_url
    elif ns.repo:
        url = repo_slug_to_url(ns.repo)
    else:
        root = Path(
            subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
        )
        url = repo_slug_to_url(_detect_repo_slug(root))

    client = CloudAgentClient(api_key, url, ns.branch)
    session = client.create_session(prompt, name_hint="ralph-orchestrator")
    print(f"Orchestrator session: {session.url}")
    print(f"agent_id={session.agent_id} run_id={session.run_id}")
    print("You can close your laptop; child sessions appear at cursor.com/agents.")


if __name__ == "__main__":
    main()
