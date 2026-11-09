import { describe, expect, it } from 'vitest';
import { DEPTH_K, VP_RAISE, depthScale, frontGlassAlpha, layerPlacement } from './perspective';

describe('depthScale', () => {
  it('giữ nguyên lớp chơi và giảm dần theo z', () => {
    expect(depthScale(0)).toBe(1);
    expect(depthScale(0.4)).toBeGreaterThan(depthScale(0.7));
    expect(depthScale(0.7)).toBeGreaterThan(depthScale(1));
    expect(depthScale(1)).toBeCloseTo(1 / (1 + DEPTH_K));
  });
});

describe('layerPlacement', () => {
  it.each([
    { scrollX: 0, scrollY: 0, worldX: 125, worldY: 260 },
    { scrollX: 517, scrollY: 96, worldX: 930, worldY: 488 },
  ])('khớp phép chiếu tại scroll ($scrollX, $scrollY)', (point) => {
    const viewW = 760;
    const viewH = 360;
    const z = 0.7;
    const placement = layerPlacement(z, viewW, viewH);
    const vpX = viewW / 2;
    const vpY = viewH / 2 - VP_RAISE;
    const camCenterX = point.scrollX + viewW / 2;
    const camCenterY = point.scrollY + viewH / 2 - VP_RAISE;

    const projectedX = vpX + (point.worldX - camCenterX) * placement.scale;
    const projectedY = vpY + (point.worldY - camCenterY) * placement.scale;
    const renderedX =
      point.worldX * placement.scale + placement.offsetX - point.scrollX * placement.scrollFactor;
    const renderedY =
      point.worldY * placement.scale + placement.offsetY - point.scrollY * placement.scrollFactor;

    expect(renderedX).toBeCloseTo(projectedX);
    expect(renderedY).toBeCloseTo(projectedY);
  });
});

describe('frontGlassAlpha', () => {
  it('rõ ở mép, mất ở giữa và giảm đơn điệu', () => {
    expect(frontGlassAlpha(0, 1680)).toBe(1);
    expect(frontGlassAlpha(1680, 1680)).toBe(1);
    expect(frontGlassAlpha(840, 1680)).toBe(0);
    expect(frontGlassAlpha(20, 1680)).toBeGreaterThan(frontGlassAlpha(60, 1680));
    expect(frontGlassAlpha(60, 1680)).toBeGreaterThan(frontGlassAlpha(100, 1680));
    expect(frontGlassAlpha(120, 1680)).toBe(0);
  });
});
