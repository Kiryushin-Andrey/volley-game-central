/** Completion lines agents emit in logs and must record in progress.txt. */

export function promiseIssueComplete(issueNumber: number): string {
  return `RALPH_ISSUE_COMPLETE #${issueNumber}`;
}

/** @deprecated Accept legacy sigil from older passes. */
export function promiseSliceComplete(issueNumber: number): string {
  return `RALPH_SLICE_COMPLETE #${issueNumber}`;
}

export function promiseVariants(promise: string): string[] {
  const variants = [promise];
  if (promise === "RALPH_ALL_COMPLETE") {
    variants.push("COMPLETE");
  }
  return variants;
}

/** True if `text` contains `promise` as its own line or in a <promise> tag. */
export function textHasPromise(text: string, promise: string): boolean {
  for (const variant of promiseVariants(promise)) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linePat = new RegExp(`^\\s*${escaped}\\s*$`, "m");
    if (linePat.test(text)) return true;
    if (text.includes(`<promise>${variant}</promise>`)) return true;
  }
  return false;
}

export function textHasIssueComplete(text: string, issueNumber: number): boolean {
  if (textHasPromise(text, promiseIssueComplete(issueNumber))) return true;
  return textHasPromise(text, promiseSliceComplete(issueNumber));
}
