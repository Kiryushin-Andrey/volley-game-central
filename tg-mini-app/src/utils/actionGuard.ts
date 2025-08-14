export class ActionGuard {
  private lastActionTimeMs: number;
  private readonly debounceMs: number;

  constructor(debounceMs: number = 1000) {
    this.lastActionTimeMs = 0;
    this.debounceMs = debounceMs;
  }

  isAllowed(): boolean {
    const now = Date.now();
    if (now - this.lastActionTimeMs < this.debounceMs) {
      return false;
    }
    this.lastActionTimeMs = now;
    return true;
  }
}


