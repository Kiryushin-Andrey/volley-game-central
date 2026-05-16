#!/usr/bin/env python3
"""
Ralph loop — generic orchestrator for a parent GitHub issue and its child slices.

Follows the Ralph Wiggum pattern (https://www.aihero.dev/getting-started-with-ralph):
same prompt shape each iteration, PRD + progress file for context, one task per pass,
feedback loops before commit, completion sigils the harness can detect.

1. Runs over --child-issues (discovered by the orchestrator before invoking this script).
2. Per child: implementation pass → E2E pass (optional).
3. Final pass: regression E2E + combined PR.

Task content: --prd, --e2e, --context, GitHub issue URLs, and .ralph/progress.txt.
This script does not call the GitHub API; use skill ralph-cloud-loop for child discovery.

Completion (own line, or wrapped in <promise>…</promise>):
  RALPH_ISSUE_COMPLETE #<n>
  RALPH_E2E_COMPLETE SUITE_X
  RALPH_ALL_COMPLETE  (or <promise>COMPLETE</promise> on the final pass)

Use --once for human-in-the-loop (single attempt per pass). Cap AFK cost with --max-iterations.

Prerequisites: git; Cursor CLI for --backend local; CURSOR_API_KEY for --backend cloud.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Literal, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ralph_cloud import CloudAgentClient, repo_slug_to_url  # noqa: E402

# Default feedback loops (override with --feedback-loop or .ralph/STEERING.md).
DEFAULT_FEEDBACK_LOOPS: tuple[str, ...] = (
    "Backend TypeScript: cd backend && npm run build",
    "Frontend TypeScript: cd tg-mini-app && npm run build",
)

PROGRESS_HEADER = """# Ralph progress (session log)
# Append after each pass. Concise bullets; grammar optional.
# Delete this file when the epic sprint is done.
"""


def detect_repo_slug(root: Path) -> str:
    try:
        url = subprocess.check_output(
            ["git", "remote", "get-url", "origin"],
            cwd=root,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except subprocess.CalledProcessError as exc:
        raise SystemExit("Cannot detect --repo: no git origin remote.") from exc
    match = re.search(r"github\.com[:/]([^/]+)/([^/.]+)", url)
    if not match:
        raise SystemExit(f"Cannot parse GitHub repo from origin URL: {url}")
    return f"{match.group(1)}/{match.group(2)}"


Backend = Literal["local", "cloud"]


@dataclass
class Config:
    repo: str
    repo_url: str
    parent_issue: int
    child_issues: list[int]
    branch: str
    base: str
    context: Path
    prd: Path
    e2e: Path
    state_dir: Path
    state_file: Path
    backend: Backend
    agent_cmd: str
    cursor_api_key: str | None
    cloud_poll_interval: float
    cloud_env: dict[str, str]
    cloud_create_pr_on_final: bool
    max_impl: int
    max_e2e: int
    dry_run: bool
    skip_e2e: bool
    from_issue: int
    push: bool
    once: bool
    max_total_iterations: int
    feedback_loops: tuple[str, ...]

    @property
    def logs_dir(self) -> Path:
        return self.state_dir / "logs"

    @property
    def progress_file(self) -> Path:
        return self.state_dir / "progress.txt"

    @property
    def steering_file(self) -> Path:
        return self.state_dir / "STEERING.md"

    @property
    def screenshots_dir(self) -> Path:
        return self.state_dir / "screenshots"

    @property
    def is_cloud(self) -> bool:
        return self.backend == "cloud"


def _parse_cloud_env(values: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for item in values:
        if "=" not in item:
            raise SystemExit(f"--cloud-env must be KEY=VALUE, got: {item!r}")
        key, val = item.split("=", 1)
        if not key:
            raise SystemExit(f"--cloud-env key empty: {item!r}")
        out[key] = val
    return out


def parse_args(argv: Sequence[str] | None = None) -> Config:
    parser = argparse.ArgumentParser(
        description="Ralph loop: child GitHub issues + E2E verification (generic epic driver).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --parent-issue 8 --child-issues 20 21 22 --branch cursor/my-feature \\
    --prd docs/prd/my-feature.md --e2e docs/testing/e2e-my-feature.md --dry-run

See .ralph/examples/ and skill ralph-cloud-loop for child discovery before running.
        """.strip(),
    )
    parser.add_argument(
        "--repo",
        default=None,
        help="GitHub owner/repo (default: parse from git remote origin)",
    )
    parser.add_argument(
        "--repo-url",
        default=None,
        help="Full GitHub repo URL (default: https://github.com/<--repo>)",
    )
    parser.add_argument(
        "-p",
        "--parent-issue",
        type=int,
        required=True,
        help="Parent epic / PRD issue number",
    )
    parser.add_argument(
        "--child-issues",
        type=int,
        nargs="+",
        required=True,
        metavar="N",
        help="Child slice issue numbers in run order (ascending issue # recommended)",
    )
    parser.add_argument(
        "--branch",
        required=True,
        help="Integration branch for one combined PR",
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
        required=True,
        help="PRD path for this epic",
    )
    parser.add_argument(
        "--e2e",
        type=Path,
        required=True,
        help="Browser E2E plan path for this epic",
    )
    parser.add_argument(
        "--state-dir",
        type=Path,
        default=Path(".ralph"),
        help="Directory for logs and state (default: %(default)s)",
    )
    parser.add_argument(
        "--state-file",
        type=Path,
        default=None,
        help="Progress JSON path (default: <state-dir>/ralph-state.json)",
    )
    parser.add_argument(
        "--backend",
        choices=("local", "cloud"),
        default="local",
        help="Local Cursor CLI or separate Cloud Agent per pass (default: %(default)s)",
    )
    parser.add_argument(
        "--agent-cmd",
        default="agent",
        help="Cursor CLI when --backend local (default: %(default)s)",
    )
    parser.add_argument(
        "--cursor-api-key",
        default=None,
        help="Cursor API key for --backend cloud (else CURSOR_API_KEY env)",
    )
    parser.add_argument(
        "--cloud-poll-interval",
        type=float,
        default=15.0,
        help="Seconds between run status polls if SSE ends early (default: %(default)s)",
    )
    parser.add_argument(
        "--cloud-env",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="Env var for each cloud session (repeatable)",
    )
    parser.add_argument(
        "--cloud-create-pr-on-final",
        action="store_true",
        help="Cloud only: autoCreatePR on the final pass",
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
        help="Print prompts only",
    )
    parser.add_argument(
        "--skip-e2e",
        action="store_true",
        help="Skip browser E2E passes",
    )
    parser.add_argument(
        "--from",
        dest="from_issue",
        type=int,
        default=0,
        metavar="N",
        help="Skip child issues with number < N",
    )
    parser.add_argument(
        "--push",
        action="store_true",
        help="git push after each milestone",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="HITL mode: one agent attempt per pass (no retry until promise)",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=0,
        metavar="N",
        help="Cap total agent invocations across the run; 0 = unlimited (default)",
    )
    parser.add_argument(
        "--feedback-loop",
        action="append",
        default=[],
        metavar="DESC",
        help="Feedback loop to run before commit (repeatable; replaces defaults if any set)",
    )
    ns = parser.parse_args(argv)
    api_key = ns.cursor_api_key or os.environ.get("CURSOR_API_KEY")
    if ns.backend == "cloud" and not ns.dry_run and not api_key:
        raise SystemExit(
            "Cloud backend requires --cursor-api-key or CURSOR_API_KEY environment variable."
        )
    state_dir = ns.state_dir
    state_file = ns.state_file or (state_dir / "ralph-state.json")
    feedback = tuple(ns.feedback_loop) if ns.feedback_loop else DEFAULT_FEEDBACK_LOOPS
    return Config(
        repo=ns.repo or "",
        repo_url=ns.repo_url or "",
        parent_issue=ns.parent_issue,
        child_issues=ns.child_issues,
        branch=ns.branch,
        base=ns.base,
        context=ns.context,
        prd=ns.prd,
        e2e=ns.e2e,
        state_dir=state_dir,
        state_file=state_file,
        backend=ns.backend,
        agent_cmd=ns.agent_cmd,
        cursor_api_key=api_key,
        cloud_poll_interval=ns.cloud_poll_interval,
        cloud_env=_parse_cloud_env(ns.cloud_env),
        cloud_create_pr_on_final=ns.cloud_create_pr_on_final,
        max_impl=ns.max_impl,
        max_e2e=ns.max_e2e,
        dry_run=ns.dry_run,
        skip_e2e=ns.skip_e2e,
        from_issue=ns.from_issue,
        push=ns.push,
        once=ns.once,
        max_total_iterations=ns.max_iterations,
        feedback_loops=feedback,
    )


