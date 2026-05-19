import { readFileSync } from "node:fs";
import { promiseIssueComplete, promiseSliceComplete, textHasIssueComplete, textHasPromise } from "./sigil.js";
import { gitLogHasPromise } from "./git.js";

export interface ProgressResume {
  completedIssues: Set<number>;
  finalComplete: boolean;
}

export function emptyResume(): ProgressResume {
  return { completedIssues: new Set(), finalComplete: false };
}

/** Parse completion sigils from progress.txt (and optional git log on the sprint branch). */
export function loadProgressResume(
  progressContent: string,
  childIssues: number[],
  opts: { root: string; branch: string; verifyGit: boolean },
): ProgressResume {
  const resume = emptyResume();

  for (const n of childIssues) {
    if (textHasIssueComplete(progressContent, n)) {
      resume.completedIssues.add(n);
    }
  }

  if (textHasPromise(progressContent, "RALPH_ALL_COMPLETE")) {
    resume.finalComplete = true;
  }

  if (!opts.verifyGit) return resume;

  for (const n of childIssues) {
    if (resume.completedIssues.has(n)) continue;
    if (gitLogHasPromise(opts.root, opts.branch, promiseIssueComplete(n))) {
      console.warn(
        `resume: issue #${n} marked complete in git history but missing from progress.txt — treating as done`,
      );
      resume.completedIssues.add(n);
    } else if (gitLogHasPromise(opts.root, opts.branch, promiseSliceComplete(n))) {
      console.warn(
        `resume: issue #${n} (legacy RALPH_SLICE_COMPLETE) in git history but missing from progress.txt — treating as done`,
      );
      resume.completedIssues.add(n);
    }
  }

  if (!resume.finalComplete && gitLogHasPromise(opts.root, opts.branch, "RALPH_ALL_COMPLETE")) {
    console.warn("resume: RALPH_ALL_COMPLETE in git history but missing from progress.txt");
    resume.finalComplete = true;
  }

  return resume;
}

export function readProgressResume(
  progressPath: string,
  childIssues: number[],
  opts: { root: string; branch: string; verifyGit: boolean },
): ProgressResume {
  let content = "";
  try {
    content = readFileSync(progressPath, "utf-8");
  } catch {
    return emptyResume();
  }
  return loadProgressResume(content, childIssues, opts);
}
