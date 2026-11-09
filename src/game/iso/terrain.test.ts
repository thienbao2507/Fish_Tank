import { describe, expect, it } from 'vitest';
import type { Plateau } from './scenePlan';
import { heightAt, sortZ, altitudeShadow } from './terrain';

const PLATEAUS: readonly Plateau[] = [
  { x: 100, z: 200, w: 80, d: 40, height: 36, key: 'cliff.a', texW: 80 },
  { x: 320, z: 420, w: 120, d: 60, height: 52, key: 'cliff.b', texW: 120 },
];

describe('heightAt', () => {
  it('trả độ cao trong cao nguyên', () => {
    expect(heightAt(PLATEAUS, 100, 200)).toBe(36);
    expect(heightAt(PLATEAUS, 330, 410)).toBe(52);
  });

  it('trả 0 ngoài mọi cao nguyên', () => {
    expect(heightAt(PLATEAUS, 10, 10)).toBe(0);
    expect(heightAt(PLATEAUS, 141, 200)).toBe(0);
  });

  it('coi điểm trên mép là thuộc cao nguyên', () => {
    expect(heightAt(PLATEAUS, 60, 200)).toBe(36);
    expect(heightAt(PLATEAUS, 140, 220)).toBe(36);
  });
});

describe('sortZ', () => {
  it('dùng ngay trước mép trước cho điểm trên cao nguyên', () => {
    expect(sortZ(PLATEAUS, 100, 200)).toBe(179);
    expect(sortZ(PLATEAUS, 380, 450)).toBe(389);
  });

  it('giữ nguyên z cho điểm ngoài cao nguyên', () => {
    expect(sortZ(PLATEAUS, 10, 275)).toBe(275);
  });
});

describe('altitudeShadow', () => {
  it('sát mặt thì nhỏ và đậm, càng cao càng lớn và mờ', () => {
    const near = altitudeShadow(8);
    const far = altitudeShadow(140);
    expect(near.alpha).toBeCloseTo(0.72);
    expect(near.scale).toBeCloseTo(0.8);
    expect(far.alpha).toBeCloseTo(0.22);
    expect(far.scale).toBeCloseTo(1.9);
    expect(altitudeShadow(60).alpha).toBeLessThan(near.alpha);
    expect(altitudeShadow(60).scale).toBeGreaterThan(near.scale);
  });

  it('kẹp giá trị ngoài khoảng', () => {
    expect(altitudeShadow(-20)).toEqual(altitudeShadow(8));
    expect(altitudeShadow(999)).toEqual(altitudeShadow(140));
  });
});
