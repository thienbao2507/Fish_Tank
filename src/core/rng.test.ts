import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('cùng seed cho cùng chuỗi số', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('seed khác cho chuỗi khác', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next() luôn nằm trong [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int() nằm trong khoảng và chạm được cả hai đầu', () => {
    const rng = createRng(123);
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const value = rng.int(1, 3);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(3);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('int() từ chối khoảng không hợp lệ', () => {
    const rng = createRng(1);
    expect(() => rng.int(5, 1)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it('chance() ở hai biên 0 và 1', () => {
    const rng = createRng(9);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('pick() chọn phần tử có trong danh sách và báo lỗi khi rỗng', () => {
    const rng = createRng(5);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});
