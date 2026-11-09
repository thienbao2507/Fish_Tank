import { describe, expect, it } from 'vitest';
import { shadowStyle } from './shadows';

describe('shadowStyle', () => {
  const surfaceY = 28;
  const floorY = 500;

  it('đậm và gọn ở đáy, mờ và loe gần mặt nước', () => {
    expect(shadowStyle(floorY, floorY, surfaceY)).toEqual({ alpha: 0.45, scaleX: 1 });
    const surface = shadowStyle(surfaceY, floorY, surfaceY);
    expect(surface.alpha).toBeCloseTo(0.08);
    expect(surface.scaleX).toBeCloseTo(1.8);
  });

  it('thay đổi đơn điệu theo độ cao', () => {
    const low = shadowStyle(450, floorY, surfaceY);
    const middle = shadowStyle(260, floorY, surfaceY);
    const high = shadowStyle(80, floorY, surfaceY);
    expect(low.alpha).toBeGreaterThan(middle.alpha);
    expect(middle.alpha).toBeGreaterThan(high.alpha);
    expect(low.scaleX).toBeLessThan(middle.scaleX);
    expect(middle.scaleX).toBeLessThan(high.scaleX);
  });

  it('kẹp vật nằm ngoài khoảng nước', () => {
    expect(shadowStyle(floorY + 100, floorY, surfaceY)).toEqual(
      shadowStyle(floorY, floorY, surfaceY),
    );
    expect(shadowStyle(surfaceY - 100, floorY, surfaceY)).toEqual(
      shadowStyle(surfaceY, floorY, surfaceY),
    );
  });
});
