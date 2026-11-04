export interface MotionParams {
  /** Tốc độ tối đa (px/giây). */
  readonly maxSpeed: number;
  /** Gia tốc khi đang điều khiển (px/giây²). */
  readonly acceleration: number;
  /** Giảm tốc khi thả tay (px/giây²) — nhỏ hơn gia tốc để robot trôi chậm lại. */
  readonly deceleration: number;
}

export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface MotionState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Một bước chuyển động có quán tính: vận tốc tiến dần về `hướng × maxSpeed`
 * (tăng tốc khi có điều khiển, giảm tốc khi thả tay), rồi giữ vị trí trong `bounds`.
 * `dirX`, `dirY` là vector hướng độ dài ≤ 1. Hàm sửa trực tiếp `state`.
 */
export function stepMotion(
  state: MotionState,
  dirX: number,
  dirY: number,
  dt: number,
  params: MotionParams,
  bounds: Bounds,
): void {
  const hasInput = dirX !== 0 || dirY !== 0;
  const targetVx = dirX * params.maxSpeed;
  const targetVy = dirY * params.maxSpeed;
  const maxChange = (hasInput ? params.acceleration : params.deceleration) * dt;

  const dvx = targetVx - state.vx;
  const dvy = targetVy - state.vy;
  const distance = Math.hypot(dvx, dvy);
  if (distance <= maxChange) {
    state.vx = targetVx;
    state.vy = targetVy;
  } else {
    state.vx += (dvx / distance) * maxChange;
    state.vy += (dvy / distance) * maxChange;
  }

  state.x += state.vx * dt;
  state.y += state.vy * dt;

  if (state.x < bounds.minX) {
    state.x = bounds.minX;
    state.vx = 0;
  } else if (state.x > bounds.maxX) {
    state.x = bounds.maxX;
    state.vx = 0;
  }
  if (state.y < bounds.minY) {
    state.y = bounds.minY;
    state.vy = 0;
  } else if (state.y > bounds.maxY) {
    state.y = bounds.maxY;
    state.vy = 0;
  }
}