class RalphLoop:
    def __init__(self, cfg: Config, root: Path) -> None:
        self.cfg = cfg
        self.root = root
        if not cfg.repo:
            self.cfg.repo = detect_repo_slug(root)
        if not cfg.repo_url:
            self.cfg.repo_url = repo_slug_to_url(self.cfg.repo)
        self.issue_numbers: list[int] = []
        self.state: dict = {}
        self.last_log: Path | None = None
        self.agent_runs = 0

    def cloud_client(self, *, auto_create_pr: bool = False) -> CloudAgentClient:
        assert self.cfg.cursor_api_key
        return CloudAgentClient(
            self.cfg.cursor_api_key,
            self.cfg.repo_url,
            self.cfg.branch,
            poll_interval=self.cfg.cloud_poll_interval,
            env_vars=self.cfg.cloud_env or None,
            auto_create_pr=auto_create_pr,
        )

    def issue_url(self, number: int) -> str:
        return f"https://github.com/{self.cfg.repo}/issues/{number}"

    def load_child_issues(self) -> None:
        self.issue_numbers = sorted(self.cfg.child_issues)
        if not self.issue_numbers:
            raise SystemExit("--child-issues must list at least one issue number.")

    def suite_for(self, issue_number: int) -> str:
        try:
            idx = self.issue_numbers.index(issue_number)
        except ValueError as exc:
            raise ValueError(f"Issue #{issue_number} not in child list") from exc
        return chr(ord("A") + idx)

    def closes_clause(self) -> str:
        return ", ".join(f"Closes #{n}" for n in self.issue_numbers)

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
                "child_issues": self.issue_numbers,
                "branch": self.cfg.branch,
                "prd": str(self.cfg.prd),
                "e2e": str(self.cfg.e2e),
                "backend": self.cfg.backend,
                "completed_issues": [],
                "completed_e2e_suites": [],
                "cloud_sessions": [],
                "final_complete": False,
            }
            self._write_state()

        for key, default in (("completed_e2e_suites", []), ("cloud_sessions", [])):
            if key not in self.state:
                self.state[key] = default
                self._write_state()

        progress = self.cfg.progress_file
        if not progress.exists():
            progress.write_text(PROGRESS_HEADER, encoding="utf-8")

    def _write_state(self) -> None:
        path = self.cfg.state_file
        path.parent.mkdir(parents=True, exist_ok=True)
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

    def record_cloud_session(self, title: str, url: str) -> None:
        sessions = self.state.setdefault("cloud_sessions", [])
        sessions.append({"title": title, "url": url, "at": datetime.now().isoformat()})
        self._write_state()

    def _promise_variants(self, promise: str) -> list[str]:
        variants = [promise]
        if promise == "RALPH_ALL_COMPLETE":
            variants.append("COMPLETE")
        return variants

    def has_promise(self, log_path: Path, promise: str) -> bool:
        if not log_path.is_file():
            return False
        text = log_path.read_text(errors="replace")
        for variant in self._promise_variants(promise):
            line_pat = re.compile(rf"^\s*{re.escape(variant)}\s*$", re.MULTILINE)
            if line_pat.search(text):
                return True
            if f"<promise>{variant}</promise>" in text:
                return True
        return False

    def _check_iteration_budget(self) -> None:
        cap = self.cfg.max_total_iterations
        if cap > 0 and self.agent_runs >= cap:
            raise SystemExit(
                f"Stopped: reached --max-iterations ({cap}). "
                "Resume later or raise the cap for AFK runs."
            )

    def _feedback_block(self) -> str:
        lines = ["Before committing, run feedback loops for the code you touched:"]
        for item in self.cfg.feedback_loops:
            lines.append(f"- {item}")
        lines.append(
            "Do not commit if a loop you ran fails. Fix issues first. "
            "Prefer one logical change per commit."
        )
        return "\n".join(lines)

    def _ralph_workflow_block(self) -> str:
        return f"""Ralph workflow (each pass is a fresh context — read these first):
1. {self.cfg.prd} — scope and acceptance criteria for this epic.
2. {self.cfg.progress_file} — what prior passes did (append when you finish).
3. {self.cfg.state_file} — machine progress (do not edit unless fixing mistakes).

Work style:
- ONLY ONE TASK this pass: the slice described below — not the whole epic.
- If the slice has several PRD items, pick the highest-priority / riskiest one only.
- After implementing: run feedback loops, commit, push to {self.cfg.branch}, append to progress.txt.
- Progress entries: task done, key decisions, files changed, blockers for next pass. Be concise.

{self._feedback_block()}
"""

    def _completion_line(self, promise: str) -> str:
        variants = self._promise_variants(promise)
        primary = variants[0]
        if len(variants) > 1:
            alt = variants[1]
            return (
                f"Output on its own line when done:\n"
                f"{primary}\n"
                f"(or <promise>{alt}</promise> if the entire epic is finished)"
            )
        return f"Output on its own line when done:\n{primary}\n(or <promise>{primary}</promise>)"

    def _cloud_preamble(self) -> str:
        return (
            "You are a Cursor Cloud Agent in an isolated VM. "
            "This is a fresh session — read every file listed below from the repo "
            f"(especially {self.cfg.progress_file}). "
            "One task this pass; run feedback loops before commit; push when done.\n\n"
        )

    def run_agent_local(self, title: str, prompt: str, log_path: Path) -> None:
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

    def run_agent_cloud(
        self, title: str, prompt: str, log_path: Path, *, auto_create_pr: bool
    ) -> None:
        client = self.cloud_client(auto_create_pr=auto_create_pr)
        session = client.run_prompt(title, self._cloud_preamble() + prompt, log_path)
        self.record_cloud_session(title, session.url)

    def run_agent(
        self, title: str, prompt: str, log_path: Path, *, auto_create_pr: bool = False
    ) -> None:
        if self.cfg.dry_run:
            print(f"=== {title} ({self.cfg.backend}) ===")
            print(prompt)
            return
        if self.cfg.is_cloud:
            self.run_agent_cloud(title, prompt, log_path, auto_create_pr=auto_create_pr)
        else:
            self.run_agent_local(title, prompt, log_path)

    def maybe_push(self) -> None:
        if self.cfg.dry_run or not self.cfg.push:
            return
        r = subprocess.run(
            ["git", "push", "-u", "origin", self.cfg.branch],
            cwd=self.root,
        )
        if r.returncode != 0:
            print("warn: push failed", file=sys.stderr)

    def refs_block(self, issue: int | None = None) -> str:
        lines = [
            "Read in the repo (required):",
            f"- {self.cfg.context}",
            f"- {self.cfg.prd}  (parent #{self.cfg.parent_issue})",
            f"- {self.cfg.e2e}",
            f"- {self.cfg.progress_file}",
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
        promise = f"RALPH_ISSUE_COMPLETE #{n}"
        return f"""Ralph loop — implementation pass, issue #{n}.

{self._ralph_workflow_block()}
{self.refs_block(n)}

Implement per GitHub issue #{n} and {self.cfg.prd}. Follow {self.cfg.context} for terms.
If issue #{n} spans multiple PRD items, complete only the single highest-priority item this pass.
Next automated step after this slice: E2E Suite {suite} ({self.cfg.e2e}).

{self._completion_line(promise)}
"""

    def prompt_e2e(self, suite: str, n: int) -> str:
        promise = f"RALPH_E2E_COMPLETE SUITE_{suite}"
        return f"""Ralph loop — E2E pass, Suite {suite}.

{self._ralph_workflow_block()}
{self.refs_block(n)}

Execute Suite {suite} from {self.cfg.e2e} (§6–§8). Screenshots: {self.cfg.screenshots_dir}/.
Minimal fixes on {self.cfg.branch} only. Run feedback loops if you change code; commit and push.

{self._completion_line(promise)}
"""

    def prompt_final(self) -> str:
        return f"""Ralph loop — final pass.

{self._ralph_workflow_block()}
{self.refs_block()}

Run unit tests; Suite D in {self.cfg.e2e}; one draft PR {self.cfg.branch} → {self.cfg.base} ({self.closes_clause()}).
Update {self.cfg.prd} if items use passes:true/false — mark completed slices.

Output on its own lines when done:
RALPH_E2E_COMPLETE SUITE_D
RALPH_ALL_COMPLETE
(or <promise>COMPLETE</promise> when the epic is fully done)
"""

    def run_until_promise(
        self,
        max_iters: int,
        title: str,
        promise: str,
        prompt_fn: Callable[[], str],
        *,
        auto_create_pr: bool = False,
    ) -> None:
        effective_max = 1 if self.cfg.once else max_iters
        i = 1
        while True:
            self._check_iteration_budget()
            if effective_max > 0 and i > effective_max:
                raise SystemExit(f"max iterations: {title}")
            prompt = prompt_fn()
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            log_path = self.cfg.logs_dir / f"{title}-iter{i}-{stamp}.log"
            self.agent_runs += 1
            try:
                self.run_agent(
                    f"{title}-iter{i}",
                    prompt,
                    log_path,
                    auto_create_pr=auto_create_pr,
                )
            except (OSError, RuntimeError) as exc:
                print(f"agent error: {exc}", file=sys.stderr)
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

    def run(self) -> None:
        if shutil.which("git") is None:
            raise SystemExit("need: git")
        if (
            not self.cfg.dry_run
            and not self.cfg.is_cloud
            and shutil.which(self.cfg.agent_cmd) is None
        ):
            raise SystemExit(f"need: {self.cfg.agent_cmd}")

        for path in (self.cfg.context, self.cfg.prd, self.cfg.e2e):
            if not (self.root / path).is_file():
                raise SystemExit(f"missing: {path}")

        self.load_child_issues()
        self.init_state()
        mode = "HITL (--once)" if self.cfg.once else "AFK"
        cap = self.cfg.max_total_iterations
        cap_s = str(cap) if cap > 0 else "unlimited"
        print(
            f"Backend: {self.cfg.backend} ({mode}) | repo: {self.cfg.repo} | "
            f"Parent #{self.cfg.parent_issue} → children: "
            + " ".join(str(n) for n in self.issue_numbers)
            + f" | max agent runs: {cap_s}"
        )
        print(f"Progress log: {self.cfg.progress_file}")
        if self.cfg.is_cloud:
            print(f"Remote: {self.cfg.repo_url} @ {self.cfg.branch}")
            print("Each pass creates a new Cloud Agent session (cursor.com/agents).")

        if not self.cfg.dry_run and not self.cfg.is_cloud:
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

        self.run_until_promise(
            10,
            "final",
            "RALPH_ALL_COMPLETE",
            self.prompt_final,
            auto_create_pr=self.cfg.cloud_create_pr_on_final,
        )
        if self.last_log and self.has_promise(self.last_log, "RALPH_E2E_COMPLETE SUITE_D"):
            self.mark_suite("D")
        self.mark_final()
        self.maybe_push()

        if self.cfg.is_cloud and self.state.get("cloud_sessions"):
            print("\nCloud sessions:")
            for entry in self.state["cloud_sessions"]:
                print(f"  - {entry['title']}: {entry['url']}")


def main(argv: Sequence[str] | None = None) -> None:
    cfg = parse_args(argv)
    root = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
    RalphLoop(cfg, root).run()


if __name__ == "__main__":
    main()
