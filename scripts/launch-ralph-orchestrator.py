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
from ralph_prompts import DEFAULT_PROMPTS_DIR, PromptLoader  # noqa: E402


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
        "--prompts-dir",
        type=Path,
        default=DEFAULT_PROMPTS_DIR,
        help="Directory of prompt markdown templates (default: %(default)s)",
    )
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

    prompts = PromptLoader(ns.prompts_dir)
    has_children = any(
        loop_argv[i] == "--child-issues" for i in range(len(loop_argv) - 1)
    )
    discover_name = (
        "orchestrator-children-known" if has_children else "orchestrator-discover-children"
    )
    discover_step = prompts.load(discover_name)
    prompt = prompts.render("orchestrator", discover_step=discover_step, loop_cmd=loop_cmd)

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
