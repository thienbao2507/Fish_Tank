import { describe, expect, it } from 'vitest';
import { advanceTimer, createTimer, isDone, remainingSeconds } from './timers';

describe('timer', () => {
  it('chưa tới hạn thì chưa hoàn tất', () => {
    const timer = createTimer(1_000, 60);
    expect(isDone(timer, 60_999)).toBe(false);
  });

  it('đúng hạn thì hoàn tất', () => {
    const timer = createTimer(1_000, 60);
    expect(isDone(timer, 61_000)).toBe(true);
  });

  it('quá hạn lâu sau khi đóng rồi mở game vẫn hoàn tất', () => {
    const timer = createTimer(1_000, 60);
    expect(isDone(timer, 1_000_000)).toBe(true);
  });

  it('số giây còn lại không âm', () => {
    const timer = createTimer(1_000, 60);
    expect(remainingSeconds(timer, 31_000)).toBe(30);
    expect(remainingSeconds(timer, 1_000_000)).toBe(0);
  });

  it('advanceTimer làm hạn đến sớm đúng số giây mà không đổi timer cũ', () => {
    const timer = createTimer(10_000, 60);
    const advanced = advanceTimer(timer, 15);

    expect(advanced).toEqual({ startedAt: -5_000, durationMs: 60_000 });
    expect(remainingSeconds(advanced, 30_000)).toBe(25);
    expect(timer).toEqual({ startedAt: 10_000, durationMs: 60_000 });
  });
});
