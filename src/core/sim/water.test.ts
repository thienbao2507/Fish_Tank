import { describe, expect, it } from 'vitest';
import { stepCleanliness, waterTarget } from './water';

describe('waterTarget', () => {
  it('= 100 − ô nhiễm, kẹp trong [0, 100]', () => {
    expect(waterTarget(0)).toBe(100);
    expect(waterTarget(35)).toBe(65);
    expect(waterTarget(250)).toBe(0);
  });
});

describe('stepCleanliness', () => {
  it('nước bẩn dần về mục tiêu với tốc độ giới hạn', () => {
    // 6%/phút → 30 giây giảm 3%
    expect(stepCleanliness(80, 40, 6, 30)).toBeCloseTo(77);
  });

  it('dọn sạch thì nước trong lại dần', () => {
    expect(stepCleanliness(50, 0, 6, 60)).toBeCloseTo(56);
  });

  it('không vượt quá mục tiêu', () => {
    expect(stepCleanliness(59, 40, 6, 600)).toBe(60);
    expect(stepCleanliness(61, 40, 6, 600)).toBe(60);
  });
});
