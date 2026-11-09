export interface ShadowStyle {
  readonly alpha: number;
  readonly scaleX: number;
}

const FLOOR_ALPHA = 0.45;
const SURFACE_ALPHA = 0.08;
const FLOOR_SCALE_X = 1;
const SURFACE_SCALE_X = 1.8;

/** Bóng sát đáy đậm, gọn; vật càng lên gần mặt nước thì bóng càng mờ và loe. */
export function shadowStyle(objY: number, floorY: number, surfaceY: number): ShadowStyle {
  const waterHeight = Math.max(1, floorY - surfaceY);
  const heightRatio = Math.max(0, Math.min(1, (floorY - objY) / waterHeight));
  return {
    alpha: FLOOR_ALPHA + (SURFACE_ALPHA - FLOOR_ALPHA) * heightRatio,
    scaleX: FLOOR_SCALE_X + (SURFACE_SCALE_X - FLOOR_SCALE_X) * heightRatio,
  };
}
