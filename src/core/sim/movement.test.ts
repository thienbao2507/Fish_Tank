import { describe, expect, it } from 'vitest';
import { stepMotion, type MotionState } from './movement';

const params = { maxSpeed: 100, acceleration: 400, deceleration: 100 };
const bounds = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
const DT = 1 / 60;

function state(overrides: Partial<MotionState> = {}): MotionState {
  return { x: 500, y: 500, vx: 0, vy: 0, ...overrides };
}

function run(s: MotionState, dirX: number, dirY: number, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) stepMotion(s, dirX, dirY, DT, params, bounds);
}

describe('stepMotion', () => {
  it('tăng tốc dần, không đạt tốc độ tối đa ngay lập tức', () => {
    const s = state();
    stepMotion(s, 1, 0, DT, params, bounds);
    expect(s.vx).toBeCloseTo(400 * DT);
    expect(s.vx).toBeLessThan(100);
  });

  it('không vượt quá tốc độ tối đa', () => {
    const s = state();
    run(s, 1, 0, 2);
    expect(s.vx).toBeCloseTo(100);
  });

  it('đi chéo không nhanh hơn đi thẳng', () => {
    const s = state();
    run(s, Math.SQRT1_2, Math.SQRT1_2, 2);
    expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(100);
  });

  it('thả tay → trôi chậm lại rồi dừng hẳn', () => {
    const s = state({ vx: 100 });
    stepMotion(s, 0, 0, DT, params, bounds);
    expect(s.vx).toBeGreaterThan(90); // vẫn còn trôi
    run(s, 0, 0, 1.5);
    expect(s.vx).toBe(0);
  });

  it('chạm biên thì dừng ở biên và mất vận tốc theo trục đó', () => {
    const s = state({ x: 999, vx: 100, vy: 50 });
    stepMotion(s, 1, 0, 0.1, params, bounds);
    expect(s.x).toBe(1000);
    expect(s.vx).toBe(0);
    expect(s.vy).not.toBe(0);
  });
});
