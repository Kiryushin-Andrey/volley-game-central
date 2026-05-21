import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function gitRoot(): string {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
}

export function detectRepoSlug(root: string): string {
  try {
    const url = execSync("git remote get-url origin", {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (!match) {
      throw new Error(`Cannot parse GitHub repo from origin URL: ${url}`);
    }
    return `${match[1]}/${match[2]}`;
  } catch {
    throw new Error("Cannot detect --repo: no git origin remote.");
  }
}

export function repoSlugToUrl(slug: string): string {
  return `https://github.com/${slug}`;
}

export function commandExists(cmd: string): boolean {
  return spawnSync("which", [cmd], { stdio: "ignore" }).status === 0;
}

export function ensureBranch(root: string, branch: string, base: string): void {
  spawnSync("git", ["fetch", "origin", base, branch], { cwd: root, stdio: "ignore" });
  const checkout = spawnSync("git", ["checkout", branch], { cwd: root, stdio: "ignore" });
  if (checkout.status !== 0) {
    const r = spawnSync("git", ["checkout", "-B", branch, `origin/${base}`], {
      cwd: root,
      stdio: "inherit",
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}

/** Fetch and fast-forward the sprint branch so progress.txt matches remote. */
export function syncSprintBranch(root: string, branch: string, base: string): void {
  ensureBranch(root, branch, base);
  const pull = spawnSync("git", ["pull", "--ff-only", "origin", branch], {
    cwd: root,
    stdio: "inherit",
  });
  if (pull.status !== 0) {
    console.warn("warn: could not fast-forward sprint branch; using local tip");
  }
}

export function maybePush(root: string, branch: string, enabled: boolean): void {
  if (!enabled) return;
  const r = spawnSync("git", ["push", "-u", "origin", branch], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error("warn: push failed");
  }
}

/** Stage paths (repo-relative), commit if there is a staged diff, optionally push. */
export function commitPaths(
  root: string,
  relPaths: string[],
  message: string,
  branch: string,
  push: boolean,
): boolean {
  const add = spawnSync("git", ["add", "--", ...relPaths], { cwd: root, stdio: "inherit" });
  if (add.status !== 0) return false;
  const empty = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: root, stdio: "ignore" });
  if (empty.status === 0) return false;
  const commit = spawnSync("git", ["commit", "-m", message], { cwd: root, stdio: "inherit" });
  if (commit.status !== 0) return false;
  maybePush(root, branch, push);
  return true;
}

export function requireRepoFiles(root: string, paths: string[]): void {
  for (const rel of paths) {
    if (!existsSync(join(root, rel))) {
      console.error(`missing: ${rel}`);
      process.exit(1);
    }
  }
}
