import { describe, expect, it } from 'vitest';
import {
  headlightAlpha,
  MURK_MAX,
  murkAlpha,
  SPECK_MIN_RATIO,
  speckCount,
  sunrayAlpha,
} from './waterVisual';

describe('murkAlpha', () => {
  it('nước sạch từ 85 không có lớp đục', () => {
    expect(murkAlpha(100)).toBe(0);
    expect(murkAlpha(85)).toBe(0);
  });

  it('nội suy tuyến tính từ độ đục tối đa tới nước sạch', () => {
    expect(murkAlpha(0)).toBe(MURK_MAX);
    expect(murkAlpha(42.5)).toBeCloseTo(MURK_MAX / 2);
  });

  it('không tăng khi độ sạch tăng', () => {
    let previous = MURK_MAX;
    for (const water of [0, 10, 25, 50, 75, 85, 90, 100]) {
      const alpha = murkAlpha(water);
      expect(alpha).toBeLessThanOrEqual(previous);
      previous = alpha;
    }
  });

  it('kẹp độ sạch về khoảng 0–100', () => {
    expect(murkAlpha(-50)).toBe(MURK_MAX);
    expect(murkAlpha(999)).toBe(0);
  });
});

describe('sunrayAlpha', () => {
  it('tia nắng mạnh dần tuyến tính khi nước sạch hơn', () => {
    expect(sunrayAlpha(0)).toBe(0.08);
    expect(sunrayAlpha(0)).toBeLessThan(sunrayAlpha(50));
    expect(sunrayAlpha(50)).toBeLessThan(sunrayAlpha(100));
    expect(sunrayAlpha(50)).toBeCloseTo(0.19);
    expect(sunrayAlpha(100)).toBe(0.3);
  });

  it('kẹp độ sạch về khoảng 0–100', () => {
    expect(sunrayAlpha(-50)).toBe(0.08);
    expect(sunrayAlpha(999)).toBe(0.3);
  });
});

describe('headlightAlpha', () => {
  it('đèn pha rõ hơn khi nước đục', () => {
    expect(headlightAlpha(100)).toBeCloseTo(0.3);
    expect(headlightAlpha(0)).toBeCloseTo(0.7);
    expect(headlightAlpha(30)).toBeGreaterThan(headlightAlpha(70));
  });

  it('kẹp độ sạch về khoảng 0–100', () => {
    expect(headlightAlpha(-10)).toBeCloseTo(0.7);
    expect(headlightAlpha(150)).toBeCloseTo(0.3);
  });
});

describe('speckCount', () => {
  it('nước sạch vẫn còn vài hạt, nước bẩn hiện đủ cả', () => {
    expect(speckCount(100, 70)).toBe(Math.round(70 * SPECK_MIN_RATIO));
    expect(speckCount(0, 70)).toBe(70);
  });

  it('càng bẩn càng nhiều hạt và không vượt quá tổng số', () => {
    let previous = 0;
    for (const water of [100, 80, 50, 20, 0]) {
      const count = speckCount(water, 70);
      expect(count).toBeGreaterThanOrEqual(previous);
      expect(count).toBeLessThanOrEqual(70);
      previous = count;
    }
    expect(speckCount(-20, 70)).toBe(70);
    expect(speckCount(500, 70)).toBe(speckCount(100, 70));
  });
});
