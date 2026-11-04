import { describe, expect, it } from 'vitest';
import { keysToDirection, quantizeDirection } from './input';

const D = Math.SQRT1_2;

describe('quantizeDirection', () => {
  it('trong vùng chết → đứng yên', () => {
    expect(quantizeDirection(3, 4, 5)).toEqual({ x: 0, y: 0 });
    expect(quantizeDirection(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it.each([
    ['phải', 20, 0, 1, 0],
    ['trái', -20, 0, -1, 0],
    ['xuống', 0, 20, 0, 1],
    ['lên', 0, -20, 0, -1],
    ['phải-xuống', 20, 20, D, D],
    ['trái-lên', -20, -20, -D, -D],
  ])('hướng %s', (_name, dx, dy, x, y) => {
    expect(quantizeDirection(dx, dy, 5)).toEqual({ x, y });
  });

  it('làm tròn về hướng gần nhất', () => {
    // 30° gần 45° hơn 0°
    expect(quantizeDirection(Math.cos(Math.PI / 6) * 20, Math.sin(Math.PI / 6) * 20, 5)).toEqual({
      x: D,
      y: D,
    });
    // 10° gần 0° hơn
    expect(quantizeDirection(20, 3.5, 5)).toEqual({ x: 1, y: 0 });
  });
});

describe('keysToDirection', () => {
  it('không phím nào → đứng yên', () => {
    expect(keysToDirection(false, false, false, false)).toEqual({ x: 0, y: 0 });
  });

  it('một phím → hướng thẳng', () => {
    expect(keysToDirection(false, true, false, false)).toEqual({ x: 1, y: 0 });
    expect(keysToDirection(false, false, true, false)).toEqual({ x: 0, y: -1 });
  });

  it('hai phím vuông góc → chéo, độ dài 1', () => {
    const dir = keysToDirection(true, false, false, true);
    expect(dir).toEqual({ x: -D, y: D });
    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1);
  });

  it('hai phím ngược nhau triệt tiêu', () => {
    expect(keysToDirection(true, true, false, false)).toEqual({ x: 0, y: 0 });
  });
});
