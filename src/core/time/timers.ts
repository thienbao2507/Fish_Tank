export interface Timer {
  readonly startedAt: number;
  readonly durationMs: number;
}

export function createTimer(now: number, seconds: number): Timer {
  return { startedAt: now, durationMs: seconds * 1_000 };
}

export function isDone(timer: Timer, now: number): boolean {
  return now >= timer.startedAt + timer.durationMs;
}

export function remainingSeconds(timer: Timer, now: number): number {
  return Math.max(0, (timer.startedAt + timer.durationMs - now) / 1_000);
}

export function advanceTimer(timer: Timer, seconds: number): Timer {
  return { ...timer, startedAt: timer.startedAt - seconds * 1_000 };
}
