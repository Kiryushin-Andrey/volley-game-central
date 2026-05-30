import { readFileSync } from "node:fs";
import { textHasIssueComplete } from "./sigil.js";

export interface ProgressResume {
  completedIssues: Set<number>;
}

export function emptyResume(): ProgressResume {
  return { completedIssues: new Set() };
}

/** Parse completion sigils from progress.txt only (no git commit lookup). */
export function loadProgressResume(progressContent: string, childIssues: number[]): ProgressResume {
  const resume = emptyResume();

  for (const n of childIssues) {
    if (textHasIssueComplete(progressContent, n)) {
      resume.completedIssues.add(n);
    }
  }

  return resume;
}

export function readProgressResume(progressPath: string, childIssues: number[]): ProgressResume {
  let content = "";
  try {
    content = readFileSync(progressPath, "utf-8");
  } catch {
    return emptyResume();
  }
  return loadProgressResume(content, childIssues);
}
