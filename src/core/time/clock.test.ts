import { describe, expect, it } from 'vitest';
import { ScaledClock } from './clock';

function fakeRealTime(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('ScaledClock', () => {
  it('bắt đầu bằng giờ thực và chạy cùng tốc độ ở ×1', () => {
    const real = fakeRealTime();
    const clock = new ScaledClock(real.now);
    expect(clock.now()).toBe(1_000_000);
    real.advance(500);
    expect(clock.now()).toBe(1_000_500);
    expect(clock.scale).toBe(1);
  });

  it('chạy nhanh gấp k lần khi đặt hệ số k', () => {
    const real = fakeRealTime();
    const clock = new ScaledClock(real.now);
    clock.setScale(10);
    real.advance(1_000);
    expect(clock.now()).toBe(1_010_000);
  });

  it('đổi hệ số không làm thời gian nhảy', () => {
    const real = fakeRealTime();
    const clock = new ScaledClock(real.now);
    clock.setScale(100);
    real.advance(1_000); // +100 000
    const before = clock.now();
    clock.setScale(1);
    expect(clock.now()).toBe(before);
    real.advance(1_000);
    expect(clock.now()).toBe(before + 1_000);
  });

  it('từ chối hệ số không hợp lệ', () => {
    const clock = new ScaledClock(fakeRealTime().now);
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => clock.setScale(bad)).toThrow(RangeError);
    }
    expect(clock.scale).toBe(1);
  });
});
