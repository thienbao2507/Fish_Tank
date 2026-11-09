/** Hộp vật cản song song với trục; x/y là tâm. */
export interface Obstacle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ResolvedMove {
  readonly x: number;
  readonly y: number;
  readonly hitX: boolean;
  readonly hitY: boolean;
}

/** Hộp tâm (x, y) có đang giao phần trong với vật cản nào không. Chạm mép vẫn được phép. */
export function blockedBy(
  obstacles: readonly Obstacle[],
  x: number,
  y: number,
  halfW: number,
  halfH: number,
): boolean {
  return obstacles.some(
    (obstacle) =>
      Math.abs(x - obstacle.x) < halfW + obstacle.width / 2 &&
      Math.abs(y - obstacle.y) < halfH + obstacle.height / 2,
  );
}

/**
 * Quét chuyển động theo X trước rồi Y. Mỗi vật cản được nới theo nửa kích thước vật di chuyển,
 * nhờ đó bước lớn không xuyên vách và trục còn lại vẫn trượt được dọc mép.
 */
export function resolveMove(
  obstacles: readonly Obstacle[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  halfW: number,
  halfH: number,
): ResolvedMove {
  let x = toX;
  let hitX = false;
  const dx = toX - fromX;

  for (const obstacle of obstacles) {
    const top = obstacle.y - obstacle.height / 2 - halfH;
    const bottom = obstacle.y + obstacle.height / 2 + halfH;
    if (!(fromY > top && fromY < bottom)) continue;

    const left = obstacle.x - obstacle.width / 2 - halfW;
    const right = obstacle.x + obstacle.width / 2 + halfW;
    if (dx > 0 && fromX <= left && x > left) {
      x = Math.min(x, left);
      hitX = true;
    } else if (dx < 0 && fromX >= right && x < right) {
      x = Math.max(x, right);
      hitX = true;
    }
  }

  let y = toY;
  let hitY = false;
  const dy = toY - fromY;
  for (const obstacle of obstacles) {
    const left = obstacle.x - obstacle.width / 2 - halfW;
    const right = obstacle.x + obstacle.width / 2 + halfW;
    if (!(x > left && x < right)) continue;

    const top = obstacle.y - obstacle.height / 2 - halfH;
    const bottom = obstacle.y + obstacle.height / 2 + halfH;
    if (dy > 0 && fromY <= top && y > top) {
      y = Math.min(y, top);
      hitY = true;
    } else if (dy < 0 && fromY >= bottom && y < bottom) {
      y = Math.max(y, bottom);
      hitY = true;
    }
  }

  return { x, y, hitX, hitY };
}
