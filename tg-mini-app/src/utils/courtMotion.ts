import { flushSync } from 'react-dom';

const TRANSITION_KEY = 'court-vt-game-id';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function markCourtTransition(gameId: number): void {
  try {
    sessionStorage.setItem(TRANSITION_KEY, String(gameId));
  } catch {
    // Private mode can block storage. The navigation still proceeds.
  }
}

export function readCourtTransitionId(): number | null {
  try {
    const raw = sessionStorage.getItem(TRANSITION_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/** Carry the date and format pill between the list and the game when the browser supports it. */
export function withViewTransition(update: () => void): void {
  const start = (typeof document !== 'undefined'
    ? (document as ViewTransitionDocument).startViewTransition
    : undefined);

  if (!start || prefersReducedMotion()) {
    update();
    return;
  }

  try {
    start.call(document, () => {
      flushSync(update);
    });
  } catch {
    update();
  }
}
