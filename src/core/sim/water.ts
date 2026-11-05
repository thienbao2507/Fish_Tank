/** Độ sạch mục tiêu (0–100%) ứng với tổng mức ô nhiễm trong khu. */
export function waterTarget(pollution: number): number {
  return Math.min(100, Math.max(0, 100 - pollution));
}

/**
 * Độ sạch tiến dần về mục tiêu với tốc độ `changePerMinute` (%/phút):
 * thêm rác thì nước bẩn dần, dọn sạch thì nước trong lại từ từ.
 */
export function stepCleanliness(
  current: number,
  pollution: number,
  changePerMinute: number,
  dtSeconds: number,
): number {
  const target = waterTarget(pollution);
  const maxStep = (changePerMinute * dtSeconds) / 60;
  if (current < target) return Math.min(target, current + maxStep);
  return Math.max(target, current - maxStep);
}
