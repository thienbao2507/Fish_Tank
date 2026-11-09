export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface EdgePoint {
  readonly x: number;
  readonly y: number;
  /** Hướng từ tâm rect tới mục tiêu (radian, 0 = sang phải, trục y hướng xuống). */
  readonly angle: number;
}

/**
 * Điểm trên mép `rect` nằm trên đường từ tâm `rect` tới (targetX, targetY).
 * Dùng để đặt mũi tên chỉ hướng tới một vật đang ở ngoài màn hình.
 */
export function edgePoint(rect: Rect, targetX: number, targetY: number): EdgePoint {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : rect.width / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : rect.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY, 1);
  return { x: cx + dx * scale, y: cy + dy * scale, angle: Math.atan2(dy, dx) };
}
