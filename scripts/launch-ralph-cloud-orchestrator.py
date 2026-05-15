#!/usr/bin/env python3
"""Deprecated shim — use scripts/launch-ralph-orchestrator.py"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent / "launch-ralph-orchestrator.py"


def main() -> None:
    print(
        "launch-ralph-cloud-orchestrator.py was renamed to launch-ralph-orchestrator.py\n",
        file=sys.stderr,
    )
    raise SystemExit(subprocess.call([sys.executable, str(_SCRIPT), *sys.argv[1:]]))


if __name__ == "__main__":
    main()
