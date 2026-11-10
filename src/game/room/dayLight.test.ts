import { describe, expect, it } from 'vitest';
import { loadContent } from '../../core/content/loader';
import { rawContent } from '../../core/content/raw';
import { dayLightAt, windowWeights } from './dayLight';

const day = loadContent(rawContent).balance.day;

function total(minute: number): number {
  const w = windowWeights(day, minute);
  return w.night + w.morning + w.noon + w.dusk;
}

describe('dayLightAt', () => {
  it('trọng số cửa sổ luôn có tổng bằng 1', () => {
    for (let minute = 0; minute < 1440; minute += 7) {
      expect(total(minute)).toBeCloseTo(1);
    }
  });

  it('mỗi buổi dùng đúng cửa sổ', () => {
    expect(windowWeights(day, 480).morning).toBe(1);
    expect(windowWeights(day, 750).noon).toBe(1);
    expect(windowWeights(day, 900).noon).toBe(1);
    expect(windowWeights(day, 1110).dusk).toBe(1);
    expect(windowWeights(day, 1320).night).toBe(1);
    expect(windowWeights(day, 120).night).toBe(1);
  });

  it('chuyển mượt quanh mốc, đúng nửa nửa tại mốc', () => {
    const at = windowWeights(day, day.morningFrom);
    expect(at.night).toBeCloseTo(0.5);
    expect(at.morning).toBeCloseTo(0.5);
    const before = windowWeights(day, day.morningFrom - 10);
    expect(before.night).toBeGreaterThan(0.5);
    expect(before.morning).toBeGreaterThan(0);
    // Đêm sang sáng đi vòng qua nửa đêm vẫn hợp lệ.
    expect(windowWeights(day, 0).night).toBe(1);
  });

  it('nắng cao nhất 06:30–09:30 và tắt vào chiều tối', () => {
    expect(dayLightAt(day, 390).sun).toBeCloseTo(1);
    expect(dayLightAt(day, 480).sun).toBeCloseTo(1);
    expect(dayLightAt(day, 570).sun).toBeCloseTo(1);
    expect(dayLightAt(day, 1100).sun).toBe(0);
    expect(dayLightAt(day, 1320).sun).toBe(0);
  });

  it('đèn: đêm 1, ban ngày thấp hơn trong khoảng 0.35–0.5', () => {
    expect(dayLightAt(day, 1320).lights).toBe(1);
    const noon = dayLightAt(day, 750).lights;
    expect(noon).toBeGreaterThanOrEqual(0.35);
    expect(noon).toBeLessThanOrEqual(0.5);
  });

  it('lớp tối: ngày ~0, chạng vạng nhẹ, đêm ~0.35', () => {
    expect(dayLightAt(day, 750).shade.alpha).toBe(0);
    const dusk = dayLightAt(day, 1110).shade.alpha;
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(0.2);
    expect(dayLightAt(day, 1320).shade.alpha).toBeCloseTo(0.35);
    expect(dayLightAt(day, 60).shade.alpha).toBeCloseTo(0.35);
  });
});
