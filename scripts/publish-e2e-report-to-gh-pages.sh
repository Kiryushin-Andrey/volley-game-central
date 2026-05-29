#!/usr/bin/env bash
# Publish the Playwright HTML report (all test screenshots) to GitHub Pages (gh-pages branch).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BRANCH="gh-pages"
WORKTREE="$REPO_ROOT/.gh-pages-worktree"

resolve_report_dir() {
  if [[ -n "${PLAYWRIGHT_REPORT_DIR:-}" ]]; then
    echo "$PLAYWRIGHT_REPORT_DIR"
    return
  fi
  if [[ -f /opt/cursor/artifacts/playwright-report/index.html ]]; then
    echo /opt/cursor/artifacts/playwright-report
    return
  fi
  if [[ -f "$REPO_ROOT/playwright-report/index.html" ]]; then
    echo "$REPO_ROOT/playwright-report"
    return
  fi
  return 1
}

resolve_last_run_json() {
  for candidate in \
    /opt/cursor/artifacts/e2e-test-results/.last-run.json \
    "$REPO_ROOT/test-results/.last-run.json"; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done
}

github_pages_url() {
  local remote owner repo owner_lower
  remote="$(git config --get remote.origin.url || true)"
  if [[ "$remote" =~ github.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    owner="${BASH_REMATCH[1]}"
    repo="${BASH_REMATCH[2]%.git}"
    owner_lower="$(printf '%s' "$owner" | tr '[:upper:]' '[:lower:]')"
    echo "https://${owner_lower}.github.io/${repo}/"
  else
    echo ""
  fi
}

if ! REPORT_DIR="$(resolve_report_dir)"; then
  echo "Error: Playwright HTML report not found. Run the E2E suite first." >&2
  exit 1
fi

if [[ ! -f "$REPORT_DIR/index.html" ]]; then
  echo "Error: Missing $REPORT_DIR/index.html" >&2
  exit 1
fi

echo "Publishing Playwright report from: $REPORT_DIR"

if git worktree list --porcelain | grep -q "^worktree $WORKTREE$"; then
  git worktree remove --force "$WORKTREE"
fi
git worktree prune

git fetch origin "$BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git worktree add -B "$BRANCH" "$WORKTREE" "origin/$BRANCH"
elif git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git worktree add -B "$BRANCH" "$WORKTREE" "$BRANCH"
else
  # Orphan branch so gh-pages never inherits main's tree (source code must not be published).
  git worktree add --detach "$WORKTREE"
  git -C "$WORKTREE" checkout --orphan "$BRANCH"
  git -C "$WORKTREE" rm -rf . 2>/dev/null || true
fi

find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a "$REPORT_DIR"/. "$WORKTREE"/

PUBLISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SOURCE_COMMIT="$(git rev-parse HEAD)"
SOURCE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
LAST_RUN_JSON="$(resolve_last_run_json || true)"

if [[ -n "$LAST_RUN_JSON" ]] && command -v jq >/dev/null 2>&1; then
  jq -n \
    --arg publishedAt "$PUBLISHED_AT" \
    --arg sourceCommit "$SOURCE_COMMIT" \
    --arg sourceBranch "$SOURCE_BRANCH" \
    --arg reportDir "$REPORT_DIR" \
    --argjson lastRun "$(cat "$LAST_RUN_JSON")" \
    '{publishedAt: $publishedAt, sourceCommit: $sourceCommit, sourceBranch: $sourceBranch, reportDir: $reportDir, lastRun: $lastRun}' \
    > "$WORKTREE/run-info.json"
else
  cat > "$WORKTREE/run-info.json" <<EOF
{
  "publishedAt": "$PUBLISHED_AT",
  "sourceCommit": "$SOURCE_COMMIT",
  "sourceBranch": "$SOURCE_BRANCH",
  "reportDir": "$REPORT_DIR"
}
EOF
fi

cd "$WORKTREE"
git add -A

if git diff --staged --quiet; then
  echo "No report changes to publish."
else
  git commit -m "Publish E2E report ($PUBLISHED_AT)"
  git push -u origin "$BRANCH"
  echo "Pushed $BRANCH to origin."
fi

PAGES_URL="$(github_pages_url)"
if [[ -n "$PAGES_URL" ]]; then
  echo ""
  echo "GitHub Pages report URL:"
  echo "$PAGES_URL"
  echo ""
  echo "Open this URL on your phone to browse every test screenshot."
else
  echo ""
  echo "Report published to branch $BRANCH. Configure GitHub Pages to deploy from that branch (root)."
fi
