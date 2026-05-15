#!/usr/bin/env python3
"""
Start a single Cloud Agent that runs the Ralph loop orchestrator in the foreground.

Your laptop only needs to run this once (or start the same prompt from cursor.com/agents).
The orchestrator VM runs:

  python3 scripts/ralph-player-levels-loop.py --backend cloud ...

Each implementation / E2E step still spawns a separate child Cloud Agent session.
"""

from __future__ import annotations

import argparse
import os
import shlex
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ralph_cloud import CloudAgentClient, repo_slug_to_url  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Launch a cloud orchestrator session for the Ralph loop.",
    )
    parser.add_argument("--repo", default="Kiryushin-Andrey/volley-game-central")
    parser.add_argument("--repo-url", default=None)
    parser.add_argument("--branch", default="cursor/player-levels-c8a4")
    parser.add_argument("--cursor-api-key", default=None)
    parser.add_argument(
        "loop_args",
        nargs=argparse.REMAINDER,
        help="Extra args for ralph-player-levels-loop.py (prefix with --)",
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
    elif "cloud" not in loop_argv:
        raise SystemExit("launch script requires --backend cloud on the inner loop")

    loop_cmd = " ".join(shlex.quote(a) for a in ["python3", "scripts/ralph-player-levels-loop.py", *loop_argv])
    repo_url = ns.repo_url or repo_slug_to_url(ns.repo)

    prompt = f"""You are the Ralph loop **orchestrator** Cloud Agent.

Your only job is to run the orchestrator script in the **foreground** from the repository root.
Do not implement product code yourself. Do not exit until the script process exits.

## Steps

1. Verify `CURSOR_API_KEY` is set (needed to spawn child cloud sessions).
2. Verify `gh` works (`gh auth status`) for issue discovery.
3. Ensure branch `{ns.branch}` exists on GitHub; push if the script uses `--push`.
4. Run exactly:

```bash
cd "$(git rev-parse --show-toplevel)"
{loop_cmd}
```

5. When the script finishes, summarize:
   - exit code
   - paths under `.ralph/logs/`
   - `cloud_sessions` from `.ralph/player-levels-state.json` (URLs for each child session)

## Architecture

- **This session** = orchestrator (stays alive for the whole loop).
- **Child sessions** = created by the script via API for each impl / E2E pass (visible at cursor.com/agents).

Read `.cursor/skills/ralph-cloud-loop/SKILL.md` if anything is unclear.
"""

    client = CloudAgentClient(api_key, repo_url, ns.branch)
    session = client.create_session(prompt, name_hint="ralph-orchestrator")
    print(f"Orchestrator session started: {session.url}")
    print(f"agent_id={session.agent_id} run_id={session.run_id}")
    print("You can close your laptop; the orchestrator runs on Cursor cloud.")
    print("Child step sessions will appear at cursor.com/agents as the loop progresses.")
    print(f"\nTo watch this orchestrator run, open:\n  {session.url}")


if __name__ == "__main__":
    main()
