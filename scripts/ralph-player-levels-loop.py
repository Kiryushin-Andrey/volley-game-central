#!/usr/bin/env python3
"""
Ralph loop — autonomous implementation driver for a parent GitHub issue.

1. Finds child slice issues linked to a parent issue (e.g. #8) on GitHub.
2. For each child, in order:
     a) Runs Cursor Agent to implement the slice.
     b) Runs Cursor Agent to execute the matching browser E2E suite.
3. Runs a final Agent pass: Suite D regression, one combined PR.

Task details live in repo files (CONTEXT.md, PRD, E2E plan), not in this script.
Progress is gated by lines the Agent must print when done:

  RALPH_ISSUE_COMPLETE #<n>
  RALPH_E2E_COMPLETE SUITE_X
  RALPH_ALL_COMPLETE

Prerequisites: git, gh, Cursor CLI (`agent`).
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Sequence

def _body_links_parent(body: str, parent: int) -> bool:
    return bool(re.search(rf"## Parent[\s\S]*?/issues/{parent}\b", body))


@dataclass
class Config:
    repo: str
    parent_issue: int
    child_issues: list[int] | None
    branch: str
    base: str
    context: Path
    prd: Path
    e2e: Path
    state_dir: Path
    agent_cmd: str
    max_impl: int
    max_e2e: int
    dry_run: bool
    skip_e2e: bool
    from_issue: int
    push: bool

    @property
    def state_file(self) -> Path:
        return self.state_dir / "player-levels-state.json"

    @property
    def logs_dir(self) -> Path:
        return self.state_dir / "logs"

    @property
    def steering_file(self) -> Path:
        return self.state_dir / "STEERING.md"

    @property
    def screenshots_dir(self) -> Path:
        return self.state_dir / "screenshots"


def parse_args(argv: Sequence[str] | None = None) -> Config:
    parser = argparse.ArgumentParser(
        description="Ralph loop: implement child GitHub issues + E2E verification.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --dry-run
  %(prog)s --parent-issue 8 --branch cursor/player-levels-c8a4
  %(prog)s --from 21 --push
  %(prog)s --child-issues 20 21 22 --skip-e2e
        """.strip(),
    )
    parser.add_argument(
        "--repo",
        default="Kiryushin-Andrey/volley-game-central",
        help="GitHub owner/repo (default: %(default)s)",
    )
    parser.add_argument(
        "-p",
        "--parent-issue",
        type=int,
        default=8,
        help="Parent epic / PRD issue number (default: %(default)s)",
    )
    parser.add_argument(
        "--child-issues",
        type=int,
        nargs="+",
        metavar="N",
        help="Child issue numbers (default: discover via ## Parent link on GitHub)",
    )
    parser.add_argument(
        "--branch",
        default="cursor/player-levels-c8a4",
        help="Integration branch for one combined PR (default: %(default)s)",
    )
    parser.add_argument(
        "--base",
        default="main",
        help="Base branch (default: %(default)s)",
    )
    parser.add_argument(
        "--context",
        type=Path,
        default=Path("CONTEXT.md"),
        help="Domain glossary path (default: %(default)s)",
    )
    parser.add_argument(
        "--prd",
        type=Path,
        default=Path("docs/prd/player-levels-and-game-format.md"),
        help="PRD path (default: %(default)s)",
    )
    parser.add_argument(
        "--e2e",
        type=Path,
        default=Path("docs/testing/e2e-player-levels-browser-agent.md"),
        help="Browser E2E plan path (default: %(default)s)",
    )
    parser.add_argument(
        "--state-dir",
        type=Path,
        default=Path(".ralph"),
        help="Progress logs and state JSON (default: %(default)s)",
    )
    parser.add_argument(
        "--agent-cmd",
        default="agent",
        help="Cursor CLI command (default: %(default)s)",
    )
    parser.add_argument(
        "--max",
        "--max-impl",
        dest="max_impl",
        type=int,
        default=0,
        help="Max retries per implementation pass; 0 = unlimited (default: %(default)s)",
    )
    parser.add_argument(
        "--max-e2e",
        type=int,
        default=5,
        help="Max retries per E2E pass (default: %(default)s)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print prompts only; do not run agent or git",
    )
    parser.add_argument(
        "--skip-e2e",
        action="store_true",
        help="Skip browser E2E verification passes",
    )
    parser.add_argument(
        "--from",
        dest="from_issue",
        type=int,
        default=0,
        metavar="N",
        help="Skip child issues with number < N (resume aid)",
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="git push after each milestone",
    )
    ns = parser.parse_args(argv)
    return Config(
        repo=ns.repo,
        parent_issue=ns.parent_issue,
        child_issues=ns.child_issues,
        branch=ns.branch,
        base=ns.base,
        context=ns.context,
        prd=ns.prd,
        e2e=ns.e2e,
        state_dir=ns.state_dir,
        agent_cmd=ns.agent_cmd,
        max_impl=ns.max_impl,
        max_e2e=ns.max_e2e,
        dry_run=ns.dry_run,
        skip_e2e=ns.skip_e2e,
        from_issue=ns.from_issue,
        push=ns.push,
    )


