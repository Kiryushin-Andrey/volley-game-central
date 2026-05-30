const ISSUE_COMPLETE = /^RALPH_ISSUE_COMPLETE #(\d+)$/m;
const SLICE_COMPLETE = /^RALPH_SLICE_COMPLETE #(\d+)$/m;

/** True if progress text records the given child issue as complete. */
export function textHasIssueComplete(text: string, issueNumber: number): boolean {
  const n = String(issueNumber);
  for (const re of [ISSUE_COMPLETE, SLICE_COMPLETE]) {
    for (const match of text.matchAll(re)) {
      if (match[1] === n) return true;
    }
  }
  const tag = `<promise>RALPH_ISSUE_COMPLETE #${n}</promise>`;
  const legacyTag = `<promise>RALPH_SLICE_COMPLETE #${n}</promise>`;
  return text.includes(tag) || text.includes(legacyTag);
}
