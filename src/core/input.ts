/** Hướng di chuyển người chơi đang điều khiển: mỗi trục trong [-1, 1], độ dài ≤ 1. */
export interface PlayerInput {
  moveX: number;
  moveY: number;
  /** Nổi lên (+1), đứng yên (0/mặc định), hoặc lặn xuống (-1). */
  dive?: -1 | 0 | 1;
}

export interface Direction {
  readonly x: number;
  readonly y: number;
}

const STILL: Direction = { x: 0, y: 0 };
const EIGHTH_TURN = Math.PI / 4;
const D = Math.SQRT1_2;

/** 8 hướng theo chiều kim đồng hồ bắt đầu từ phải (trục y hướng xuống). Giá trị chính xác, không qua sin/cos. */
const EIGHT_DIRECTIONS: readonly Direction[] = [
  { x: 1, y: 0 },
  { x: D, y: D },
  { x: 0, y: 1 },
  { x: -D, y: D },
  { x: -1, y: 0 },
  { x: -D, y: -D },
  { x: 0, y: -1 },
  { x: D, y: -D },
];

/**
 * Lượng tử hoá vector kéo của joystick về 8 hướng (độ dài 1, chéo = √½ mỗi trục).
 * Kéo ngắn hơn hoặc bằng `deadzone` → đứng yên.
 */
export function quantizeDirection(dx: number, dy: number, deadzone: number): Direction {
  if (!(Math.hypot(dx, dy) > deadzone)) return STILL;
  const sector = Math.round(Math.atan2(dy, dx) / EIGHTH_TURN);
  return EIGHT_DIRECTIONS[((sector % 8) + 8) % 8] as Direction;
}

/** Ghép 4 phím hướng thành 1 trong 8 hướng; đi chéo không nhanh hơn đi thẳng. */
export function keysToDirection(
  left: boolean,
  right: boolean,
  up: boolean,
  down: boolean,
): Direction {
  const x = Number(right) - Number(left);
  const y = Number(down) - Number(up);
  if (x !== 0 && y !== 0) {
    return { x: x * Math.SQRT1_2, y: y * Math.SQRT1_2 };
  }
  return { x, y };
}
