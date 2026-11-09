/** Hệ số thu nhỏ theo chiều sâu của hộp bể. */
export const DEPTH_K = 0.6;

/** Điểm tụ cao hơn tâm màn hình chừng này (px logic). */
export const VP_RAISE = 40;

export interface LayerPlacement {
  readonly scale: number;
  readonly scrollFactor: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** z = 0 là lớp chơi; z = 1 là kính sau; z âm nằm trước lớp chơi. */
export function depthScale(z: number): number {
  return 1 / (1 + DEPTH_K * z);
}

/**
 * Biến một Game Object Phaser thành lớp phối cảnh ở độ sâu `z`.
 *
 * Với toạ độ object `(worldX * scale + offsetX, worldY * scale + offsetY)`, scroll factor
 * và scale trả về ở đây, vị trí render trùng với phép chiếu một điểm tụ trong spec 12.5.
 */
export function layerPlacement(z: number, viewW: number, viewH: number): LayerPlacement {
  const scale = depthScale(z);
  const vpX = viewW / 2;
  const vpY = viewH / 2 - VP_RAISE;
  return {
    scale,
    scrollFactor: scale,
    offsetX: vpX * (1 - scale),
    offsetY: vpY * (1 - scale),
  };
}

/** Kính trước rõ ở hai đầu khu và mờ tuyến tính về 0 ở khoảng cách `range`. */
export function frontGlassAlpha(robotX: number, zoneWidth: number, range = 120): number {
  if (range <= 0) return 0;
  const distanceToEdge = Math.max(0, Math.min(robotX, zoneWidth - robotX));
  return Math.max(0, Math.min(1, 1 - distanceToEdge / range));
}