class RalphLoop:
    def __init__(self, cfg: Config, root: Path) -> None:
        self.cfg = cfg
        self.root = root
        self.issue_numbers: list[int] = []
        self.state: dict = {}
        self.last_log: Path | None = None

    # --- GitHub ----------------------------------------------------------------

    def issue_url(self, number: int) -> str:
        return f"https://github.com/{self.cfg.repo}/issues/{number}"

    def discover_child_issues(self) -> list[int]:
        """Issues whose body contains ## Parent linking to parent_issue."""
        result = subprocess.run(
            [
                "gh",
                "issue",
                "list",
                "--repo",
                self.cfg.repo,
                "--state",
                "all",
                "--limit",
                "200",
                "--json",
                "number,body",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        parent = self.cfg.parent_issue
        numbers: list[int] = []
        for item in json.loads(result.stdout):
            n = item["number"]
            body = item.get("body") or ""
            if n == parent:
                continue
            if _body_links_parent(body, parent):
                numbers.append(n)
        return sorted(numbers)

    def load_child_issues(self) -> None:
        if self.cfg.child_issues is not None:
            self.issue_numbers = sorted(self.cfg.child_issues)
            return
        self.issue_numbers = self.discover_child_issues()
        if not self.issue_numbers:
            raise SystemExit(
                f"No child issues found for parent #{self.cfg.parent_issue} "
                "(expected ## Parent link in issue body)."
            )

    def suite_for(self, issue_number: int) -> str:
        """1st child → A, 2nd → B, … (see E2E doc §11)."""
        try:
            idx = self.issue_numbers.index(issue_number)
        except ValueError as exc:
            raise ValueError(f"Issue #{issue_number} not in child list") from exc
        return chr(ord("A") + idx)

    def closes_clause(self) -> str:
        return ", ".join(f"Closes #{n}" for n in self.issue_numbers)

    # --- State -----------------------------------------------------------------

    def init_state(self) -> None:
        self.cfg.state_dir.mkdir(parents=True, exist_ok=True)
        self.cfg.logs_dir.mkdir(parents=True, exist_ok=True)
        self.cfg.screenshots_dir.mkdir(parents=True, exist_ok=True)

        path = self.cfg.state_file
        if path.exists():
            self.state = json.loads(path.read_text())
        else:
            self.state = {
                "parent_issue": self.cfg.parent_issue,
                "branch": self.cfg.branch,
                "completed_issues": [],
                "completed_e2e_suites": [],
                "final_complete": False,
            }
            self._write_state()

        if "completed_e2e_suites" not in self.state:
            self.state["completed_e2e_suites"] = []
            self._write_state()

    def _write_state(self) -> None:
        path = self.cfg.state_file
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.state, indent=2) + "\n")
        tmp.replace(path)

    def issue_done(self, n: int) -> bool:
        return n in self.state.get("completed_issues", [])

    def mark_issue(self, n: int) -> None:
        issues = self.state.setdefault("completed_issues", [])
        if n not in issues:
            issues.append(n)
            issues.sort()
        self._write_state()

    def mark_suite(self, letter: str) -> None:
        suites = self.state.setdefault("completed_e2e_suites", [])
        if letter not in suites:
            suites.append(letter)
        self._write_state()

    def mark_final(self) -> None:
        self.state["final_complete"] = True
        self._write_state()

    # --- Agent -----------------------------------------------------------------

    @staticmethod
    def has_promise(log_path: Path, promise: str) -> bool:
        if not log_path.is_file():
            return False
        pattern = re.compile(rf"^\s*{re.escape(promise)}\s*$", re.MULTILINE)
        return bool(pattern.search(log_path.read_text(errors="replace")))

    def run_agent(self, title: str, prompt: str, log_path: Path) -> None:
        if self.cfg.dry_run:
            print(f"=== {title} ===")
            print(prompt)
            return
        print(f"=== {title} ===")
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("w") as log_file:
            proc = subprocess.Popen(
                [self.cfg.agent_cmd, "-p", "--force", "--", prompt],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            assert proc.stdout is not None
            for line in proc.stdout:
                sys.stdout.write(line)
                log_file.write(line)
            proc.wait()

    def maybe_push(self) -> None:
        if self.cfg.dry_run or not self.cfg.push:
            return
        r = subprocess.run(
            ["git", "push", "-u", "origin", self.cfg.branch],
            cwd=self.root,
        )
        if r.returncode != 0:
            print("warn: push failed", file=sys.stderr)

    # --- Prompts ---------------------------------------------------------------

    def refs_block(self, issue: int | None = None) -> str:
        lines = [
            "Read in the repo (required):",
            f"- {self.cfg.context}",
            f"- {self.cfg.prd}  (parent #{self.cfg.parent_issue})",
            f"- {self.cfg.e2e}",
        ]
        if self.cfg.steering_file.is_file():
            lines.append(f"- {self.cfg.steering_file}  (steering — highest priority)")
        if issue is not None:
            lines.append(f"- GitHub issue #{issue}: {self.issue_url(issue)}")
        lines.append(
            f"Work on branch {self.cfg.branch} (base {self.cfg.base}). "
            f"One PR for parent #{self.cfg.parent_issue}."
        )
        return "\n".join(lines)

    def prompt_impl(self, n: int) -> str:
        suite = self.suite_for(n)
        return f"""Ralph loop — implementation pass, issue #{n}.

{self.refs_block(n)}

Implement per that issue and {self.cfg.prd}. Follow {self.cfg.context} for terms.
Commit and push to {self.cfg.branch}. Next automated step: E2E Suite {suite} ({self.cfg.e2e}).

Output on its own line when done:
RALPH_ISSUE_COMPLETE #{n}
"""

    def prompt_e2e(self, suite: str, n: int) -> str:
        return f"""Ralph loop — E2E pass, Suite {suite}.

{self.refs_block(n)}

Execute Suite {suite} from {self.cfg.e2e} (§6–§8). Screenshots: {self.cfg.screenshots_dir}/.
Minimal fixes on {self.cfg.branch} only; commit and push if you change code.

Output on its own line when all Suite {suite} tests pass:
RALPH_E2E_COMPLETE SUITE_{suite}
"""

    def prompt_final(self) -> str:
        return f"""Ralph loop — final pass.

{self.refs_block()}

Run unit tests; Suite D in {self.cfg.e2e}; one draft PR {self.cfg.branch} → {self.cfg.base} ({self.closes_clause()}).
Progress: {self.cfg.state_file}

Output on its own lines when done:
RALPH_E2E_COMPLETE SUITE_D
RALPH_ALL_COMPLETE
"""

    def run_until_promise(
        self,
        max_iters: int,
        title: str,
        promise: str,
        prompt_fn: Callable[[], str],
    ) -> None:
        i = 1
        while True:
            if max_iters > 0 and i > max_iters:
                raise SystemExit(f"max iterations: {title}")
            prompt = prompt_fn()
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            log_path = self.cfg.logs_dir / f"{title}-iter{i}-{stamp}.log"
            try:
                self.run_agent(f"{title}-iter{i}", prompt, log_path)
            except OSError:
                pass
            self.last_log = log_path
            if self.cfg.dry_run:
                print(f"(dry-run) would wait for: {promise}")
                return
            if self.has_promise(log_path, promise):
                print(f"OK: {promise}")
                return
            print(f"missing: {promise} (see {log_path})")
            i += 1
            time.sleep(3)

    # --- Git -------------------------------------------------------------------

    def ensure_branch(self) -> None:
        subprocess.run(
            ["git", "fetch", "origin", self.cfg.base, self.cfg.branch],
            cwd=self.root,
            capture_output=True,
        )
        checkout = subprocess.run(
            ["git", "checkout", self.cfg.branch],
            cwd=self.root,
            capture_output=True,
        )
        if checkout.returncode != 0:
            subprocess.run(
                ["git", "checkout", "-B", self.cfg.branch, f"origin/{self.cfg.base}"],
                cwd=self.root,
                check=True,
            )

    # --- Main loop -------------------------------------------------------------

    def run(self) -> None:
        for cmd in ("git", "gh"):
            if shutil.which(cmd) is None:
                raise SystemExit(f"need: {cmd}")
        if not self.cfg.dry_run and shutil.which(self.cfg.agent_cmd) is None:
            raise SystemExit(f"need: {self.cfg.agent_cmd}")

        for path in (self.cfg.context, self.cfg.prd, self.cfg.e2e):
            if not (self.root / path).is_file():
                raise SystemExit(f"missing: {path}")

        self.init_state()
        self.load_child_issues()
        print(
            f"Parent #{self.cfg.parent_issue} → child issues: "
            + " ".join(str(n) for n in self.issue_numbers)
        )

        if not self.cfg.dry_run:
            self.ensure_branch()

        for n in self.issue_numbers:
            if n < self.cfg.from_issue:
                continue
            if self.issue_done(n):
                continue

            suite = self.suite_for(n)

            self.run_until_promise(
                self.cfg.max_impl,
                f"issue-{n}-impl",
                f"RALPH_ISSUE_COMPLETE #{n}",
                lambda n=n: self.prompt_impl(n),
            )
            self.maybe_push()

            if not self.cfg.skip_e2e:
                self.run_until_promise(
                    self.cfg.max_e2e,
                    f"e2e-{suite}",
                    f"RALPH_E2E_COMPLETE SUITE_{suite}",
                    lambda suite=suite, n=n: self.prompt_e2e(suite, n),
                )
                self.mark_suite(suite)
                self.maybe_push()

            self.mark_issue(n)

        if self.state.get("final_complete"):
            return

        self.run_until_promise(10, "final", "RALPH_ALL_COMPLETE", self.prompt_final)
        if self.last_log and self.has_promise(self.last_log, "RALPH_E2E_COMPLETE SUITE_D"):
            self.mark_suite("D")
        self.mark_final()
        self.maybe_push()


def main(argv: Sequence[str] | None = None) -> None:
    cfg = parse_args(argv)
    root = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
    RalphLoop(cfg, root).run()


if __name__ == "__main__":
    main()
