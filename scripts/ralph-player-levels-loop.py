#!/usr/bin/env python3
"""Deprecated shim — use scripts/ralph-loop.py with .ralph/examples/player-levels.sh"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent / "ralph-loop.py"
_EXAMPLE = Path(__file__).resolve().parent.parent / ".ralph/examples/player-levels.sh"


def main() -> None:
    print(
        "ralph-player-levels-loop.py was renamed to ralph-loop.py\n"
        f"  Example: source {_EXAMPLE} && python3 scripts/ralph-loop.py …\n",
        file=sys.stderr,
    )
    if len(sys.argv) <= 1:
        print("Pass the same flags as ralph-loop.py (see --help).", file=sys.stderr)
        sys.exit(1)
    raise SystemExit(
        subprocess.call([sys.executable, str(_SCRIPT), *sys.argv[1:]])
    )


if __name__ == "__main__":
    main()
